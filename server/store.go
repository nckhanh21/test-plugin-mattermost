package main

import (
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/pkg/errors"
)

const (
	// StoreRetries is the number of retries to use when storing lists fails on a race
	StoreRetries = 3
	// StoreListKey is the key used to store lists in the plugin KV store. Still "order" for backwards compatibility.
	StoreListKey = "order"
	// StoreBookKey is the key used to store books in the plugin KV store. Still "item" for backwards compatibility.
	StoreBookKey = "item"
	// StoreReminderKey is the key used to store the last time a user was reminded
	StoreReminderKey = "reminder"
	// StoreReminderEnabledKey is the key used to store the user preference of auto daily reminder
	StoreReminderEnabledKey = "reminder_enabled"

	// StoreAllowIncomingTaskRequestsKey is the key used to store user preference for wallowing any incoming todo requests
	StoreAllowIncomingTaskRequestsKey = "allow_incoming_task"
)

// BookRef denotes every element in any of the lists. Contains the book that refers to,
// and may contain foreign ids of book and user, denoting the user this element is related to
// and the book on that user system.
type BookRef struct {
	BookID        string `json:"book_id"`
	ForeignBookID string `json:"foreign_book_id"`
	ForeignUserID string `json:"foreign_user_id"`
}

func listKey(userID string, listID string) string {
	return fmt.Sprintf("%s_%s%s", StoreListKey, userID, listID)
}

func bookKey(bookID string) string {
	return fmt.Sprintf("%s_%s", StoreBookKey, bookID)
}

func reminderKey(userID string) string {
	return fmt.Sprintf("%s_%s", StoreReminderKey, userID)
}

func reminderEnabledKey(userID string) string {
	return fmt.Sprintf("%s_%s", StoreReminderEnabledKey, userID)
}

func allowIncomingTaskRequestsKey(userID string) string {
	return fmt.Sprintf("%s_%s", StoreAllowIncomingTaskRequestsKey, userID)
}

type listStore struct {
	api plugin.API
}

// NewListStore creates a new listStore
func NewListStore(api plugin.API) ListStore {
	return &listStore{
		api: api,
	}
}

func (l *listStore) SaveBook(book *Book) error {
	jsonBook, jsonErr := json.Marshal(book)
	if jsonErr != nil {
		return jsonErr
	}

	appErr := l.api.KVSet(bookKey(book.ID), jsonBook)
	if appErr != nil {
		return errors.New(appErr.Error())
	}

	return nil
}

func (l *listStore) GetBook(bookID string) (*Book, error) {
	originalJSONBook, appErr := l.api.KVGet(bookKey(bookID))
	if appErr != nil {
		return nil, errors.New(appErr.Error())
	}

	if originalJSONBook == nil {
		return nil, errors.New("cannot find bôk")
	}

	var book *Book
	err := json.Unmarshal(originalJSONBook, &book)
	if err != nil {
		return nil, err
	}

	return book, nil
}

func (l *listStore) RemoveBook(bookID string) error {
	appErr := l.api.KVDelete(bookKey(bookID))
	if appErr != nil {
		return errors.New(appErr.Error())
	}

	return nil
}

func (l *listStore) GetAndRemoveBook(bookID string) (*Book, error) {
	book, err := l.GetBook(bookID)
	if err != nil {
		return nil, err
	}

	err = l.RemoveBook(bookID)
	if err != nil {
		return nil, err
	}

	return book, nil
}

func (l *listStore) GetBookReference(userID, bookID, listID string) (*BookRef, int, error) {
	originalJSONList, err := l.api.KVGet(listKey(userID, listID))
	if err != nil {
		return nil, 0, err
	}

	if originalJSONList == nil {
		return nil, 0, errors.New("cannot load list")
	}

	var list []*BookRef
	jsonErr := json.Unmarshal(originalJSONList, &list)
	if jsonErr != nil {
		list, _, jsonErr = l.legacyBookRef(userID, listID)
		if list == nil {
			return nil, 0, jsonErr
		}
	}

	for i, ir := range list {
		if ir.BookID == bookID {
			return ir, i, nil
		}
	}
	return nil, 0, errors.New("cannot find book")
}

func (l *listStore) GetBookListAndReference(userID, bookID string) (string, *BookRef, int) {
	ir, n, _ := l.GetBookReference(userID, bookID, MyListKey)
	if ir != nil {
		return MyListKey, ir, n
	}

	ir, n, _ = l.GetBookReference(userID, bookID, OutListKey)
	if ir != nil {
		return OutListKey, ir, n
	}

	ir, n, _ = l.GetBookReference(userID, bookID, InListKey)
	if ir != nil {
		return InListKey, ir, n
	}

	return "", nil, 0
}

func (l *listStore) AddReference(userID, bookID, listID, foreignUserID, foreignBookID string) error {
	for i := 0; i < StoreRetries; i++ {
		list, originalJSONList, err := l.getList(userID, listID)
		if err != nil {
			return err
		}

		for _, ir := range list {
			if ir.BookID == bookID {
				return errors.New("book id already exists in list")
			}
		}

		list = append(list, &BookRef{
			BookID:        bookID,
			ForeignBookID: foreignBookID,
			ForeignUserID: foreignUserID,
		})

		ok, err := l.saveList(userID, listID, list, originalJSONList)
		if err != nil {
			return err
		}

		// If err is nil but ok is false, then something else updated the installs between the get and set above
		// so we need to try again, otherwise we can return
		if ok {
			return nil
		}
	}

	return errors.New("unable to store installation")
}

func (l *listStore) RemoveReference(userID, bookID, listID string) error {
	for i := 0; i < StoreRetries; i++ {
		list, originalJSONList, err := l.getList(userID, listID)
		if err != nil {
			return err
		}

		found := false
		for i, ir := range list {
			if ir.BookID == bookID {
				list = append(list[:i], list[i+1:]...)
				found = true
			}
		}

		if !found {
			return errors.New("cannot find book")
		}

		ok, err := l.saveList(userID, listID, list, originalJSONList)
		if err != nil {
			return err
		}

		// If err is nil but ok is false, then something else updated the installs between the get and set above
		// so we need to try again, otherwise we can return
		if ok {
			return nil
		}
	}

	return errors.New("unable to store list")
}

func (l *listStore) PopReference(userID, listID string) (*BookRef, error) {
	for i := 0; i < StoreRetries; i++ {
		list, originalJSONList, err := l.getList(userID, listID)
		if err != nil {
			return nil, err
		}

		if len(list) == 0 {
			return nil, errors.New("cannot find Book")
		}

		ir := list[0]
		list = list[1:]

		ok, err := l.saveList(userID, listID, list, originalJSONList)
		if err != nil {
			return nil, err
		}

		// If err is nil but ok is false, then something else updated the installs between the get and set above
		// so we need to try again, otherwise we can return
		if ok {
			return ir, nil
		}
	}

	return nil, errors.New("unable to store list")
}

func (l *listStore) BumpReference(userID, bookID, listID string) error {
	for i := 0; i < StoreRetries; i++ {
		list, originalJSONList, err := l.getList(userID, listID)
		if err != nil {
			return err
		}

		var i int
		var ir *BookRef

		for i, ir = range list {
			if bookID == ir.BookID {
				break
			}
		}

		if i == len(list) {
			return errors.New("cannot find Book")
		}

		newList := append([]*BookRef{ir}, list[:i]...)
		newList = append(newList, list[i+1:]...)

		ok, err := l.saveList(userID, listID, newList, originalJSONList)
		if err != nil {
			return err
		}

		// If err is nil but ok is false, then something else updated the installs between the get and set above
		// so we need to try again, otherwise we can return
		if ok {
			return nil
		}
	}

	return errors.New("unable to store list")
}

func (l *listStore) GetList(userID, listID string) ([]*BookRef, error) {
	irs, _, err := l.getList(userID, listID)
	return irs, err
}

func (l *listStore) getList(userID, listID string) ([]*BookRef, []byte, error) {
	originalJSONList, err := l.api.KVGet(listKey(userID, listID))
	if err != nil {
		return nil, nil, err
	}

	if originalJSONList == nil {
		return []*BookRef{}, originalJSONList, nil
	}

	var list []*BookRef
	jsonErr := json.Unmarshal(originalJSONList, &list)
	if jsonErr != nil {
		return l.legacyBookRef(userID, listID)
	}

	return list, originalJSONList, nil
}

func (l *listStore) saveList(userID, listID string, list []*BookRef, originalJSONList []byte) (bool, error) {
	newJSONList, jsonErr := json.Marshal(list)
	if jsonErr != nil {
		return false, jsonErr
	}

	ok, appErr := l.api.KVCompareAndSet(listKey(userID, listID), originalJSONList, newJSONList)
	if appErr != nil {
		return false, errors.New(appErr.Error())
	}

	return ok, nil
}

func (l *listStore) legacyBookRef(userID, listID string) ([]*BookRef, []byte, error) {
	originalJSONList, err := l.api.KVGet(listKey(userID, listID))
	if err != nil {
		return nil, nil, err
	}

	if originalJSONList == nil {
		return []*BookRef{}, originalJSONList, nil
	}

	var list []string
	jsonErr := json.Unmarshal(originalJSONList, &list)
	if jsonErr != nil {
		return nil, nil, jsonErr
	}

	newList := []*BookRef{}
	for _, v := range list {
		newList = append(newList, &BookRef{BookID: v})
	}

	return newList, originalJSONList, nil
}

func (p *Plugin) saveLastReminderTimeForUser(userID string) error {
	strTime := strconv.FormatInt(model.GetMillis(), 10)
	appErr := p.API.KVSet(reminderKey(userID), []byte(strTime))
	if appErr != nil {
		return errors.New(appErr.Error())
	}
	return nil
}

func (p *Plugin) getLastReminderTimeForUser(userID string) (int64, error) {
	timeBytes, appErr := p.API.KVGet(reminderKey(userID))
	if appErr != nil {
		return 0, errors.New(appErr.Error())
	}

	if timeBytes == nil {
		return 0, nil
	}

	reminderAt, err := strconv.ParseInt(string(timeBytes), 10, 64)
	if err != nil {
		return 0, err
	}

	return reminderAt, nil
}

func (p *Plugin) saveReminderPreference(userID string, preference bool) error {
	preferenceString := strconv.FormatBool(preference)
	appErr := p.API.KVSet(reminderEnabledKey(userID), []byte(preferenceString))
	if appErr != nil {
		return appErr
	}
	return nil
}

// getReminderPreference - gets user preference on reminder - default value will be true if in case any error
func (p *Plugin) getReminderPreference(userID string) bool {
	preferenceByte, appErr := p.API.KVGet(reminderEnabledKey(userID))
	if appErr != nil {
		p.API.LogError("error getting the reminder preference, err=", appErr.Error())
		return true
	}

	if preferenceByte == nil {
		p.API.LogInfo(`reminder preference is empty. Defaulting to "on"`)
		return true
	}

	preference, err := strconv.ParseBool(string(preferenceByte))
	if err != nil {
		p.API.LogError("unable to parse the reminder preference, err=", err.Error())
		return true
	}

	return preference
}

func (p *Plugin) saveAllowIncomingTaskRequestsPreference(userID string, preference bool) error {
	preferenceString := strconv.FormatBool(preference)
	appErr := p.API.KVSet(allowIncomingTaskRequestsKey(userID), []byte(preferenceString))
	if appErr != nil {
		return appErr
	}
	return nil
}

// getAllowIncomingTaskRequestsPreference - gets user preference on allowing incoming task requests from other users - default value will be true if in case any error
func (p *Plugin) getAllowIncomingTaskRequestsPreference(userID string) (bool, error) {
	preferenceByte, appErr := p.API.KVGet(allowIncomingTaskRequestsKey(userID))
	if appErr != nil {
		err := errors.Wrap(appErr, "error getting the allow incoming task requests preference")
		return true, err
	}

	if preferenceByte == nil {
		p.API.LogDebug(`allow incoming task requests is empty. Defaulting to "on"`)
		return true, nil
	}

	preference, err := strconv.ParseBool(string(preferenceByte))
	if err != nil {
		err := errors.Wrap(appErr, "unable to parse the allow incoming task requests preference")
		return true, err
	}

	return preference, nil
}
