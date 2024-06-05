package main

import (
	"encoding/json"
	"fmt"
	"net/http"
	"runtime/debug"
	"strconv"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/pluginapi"
	"github.com/mattermost/mattermost/server/public/pluginapi/experimental/telemetry"
	"github.com/pkg/errors"
)

const (
	// WSEventRefresh is the WebSocket event for refreshing the Book list
	WSEventRefresh = "refresh"

	// WSEventConfigUpdate is the WebSocket event to update the Book list's configurations on webapp
	WSEventConfigUpdate = "config_update"
)

// ListManager represents the logic on the lists
type ListManager interface {
	AddBook(userID, title, description, postID string) (*Book, error)
	// SendBook sends the book with the title from senderID to receiverID and returns the receiver's bookID
	SendBook(senderID, receiverID, title, description, postID string) (string, error)
	// GetBookList gets the books on listID for userID
	GetBookList(userID, listID string) ([]*ExtendedBook, error)
	// CompleteBook completes the book bookID for userID, and returns the book and the foreign ID if any
	CompleteBook(userID, bookID string) (book *Book, foreignID string, listToUpdate string, err error)
	// AcceptBook moves one the book bookID of userID from inbox to myList, and returns the title and the foreignUserID if any
	AcceptBook(userID, bookID string) (bookTitle string, foreignUserID string, err error)
	// RemoveBook removes the book bookID for userID and returns the book, the foreign ID if any and whether the user sent the book to someone else
	RemoveBook(userID, bookID string) (book *Book, foreignID string, isSender bool, listToUpdate string, err error)
	// PopBook the first element of myList for userID and returns the book and the foreign ID if any
	PopBook(userID string) (book *Book, foreignID string, err error)
	// BumpBook moves a bookID sent by userID to the top of its receiver inbox list
	BumpBook(userID string, bookID string) (bookTitle string, receiver string, foreignBookID string, err error)
	// EditBook updates the title on an book
	EditBook(userID string, bookID string, newTitle string, newDescription string) (foreignUserID string, list string, oldTitle string, err error)
	// ChangeAssignment updates an book to assign a different person
	ChangeAssignment(bookID string, userID string, sendTo string) (bookTitle, oldOwner string, err error)
	// GetUserName returns the readable username from userID
	GetUserName(userID string) string
}

// Plugin implements the interface expected by the Mattermost server to communicate between the server and plugin processes.
type Plugin struct {
	plugin.MattermostPlugin
	client *pluginapi.Client

	BotUserID string
	// configurationLock synchronizes access to the configuration.
	configurationLock sync.RWMutex

	router *mux.Router

	// configuration is the active plugin configuration. Consult getConfiguration and
	// setConfiguration for usage.
	configuration *configuration

	listManager ListManager

	telemetryClient telemetry.Client
	tracker         telemetry.Tracker
}

func (p *Plugin) OnActivate() error {
	config := p.getConfiguration()
	if err := config.IsValid(); err != nil {
		return err
	}

	if p.client == nil {
		p.client = pluginapi.NewClient(p.API, p.Driver)
	}

	botID, err := p.client.Bot.EnsureBot(&model.Bot{
		Username:    "bookbot",
		DisplayName: "Book Bot",
		Description: "Created by the Book plugin.",
	})
	if err != nil {
		return errors.Wrap(err, "failed to ensure book bot")
	}
	p.BotUserID = botID

	p.listManager = NewListManager(p.API)

	p.initializeAPI()

	p.telemetryClient, err = telemetry.NewRudderClient()
	if err != nil {
		p.API.LogWarn("telemetry client not started", "error", err.Error())
	}

	return p.API.RegisterCommand(getCommand())
}

func (p *Plugin) initializeAPI() {
	p.router = mux.NewRouter()
	p.router.Use(p.withRecovery)

	p.router.HandleFunc("/add", p.checkAuth(p.handleAdd)).Methods(http.MethodPost)
	p.router.HandleFunc("/list", p.checkAuth(p.handleList)).Methods(http.MethodGet)
	p.router.HandleFunc("/remove", p.checkAuth(p.handleRemove)).Methods(http.MethodPost)
	p.router.HandleFunc("/complete", p.checkAuth(p.handleComplete)).Methods(http.MethodPost)
	p.router.HandleFunc("/accept", p.checkAuth(p.handleAccept)).Methods(http.MethodPost)
	p.router.HandleFunc("/bump", p.checkAuth(p.handleBump)).Methods(http.MethodPost)
	p.router.HandleFunc("/telemetry", p.checkAuth(p.handleTelemetry)).Methods(http.MethodPost)
	p.router.HandleFunc("/config", p.checkAuth(p.handleConfig)).Methods(http.MethodGet)
	p.router.HandleFunc("/edit", p.checkAuth(p.handleEdit)).Methods(http.MethodPut)
	p.router.HandleFunc("/change_assignment", p.checkAuth(p.handleChangeAssignment)).Methods(http.MethodPost)

	// 404 handler
	p.router.Handle("{anything:.*}", http.NotFoundHandler())
}

func (p *Plugin) ServeHTTP(_ *plugin.Context, w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	p.router.ServeHTTP(w, r)
}

func (p *Plugin) withRecovery(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if x := recover(); x != nil {
				p.API.LogWarn("Recovered from a panic",
					"url", r.URL.String(),
					"error", x,
					"stack", string(debug.Stack()))
			}
		}()

		next.ServeHTTP(w, r)
	})
}

func (p *Plugin) checkAuth(handler http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		userID := r.Header.Get("Mattermost-User-ID")
		if userID == "" {
			http.Error(w, "Not authorized", http.StatusUnauthorized)
			return
		}

		handler(w, r)
	}
}

func (p *Plugin) handleTelemetry(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	telemetryRequest, err := GetTelemetryPayloadFromJSON(r.Body)
	if err != nil {
		p.API.LogError("Unable to get telemetry payload from JSON err=" + err.Error())
		p.handleErrorWithCode(w, http.StatusBadRequest, "Unable to get telemetry payload from JSON.", err)
		return
	}

	if err = telemetryRequest.IsValid(); err != nil {
		p.handleErrorWithCode(w, http.StatusBadRequest, "Unable to validate telemetry payload.", err)
		return
	}

	if telemetryRequest.Event != "" {
		p.trackFrontend(userID, telemetryRequest.Event, telemetryRequest.Properties)
	}
}

func (p *Plugin) handleAdd(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	addRequest, err := GetAddBookPayloadFromJSON(r.Body)
	if err != nil {
		p.API.LogError("Unable to get add book payload from JSON err=" + err.Error())
		p.handleErrorWithCode(w, http.StatusBadRequest, "Unable to get add book payload from JSON.", err)
		return
	}

	if err = addRequest.IsValid(); err != nil {
		p.handleErrorWithCode(w, http.StatusBadRequest, "Unable to validate add book payload.", err)
		return
	}

	senderName := p.listManager.GetUserName(userID)

	if addRequest.SendTo == "" {
		_, err = p.listManager.AddBook(userID, addRequest.Message, addRequest.Description, addRequest.PostID)
		if err != nil {
			p.API.LogError("Unable to add book", "error", err.Error())
			p.handleErrorWithCode(w, http.StatusInternalServerError, "Unable to add book", err)
			return
		}

		p.trackAddBook(userID, sourceWebapp, addRequest.PostID != "")

		p.sendRefreshEvent(userID, []string{MyListKey})

		replyMessage := fmt.Sprintf("@%s attached a book to this thread", senderName)

		p.postReplyIfNeeded(addRequest.PostID, replyMessage, addRequest.Message)

		return

	}

	receiver, appErr := p.API.GetUserByUsername(addRequest.SendTo)
	if appErr != nil {
		p.API.LogError("invalid username, err=" + appErr.Error())
		p.handleErrorWithCode(w, http.StatusInternalServerError, "Unable to find user", appErr)
		return
	}

	if receiver.Id == userID {
		_, err = p.listManager.AddBook(userID, addRequest.Message, addRequest.Description, addRequest.PostID)
		if err != nil {
			p.API.LogError("Unable to add book err=" + err.Error())
			p.handleErrorWithCode(w, http.StatusInternalServerError, "Unable to add book", err)
			return
		}

		p.trackAddBook(userID, sourceWebapp, addRequest.PostID != "")

		p.sendRefreshEvent(userID, []string{MyListKey})

		replyMessage := fmt.Sprintf("@%s attached a book to this thread", senderName)
		p.postReplyIfNeeded(addRequest.PostID, replyMessage, addRequest.Message)
		return
	}

	receiverAllowIncomingTaskRequestsPreference, err := p.getAllowIncomingTaskRequestsPreference(receiver.Id)
	if err != nil {
		p.API.LogError("Error when getting allow incoming task request preference, err=", err)
		receiverAllowIncomingTaskRequestsPreference = true
	}
	if !receiverAllowIncomingTaskRequestsPreference {
		replyMessage := fmt.Sprintf("@%s has blocked Book requests", receiver.Username)
		p.PostBotDM(userID, replyMessage)
		return
	}

	bookID, err := p.listManager.SendBook(userID, receiver.Id, addRequest.Message, addRequest.Description, addRequest.PostID)
	if err != nil {
		p.API.LogError("Unable to send book err=" + err.Error())
		p.handleErrorWithCode(w, http.StatusInternalServerError, "Unable to send book", err)
		return
	}

	p.trackSendBook(userID, sourceWebapp, addRequest.PostID != "")

	p.sendRefreshEvent(userID, []string{OutListKey})
	p.sendRefreshEvent(receiver.Id, []string{InListKey})

	receiverMessage := fmt.Sprintf("You have received a new Book from @%s", senderName)
	p.PostBotCustomDM(receiver.Id, receiverMessage, addRequest.Message, bookID)

	replyMessage := fmt.Sprintf("@%s sent @%s a book attached to this thread", senderName, addRequest.SendTo)
	p.postReplyIfNeeded(addRequest.PostID, replyMessage, addRequest.Message)

}

func (p *Plugin) sendConfigUpdateEvent() {
	clientConfigMap := map[string]interface{}{
		"hide_team_sidebar": p.configuration.HideTeamSidebar,
	}

	p.API.PublishWebSocketEvent(
		WSEventConfigUpdate,
		clientConfigMap,
		&model.WebsocketBroadcast{},
	)
}

func (p *Plugin) postReplyIfNeeded(postID, message, book string) {
	if postID != "" {
		err := p.ReplyPostBot(postID, message, book)
		if err != nil {
			p.API.LogError(err.Error())
		}
	}
}

func (p *Plugin) handleList(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	listInput := r.URL.Query().Get("list")
	listID := MyListKey
	switch listInput {
	case OutFlag:
		listID = OutListKey
	case InFlag:
		listID = InListKey
	}

	books, err := p.listManager.GetBookList(userID, listID)
	if err != nil {
		p.API.LogError("Unable to get books for user err=" + err.Error())
		p.handleErrorWithCode(w, http.StatusInternalServerError, "Unable to get books for user", err)
		return
	}

	if len(books) > 0 && r.URL.Query().Get("reminder") == "true" && p.getReminderPreference(userID) {
		var lastReminderAt int64
		lastReminderAt, err = p.getLastReminderTimeForUser(userID)
		if err != nil {
			p.API.LogError("Unable to send reminder err=" + err.Error())
			p.handleErrorWithCode(w, http.StatusInternalServerError, "Unable to send reminder", err)
			return
		}

		var timezone *time.Location
		offset, _ := strconv.Atoi(r.Header.Get("X-Timezone-Offset"))
		timezone = time.FixedZone("local", -60*offset)

		// Post reminder message if it's the next day and been more than an hour since the last post
		now := model.GetMillis()
		nt := time.Unix(now/1000, 0).In(timezone)
		lt := time.Unix(lastReminderAt/1000, 0).In(timezone)
		if nt.Sub(lt).Hours() >= 1 && (nt.Day() != lt.Day() || nt.Month() != lt.Month() || nt.Year() != lt.Year()) {
			p.PostBotDM(userID, "Daily Reminder:\n\n"+booksListToString(books))
			p.trackDailySummary(userID)
			err = p.saveLastReminderTimeForUser(userID)
			if err != nil {
				p.API.LogError("Unable to save last reminder for user err=" + err.Error())
			}
		}
	}

	booksJSON, err := json.Marshal(books)
	if err != nil {
		p.API.LogError("Unable marhsal books list to json err=" + err.Error())
		p.handleErrorWithCode(w, http.StatusInternalServerError, "Unable marhsal books list to json", err)
		return
	}

	_, err = w.Write(booksJSON)
	if err != nil {
		p.API.LogError("Unable to write json response while listing books err=" + err.Error())
	}
}

func (p *Plugin) handleAccept(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	acceptRequest, err := GetAcceptRequestPayloadFromJSON(r.Body)
	if err != nil {
		p.API.LogError("Unable to get accept request payload from JSON err=" + err.Error())
		p.handleErrorWithCode(w, http.StatusBadRequest, "Unable to get accept request from JSON.", err)
		return
	}

	if err = acceptRequest.IsValid(); err != nil {
		p.handleErrorWithCode(w, http.StatusBadRequest, "Unable to validate accept request payload.", err)
		return
	}

	bookMessage, sender, err := p.listManager.AcceptBook(userID, acceptRequest.ID)
	if err != nil {
		p.API.LogError("Unable to accept book err=" + err.Error())
		p.handleErrorWithCode(w, http.StatusInternalServerError, "Unable to accept book", err)
		return
	}

	p.trackAcceptBook(userID)

	p.sendRefreshEvent(userID, []string{MyListKey, InListKey})
	p.sendRefreshEvent(sender, []string{OutListKey})

	userName := p.listManager.GetUserName(userID)
	message := fmt.Sprintf("@%s accepted a Book you sent: %s", userName, bookMessage)
	p.PostBotDM(sender, message)
}

func (p *Plugin) handleComplete(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	completeRequest, err := GetCompleteBookPayloadFromJSON(r.Body)
	if err != nil {
		p.API.LogError("Unable to get complete book request payload from JSON err=" + err.Error())
		p.handleErrorWithCode(w, http.StatusBadRequest, "Unable to get complete book request from JSON.", err)
		return
	}

	if err = completeRequest.IsValid(); err != nil {
		p.handleErrorWithCode(w, http.StatusBadRequest, "Unable to validate complete book request payload.", err)
		return
	}

	book, foreignID, listToUpdate, err := p.listManager.CompleteBook(userID, completeRequest.ID)
	if err != nil {
		p.API.LogError("Unable to complete book err=" + err.Error())
		p.handleErrorWithCode(w, http.StatusInternalServerError, "Unable to complete book", err)
		return
	}

	p.sendRefreshEvent(userID, []string{listToUpdate})

	p.trackCompleteBook(userID)

	userName := p.listManager.GetUserName(userID)
	replyMessage := fmt.Sprintf("@%s completed a book attached to this thread", userName)
	p.postReplyIfNeeded(book.PostID, replyMessage, book.Title)

	if foreignID == "" {
		return
	}

	p.sendRefreshEvent(foreignID, []string{OutListKey})

	message := fmt.Sprintf("@%s completed a Book you sent: %s", userName, book.Title)
	p.PostBotDM(foreignID, message)
}

func (p *Plugin) handleRemove(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	removeRequest, err := GetRemoveBookPayloadFromJSON(r.Body)
	if err != nil {
		p.API.LogError("Unable to get remove book request payload from JSON err=" + err.Error())
		p.handleErrorWithCode(w, http.StatusBadRequest, "Unable to get remove book request from JSON.", err)
		return
	}

	if err = removeRequest.IsValid(); err != nil {
		p.handleErrorWithCode(w, http.StatusBadRequest, "Unable to validate remove book request payload.", err)
		return
	}

	book, foreignID, isSender, listToUpdate, err := p.listManager.RemoveBook(userID, removeRequest.ID)
	if err != nil {
		p.API.LogError("Unable to remove book, err=" + err.Error())
		p.handleErrorWithCode(w, http.StatusInternalServerError, "Unable to remove book", err)
		return
	}
	p.sendRefreshEvent(userID, []string{listToUpdate})

	p.trackRemoveBook(userID)

	userName := p.listManager.GetUserName(userID)
	replyMessage := fmt.Sprintf("@%s removed a book attached to this thread", userName)
	p.postReplyIfNeeded(book.PostID, replyMessage, book.Title)

	if foreignID == "" {
		return
	}

	list := InListKey

	message := fmt.Sprintf("@%s removed a Book you received: %s", userName, book.Title)
	if isSender {
		message = fmt.Sprintf("@%s declined a Book you sent: %s", userName, book.Title)
		list = OutListKey
	}

	p.sendRefreshEvent(foreignID, []string{list})

	p.PostBotDM(foreignID, message)
}

func (p *Plugin) handleBump(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	bumpRequest, err := GetBumpBookPayloadFromJSON(r.Body)
	if err != nil {
		p.API.LogError("Unable to get bump book request payload from JSON err=" + err.Error())
		p.handleErrorWithCode(w, http.StatusBadRequest, "Unable to get bump book request from JSON.", err)
		return
	}

	if err = bumpRequest.IsValid(); err != nil {
		p.handleErrorWithCode(w, http.StatusBadRequest, "Unable to validate bump request payload.", err)
		return
	}

	bookMessage, foreignUser, foreignBookID, err := p.listManager.BumpBook(userID, bumpRequest.ID)
	if err != nil {
		p.API.LogError("Unable to bump book, err=" + err.Error())
		p.handleErrorWithCode(w, http.StatusInternalServerError, "Unable to bump book", err)
		return
	}

	p.trackBumpBook(userID)

	if foreignUser == "" {
		return
	}

	p.sendRefreshEvent(foreignUser, []string{InListKey})

	userName := p.listManager.GetUserName(userID)
	message := fmt.Sprintf("@%s bumped a Book you received.", userName)
	p.PostBotCustomDM(foreignUser, message, bookMessage, foreignBookID)
}

func (p *Plugin) handleEdit(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	editRequest, err := GetEditBookPayloadFromJSON(r.Body)
	if err != nil {
		p.API.LogError("Unable to get edit book payload from JSON err=" + err.Error())
		p.handleErrorWithCode(w, http.StatusBadRequest, "Unable to get edit book payload from JSON.", err)
		return
	}

	if err = editRequest.IsValid(); err != nil {
		p.handleErrorWithCode(w, http.StatusBadRequest, "Unable to validate edit book payload.", err)
		return
	}

	foreignUserID, list, oldMessage, err := p.listManager.EditBook(userID, editRequest.ID, editRequest.Message, editRequest.Description)
	if err != nil {
		p.API.LogError("Unable to edit message: err=" + err.Error())
		p.handleErrorWithCode(w, http.StatusInternalServerError, "Unable to edit book", err)
		return
	}

	p.trackEditBook(userID)
	p.sendRefreshEvent(userID, []string{list})

	if foreignUserID != "" {
		var lists []string
		if list == OutListKey {
			lists = []string{MyListKey, InListKey}
		} else {
			lists = []string{OutListKey}
		}
		p.sendRefreshEvent(foreignUserID, lists)

		userName := p.listManager.GetUserName(userID)
		message := fmt.Sprintf("@%s modified a Book from:\n%s\nTo:\n%s", userName, oldMessage, editRequest.Message)
		p.PostBotDM(foreignUserID, message)
	}
}

func (p *Plugin) handleChangeAssignment(w http.ResponseWriter, r *http.Request) {
	userID := r.Header.Get("Mattermost-User-ID")

	changeRequest, err := GetChangeAssignmentPayloadFromJSON(r.Body)
	if err != nil {
		p.API.LogError("Unable to get change request payload from JSON err=" + err.Error())
		p.handleErrorWithCode(w, http.StatusBadRequest, "Unable to get change request from JSON.", err)
		return
	}

	if err = changeRequest.IsValid(); err != nil {
		p.handleErrorWithCode(w, http.StatusBadRequest, "Unable to validate change request payload.", err)
		return
	}

	receiver, appErr := p.API.GetUserByUsername(changeRequest.SendTo)
	if appErr != nil {
		p.API.LogError("username not valid, err=" + appErr.Error())
		p.handleErrorWithCode(w, http.StatusNotFound, "Unable to find user", appErr)
		return
	}

	bookMessage, oldOwner, err := p.listManager.ChangeAssignment(changeRequest.ID, userID, receiver.Id)
	if err != nil {
		p.API.LogError("Unable to change the assignment of an book: err=" + err.Error())
		p.handleErrorWithCode(w, http.StatusInternalServerError, "Unable to change the assignment", err)
		return
	}

	p.trackChangeAssignment(userID)

	p.sendRefreshEvent(userID, []string{MyListKey, OutListKey})

	userName := p.listManager.GetUserName(userID)
	if receiver.Id != userID {
		p.sendRefreshEvent(receiver.Id, []string{InListKey})
		receiverMessage := fmt.Sprintf("You have received a new Book from @%s", userName)
		p.PostBotCustomDM(receiver.Id, receiverMessage, bookMessage, changeRequest.ID)
	}
	if oldOwner != "" {
		p.sendRefreshEvent(oldOwner, []string{InListKey, MyListKey})
		oldOwnerMessage := fmt.Sprintf("@%s removed you from Book:\n%s", userName, bookMessage)
		p.PostBotDM(oldOwner, oldOwnerMessage)
	}
}

// API endpoint to retrieve plugin configurations
func (p *Plugin) handleConfig(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Invalid request method", http.StatusMethodNotAllowed)
		return
	}

	if p.configuration != nil {
		// retrieve client only configurations
		clientConfig := struct {
			HideTeamSidebar bool `json:"hide_team_sidebar"`
		}{
			HideTeamSidebar: p.configuration.HideTeamSidebar,
		}

		configJSON, err := json.Marshal(clientConfig)
		if err != nil {
			p.API.LogError("Unable to marshal plugin configuration to json err=" + err.Error())
			p.handleErrorWithCode(w, http.StatusInternalServerError, "Unable to marshal plugin configuration to json", err)
			return
		}

		_, err = w.Write(configJSON)
		if err != nil {
			p.API.LogError("Unable to write json response err=" + err.Error())
		}
	}
}

func (p *Plugin) sendRefreshEvent(userID string, lists []string) {
	p.API.PublishWebSocketEvent(
		WSEventRefresh,
		map[string]interface{}{"lists": lists},
		&model.WebsocketBroadcast{UserId: userID},
	)
}

func (p *Plugin) handleErrorWithCode(w http.ResponseWriter, code int, errTitle string, err error) {
	w.WriteHeader(code)
	b, _ := json.Marshal(struct {
		Error   string `json:"error"`
		Details string `json:"details"`
	}{
		Error:   errTitle,
		Details: err.Error(),
	})
	_, _ = w.Write(b)
}
