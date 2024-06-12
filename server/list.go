package main

import (
	"fmt"

	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/pkg/errors"
)

const (
	// MyListKey is the key used to store the list of the owned todos
	MyListKey = ""
	// InListKey is the key used to store the list of received todos
	InListKey = "_in"
	// OutListKey is the key used to store the list of sent todos
	OutListKey = "_out"
)

// ListStore represents the KVStore operations for lists
type ListStore interface {
	// Book related function
	SaveBook(book *Book) error
	GetBook(bookID string) (*Book, error)
	RemoveBook(bookID string) error
	GetAndRemoveBook(bookID string) (*Book, error)

	// Book References related functions

	// AddReference creates a new BookRef with the BookID, foreignUSerID and foreignBookID, and stores it
	// on the listID for userID.
	AddReference(userID, bookID, listID, foreignUserID, foreignBookID string) error
	// RemoveReference removes the BookRef for BookID in listID for userID
	RemoveReference(userID, bookID, listID string) error
	// PopReference removes the first BookRef in listID for userID and returns it
	PopReference(userID, listID string) (*BookRef, error)
	// BumpReference moves the Book reference for BookID in listID for userID to the beginning of the list
	BumpReference(userID, bookID, listID string) error
	// GetBookReference gets the BookRef and position of the Book BookID on user userID's list listID
	GetBookReference(userID, bookID, listID string) (*BookRef, int, error)
	// GetBookListAndReference gets the Book list, BookRef and position for user userID
	GetBookListAndReference(userID, bookID string) (string, *BookRef, int)

	// GetList returns the list of BookRef in listID for userID
	GetList(userID, listID string) ([]*BookRef, error)
}

type listManager struct {
	store ListStore
	api   plugin.API
}

// NewListManager creates a new listManager
func NewListManager(api plugin.API) ListManager {
	return &listManager{
		store: NewListStore(api),
		api:   api,
	}
}

func (l *listManager) AddBook(userID, title, description, postID string) (*Book, error) {
	book := newBook(title, description, postID)

	if err := l.store.SaveBook(book); err != nil {
		return nil, err
	}

	if err := l.store.AddReference(userID, book.ID, MyListKey, "", ""); err != nil {
		if rollbackError := l.store.RemoveBook(book.ID); rollbackError != nil {
			l.api.LogError("cannot rollback book after add error, Err=", err.Error())
		}
		return nil, err
	}

	return book, nil
}

func (l *listManager) SendBook(senderID, receiverID, message, description, postID string) (string, error) {
	senderBook := newBook(message, description, postID)
	if err := l.store.SaveBook(senderBook); err != nil {
		return "", err
	}

	receiverBook := newBook(message, description, postID)
	if err := l.store.SaveBook(receiverBook); err != nil {
		if rollbackError := l.store.RemoveBook(senderBook.ID); rollbackError != nil {
			l.api.LogError("cannot rollback sender book after send error, Err=", err.Error())
		}
		return "", err
	}

	if err := l.store.AddReference(senderID, senderBook.ID, OutListKey, receiverID, receiverBook.ID); err != nil {
		if rollbackError := l.store.RemoveBook(senderBook.ID); rollbackError != nil {
			l.api.LogError("cannot rollback sender book after send error, Err=", err.Error())
		}
		if rollbackError := l.store.RemoveBook(receiverBook.ID); rollbackError != nil {
			l.api.LogError("cannot rollback receiver book after send error, Err=", err.Error())
		}
		return "", err
	}

	if err := l.store.AddReference(receiverID, receiverBook.ID, InListKey, senderID, senderBook.ID); err != nil {
		if rollbackError := l.store.RemoveBook(senderBook.ID); rollbackError != nil {
			l.api.LogError("cannot rollback sender book after send error, Err=", err.Error())
		}
		if rollbackError := l.store.RemoveBook(receiverBook.ID); rollbackError != nil {
			l.api.LogError("cannot rollback receiver book after send error ,Err=", err.Error())
		}
		if rollbackError := l.store.RemoveReference(senderID, senderBook.ID, OutListKey); rollbackError != nil {
			l.api.LogError("cannot rollback sender list after send error, Err=", err.Error())
		}
		return "", err
	}

	return receiverBook.ID, nil
}

func (l *listManager) GetBookList(userID, listID string) ([]*ExtendedBook, error) {
	irs, err := l.store.GetList(userID, listID)
	if err != nil {
		return nil, err
	}

	extendedBooks := []*ExtendedBook{}
	for _, ir := range irs {
		book, err := l.store.GetBook(ir.BookID)
		if err != nil {
			continue
		}

		extendedBook := l.extendBookInfo(book, ir)
		extendedBooks = append(extendedBooks, extendedBook)
	}

	return extendedBooks, nil
}

func (l *listManager) CompleteBook(userID, bookID string) (book *Book, foreignID string, listToUpdate string, err error) {
	bookList, ir, _ := l.store.GetBookListAndReference(userID, bookID)
	if ir == nil {
		return nil, "", bookList, fmt.Errorf("cannot find element")
	}

	if err = l.store.RemoveReference(userID, bookID, bookList); err != nil {
		return nil, "", bookList, err
	}

	book, err = l.store.GetAndRemoveBook(bookID)
	if err != nil {
		l.api.LogError("cannot remove book, Err=", err.Error())
	}

	if ir.ForeignUserID == "" {
		return book, "", bookList, nil
	}

	err = l.store.RemoveReference(ir.ForeignUserID, ir.ForeignBookID, OutListKey)
	if err != nil {
		l.api.LogError("cannot clean foreigner list after complete, Err=", err.Error())
	}

	book, err = l.store.GetAndRemoveBook(ir.ForeignBookID)
	if err != nil {
		l.api.LogError("cannot clean foreigner book after complete, Err=", err.Error())
	}

	return book, ir.ForeignUserID, bookList, nil
}

func (l *listManager) EditBook(userID, bookID, newTitle, newDescription string) (foreignUserID, list, oldTitle string, err error) {
	book, err := l.store.GetBook(bookID)
	if err != nil {
		return "", "", "", err
	}

	list, ir, _ := l.store.GetBookListAndReference(userID, bookID)
	if ir == nil {
		return "", "", "", errors.New("reference not found")
	}

	if ir.ForeignBookID != "" {
		foreignBook, foreignErr := l.store.GetBook(ir.ForeignBookID)
		if foreignErr == nil {
			oldTitle = book.Title
			foreignBook.Title = newTitle
			foreignBook.Description = newDescription
			foreignErr = l.store.SaveBook(foreignBook)
			if foreignErr != nil {
				l.api.LogError("cannot edit foreign book after edit", "error", foreignErr.Error())
			}
		}
	}

	book.Title = newTitle
	book.Description = newDescription
	err = l.store.SaveBook(book)
	if err != nil {
		return "", "", "", err
	}

	return ir.ForeignUserID, list, oldTitle, nil
}

func (l *listManager) ChangeAssignment(bookID string, userID string, sendTo string) (bookTitle, oldOwner string, err error) {
	book, err := l.store.GetBook(bookID)
	if err != nil {
		return "", "", err
	}

	list, ir, _ := l.store.GetBookListAndReference(userID, bookID)
	if ir == nil {
		return "", "", errors.New("reference not found")
	}

	if (list == InListKey) || (ir.ForeignBookID != "" && list == MyListKey) {
		return "", "", errors.New("trying to change the assignment of a book not owned")
	}

	if ir.ForeignUserID != "" {
		// Remove reference from foreign user
		foreignList, foreignIR, _ := l.store.GetBookListAndReference(ir.ForeignUserID, ir.ForeignBookID)
		if foreignIR == nil {
			return "", "", errors.New("reference not found")
		}

		if err := l.store.RemoveReference(ir.ForeignUserID, ir.ForeignBookID, foreignList); err != nil {
			return "", "", err
		}

		_, err := l.store.GetAndRemoveBook(ir.ForeignBookID)
		if err != nil {
			l.api.LogError("cannot remove book", "err", err.Error())
		}
	}

	if userID == sendTo && list == OutListKey {
		if err := l.store.RemoveReference(userID, bookID, OutListKey); err != nil {
			return "", "", err
		}

		if err := l.store.AddReference(userID, bookID, MyListKey, "", ""); err != nil {
			return "", "", err
		}

		return book.Title, ir.ForeignUserID, nil
	}

	if userID != sendTo {
		if err := l.store.RemoveReference(userID, bookID, list); err != nil {
			return "", "", err
		}
	}

	receiverBook := newBook(book.Title, book.Description, book.PostID)
	if err := l.store.SaveBook(receiverBook); err != nil {
		return "", "", err
	}

	if err := l.store.AddReference(userID, bookID, OutListKey, sendTo, receiverBook.ID); err != nil {
		return "", "", err
	}

	if err := l.store.AddReference(sendTo, receiverBook.ID, InListKey, userID, book.ID); err != nil {
		return "", "", err
	}

	return book.Title, ir.ForeignUserID, nil
}

func (l *listManager) AcceptBook(userID, bookID string) (title string, foreignUserID string, outErr error) {
	book, err := l.store.GetBook(bookID)
	if err != nil {
		return "", "", err
	}

	ir, _, err := l.store.GetBookReference(userID, bookID, InListKey)
	if err != nil {
		return "", "", err
	}
	if ir == nil {
		return "", "", fmt.Errorf("element reference not found")
	}

	err = l.store.AddReference(userID, bookID, MyListKey, ir.ForeignUserID, ir.ForeignBookID)
	if err != nil {
		return "", "", err
	}

	err = l.store.RemoveReference(userID, bookID, InListKey)
	if err != nil {
		if rollbackError := l.store.RemoveReference(userID, bookID, MyListKey); rollbackError != nil {
			l.api.LogError("cannot rollback accept operation, Err=", rollbackError.Error())
		}
		return "", "", err
	}

	return book.Title, ir.ForeignUserID, nil
}

func (l *listManager) RemoveBook(userID, bookID string) (outBook *Book, foreignID string, isSender bool, listToUpdate string, outErr error) {
	bookList, ir, _ := l.store.GetBookListAndReference(userID, bookID)
	if ir == nil {
		return nil, "", false, bookList, fmt.Errorf("cannot find element")
	}

	if err := l.store.RemoveReference(userID, bookID, bookList); err != nil {
		return nil, "", false, bookList, err
	}

	book, err := l.store.GetAndRemoveBook(bookID)
	if err != nil {
		l.api.LogError("cannot remove book, Err=", err.Error())
	}

	if ir.ForeignUserID == "" {
		return book, "", false, bookList, nil
	}

	list, _, _ := l.store.GetBookListAndReference(ir.ForeignUserID, ir.ForeignBookID)

	err = l.store.RemoveReference(ir.ForeignUserID, ir.ForeignBookID, list)
	if err != nil {
		l.api.LogError("cannot clean foreigner list after remove, Err=", err.Error())
	}

	book, err = l.store.GetAndRemoveBook(ir.ForeignBookID)
	if book != nil {
		l.api.LogError("cannot clean foreigner book after remove, Err=", err.Error())
	}

	return book, ir.ForeignUserID, list == OutListKey, bookList, nil
}

func (l *listManager) PopBook(userID string) (book *Book, foreignID string, err error) {
	ir, err := l.store.PopReference(userID, MyListKey)
	if err != nil {
		return nil, "", err
	}

	if ir == nil {
		return nil, "", errors.New("unexpected nil for book reference")
	}

	book, err = l.store.GetAndRemoveBook(ir.BookID)
	if err != nil {
		l.api.LogError("cannot remove book after pop, Err=", err.Error())
	}

	if ir.ForeignUserID == "" {
		return book, "", nil
	}

	err = l.store.RemoveReference(ir.ForeignUserID, ir.ForeignBookID, OutListKey)
	if err != nil {
		l.api.LogError("cannot clean foreigner list after pop, Err=", err.Error())
	}
	book, err = l.store.GetAndRemoveBook(ir.ForeignBookID)
	if err != nil {
		l.api.LogError("cannot clean foreigner book after pop, Err=", err.Error())
	}

	return book, ir.ForeignUserID, nil
}

func (l *listManager) BumpBook(userID, bookID string) (todoMessage string, receiver string, foreignBookID string, outErr error) {
	ir, _, err := l.store.GetBookReference(userID, bookID, OutListKey)
	if err != nil {
		return "", "", "", err
	}

	if ir == nil {
		return "", "", "", fmt.Errorf("cannot find sender book")
	}

	err = l.store.BumpReference(ir.ForeignUserID, ir.ForeignBookID, InListKey)
	if err != nil {
		return "", "", "", err
	}

	book, err := l.store.GetBook(ir.ForeignBookID)
	if err != nil {
		l.api.LogError("cannot find foreigner book after bump, Err=", err.Error())
		return "", "", "", nil
	}

	return book.Title, ir.ForeignUserID, ir.ForeignBookID, nil
}

func (l *listManager) GetUserName(userID string) string {
	user, err := l.api.GetUser(userID)
	if err != nil {
		return "Someone"
	}
	return user.Username
}

func (l *listManager) extendBookInfo(book *Book, ir *BookRef) *ExtendedBook {
	if book == nil || ir == nil {
		return nil
	}

	feBook := &ExtendedBook{
		Book: *book,
	}

	if ir.ForeignUserID == "" {
		return feBook
	}

	list, _, n := l.store.GetBookListAndReference(ir.ForeignUserID, ir.ForeignBookID)

	var listName string
	switch list {
	case MyListKey:
		listName = MyListKey
	case InListKey:
		listName = InFlag
	case OutListKey:
		listName = OutFlag
	}

	userName := l.GetUserName(ir.ForeignUserID)

	feBook.ForeignUser = userName
	feBook.ForeignList = listName
	feBook.ForeignPosition = n

	return feBook
}
