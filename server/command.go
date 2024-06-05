package main

import (
	"errors"
	"fmt"
	"regexp"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

const (
	listHeaderMessage = " PluginKhanh:\n\n"
	MyFlag            = "my"
	InFlag            = "in"
	OutFlag           = "out"
)

func getHelp() string {
	return `Available Commands:

add [message]
	Adds a Book.

	example: /book add Don't forget to be awesome

list
	Lists your Book.

list [listName]
	List your issues in certain list

	example: /book list in
	example: /book list out
	example (same as /book list): /book list my

pop
	Removes the Book issue at the top of the list.

send [user] [message]
	Sends some user a Book

	example: /book send @awesomePerson Don't forget to be awesome

settings summary [on, off]
	Sets user preference on daily reminders

	example: /book settings summary on

settings allow_incoming_task_requests [on, off]
	Allow other Mattermost users to send a task for you to accept/decline?

	example: /book settings allow_incoming_task_requests on


help
	Display usage.
`
}

func getSummarySetting(flag bool) string {
	if flag {
		return "Reminder setting is set to `on`. **You will receive daily reminders.**"
	}
	return "Reminder setting is set to `off`. **You will not receive daily reminders.**"
}
func getAllowIncomingTaskRequestsSetting(flag bool) string {
	if flag {
		return "Allow incoming task requests setting is set to `on`. **Other users can send you task request that you can accept/decline.**"
	}
	return "Allow incoming task requests setting is set to `off`. **Other users cannot send you task request. They will see a message saying you don't accept Book requests.**"
}

func getAllSettings(summaryFlag, blockIncomingFlag bool) string {
	return fmt.Sprintf(`Current Settings:

%s
%s
	`, getSummarySetting(summaryFlag), getAllowIncomingTaskRequestsSetting(blockIncomingFlag))
}

func getCommand() *model.Command {
	return &model.Command{
		Trigger:          "book",
		DisplayName:      "Book Bot",
		Description:      "Interact with your Book list.",
		AutoComplete:     true,
		AutoCompleteDesc: "Available commands: add, list, pop, send, help",
		AutoCompleteHint: "[command]",
		AutocompleteData: getAutocompleteData(),
	}
}

func (p *Plugin) postCommandResponse(args *model.CommandArgs, text string) {
	post := &model.Post{
		UserId:    p.BotUserID,
		ChannelId: args.ChannelId,
		Message:   text,
	}
	_ = p.API.SendEphemeralPost(args.UserId, post)
}

// ExecuteCommand executes a given command and returns a command response.
func (p *Plugin) ExecuteCommand(_ *plugin.Context, args *model.CommandArgs) (*model.CommandResponse, *model.AppError) {
	spaceRegExp := regexp.MustCompile(`\s+`)
	trimmedArgs := spaceRegExp.ReplaceAllString(strings.TrimSpace(args.Command), " ")
	stringArgs := strings.Split(trimmedArgs, " ")
	lengthOfArgs := len(stringArgs)
	restOfArgs := []string{}

	var handler func([]string, *model.CommandArgs) (bool, error)
	if lengthOfArgs == 1 {
		handler = p.runListCommand
		p.trackCommand(args.UserId, "")
	} else {
		command := stringArgs[1]
		if lengthOfArgs > 2 {
			restOfArgs = stringArgs[2:]
		}
		switch command {
		case "add":
			handler = p.runAddCommand
		case "list":
			handler = p.runListCommand
		case "pop":
			handler = p.runPopCommand
		case "send":
			handler = p.runSendCommand
		case "settings":
			handler = p.runSettingsCommand
		default:
			if command == "help" {
				p.trackCommand(args.UserId, command)
			} else {
				p.trackCommand(args.UserId, "not found")
			}
			p.postCommandResponse(args, getHelp())
			return &model.CommandResponse{}, nil
		}
		p.trackCommand(args.UserId, command)
	}
	isUserError, err := handler(restOfArgs, args)
	if err != nil {
		if isUserError {
			p.postCommandResponse(args, fmt.Sprintf("__Error: %s.__\n\nRun `/book help` for usage instructions.", err.Error()))
		} else {
			p.API.LogError(err.Error())
			p.postCommandResponse(args, "An unknown error occurred. Please talk to your system administrator for help.")
		}
	}

	return &model.CommandResponse{}, nil
}

func (p *Plugin) runSendCommand(args []string, extra *model.CommandArgs) (bool, error) {
	if len(args) < 2 {
		p.postCommandResponse(extra, "You must specify a user and a message.\n"+getHelp())
		return false, nil
	}

	userName := args[0]
	if args[0][0] == '@' {
		userName = args[0][1:]
	}
	receiver, appErr := p.API.GetUserByUsername(userName)
	if appErr != nil {
		p.postCommandResponse(extra, "Please, provide a valid user.\n"+getHelp())
		return false, nil
	}

	if receiver.Id == extra.UserId {
		return p.runAddCommand(args[1:], extra)
	}

	receiverAllowIncomingTaskRequestsPreference, err := p.getAllowIncomingTaskRequestsPreference(receiver.Id)
	if err != nil {
		p.API.LogError("Error when getting allow incoming task request preference, err=", err)
		receiverAllowIncomingTaskRequestsPreference = true
	}
	if !receiverAllowIncomingTaskRequestsPreference {
		p.postCommandResponse(extra, fmt.Sprintf("@%s has blocked Book requests", userName))
		return false, nil
	}

	message := strings.Join(args[1:], " ")

	receiverBookID, err := p.listManager.SendBook(extra.UserId, receiver.Id, message, "", "")
	if err != nil {
		return false, err
	}

	p.trackSendBook(extra.UserId, sourceCommand, false)

	p.sendRefreshEvent(extra.UserId, []string{OutListKey})
	p.sendRefreshEvent(receiver.Id, []string{InListKey})

	responseMessage := fmt.Sprintf("Book sent to @%s.", userName)

	senderName := p.listManager.GetUserName(extra.UserId)

	receiverMessage := fmt.Sprintf("You have received a new Book from @%s", senderName)

	p.PostBotCustomDM(receiver.Id, receiverMessage, message, receiverBookID)
	p.postCommandResponse(extra, responseMessage)
	return false, nil
}

func (p *Plugin) runAddCommand(args []string, extra *model.CommandArgs) (bool, error) {
	message := strings.Join(args, " ")

	if message == "" {
		p.postCommandResponse(extra, "Please add a task.")
		return false, nil
	}

	newBook, err := p.listManager.AddBook(extra.UserId, message, "", "")
	if err != nil {
		return false, err
	}

	p.trackAddBook(extra.UserId, sourceCommand, false)

	p.sendRefreshEvent(extra.UserId, []string{MyListKey})

	responseMessage := "Added Book."

	books, err := p.listManager.GetBookList(extra.UserId, MyListKey)
	if err != nil {
		p.API.LogError(err.Error())
		p.postCommandResponse(extra, responseMessage)
		return false, nil
	}

	// It's possible that database replication delay has resulted in the book
	// list not containing the newly-added book, so we check for that and
	// append the book manually if necessary.
	var bookIncluded bool
	for _, book := range books {
		if newBook.ID == book.ID {
			bookIncluded = true
			break
		}
	}
	if !bookIncluded {
		books = append(books, &ExtendedBook{
			Book: *newBook,
		})
	}

	responseMessage += listHeaderMessage
	responseMessage += booksListToString(books)
	p.postCommandResponse(extra, responseMessage)

	return false, nil
}

func (p *Plugin) runListCommand(args []string, extra *model.CommandArgs) (bool, error) {
	listID := MyListKey
	responseMessage := "Book List:\n\n"

	if len(args) > 0 {
		switch args[0] {
		case MyFlag:
		case InFlag:
			listID = InListKey
			responseMessage = "Received Book list:\n\n"
		case OutFlag:
			listID = OutListKey
			responseMessage = "Sent Book list:\n\n"
		default:
			p.postCommandResponse(extra, getHelp())
			return true, nil
		}
	}

	books, err := p.listManager.GetBookList(extra.UserId, listID)
	if err != nil {
		return false, err
	}

	p.sendRefreshEvent(extra.UserId, []string{MyListKey, OutListKey, InListKey})

	responseMessage += booksListToString(books)
	p.postCommandResponse(extra, responseMessage)

	return false, nil
}

func (p *Plugin) runPopCommand(_ []string, extra *model.CommandArgs) (bool, error) {
	book, foreignID, err := p.listManager.PopBook(extra.UserId)
	if err != nil {
		if err.Error() == "cannot find book" {
			p.postCommandResponse(extra, "There are no Books to pop.")
			return false, nil
		}
		return false, err
	}

	userName := p.listManager.GetUserName(extra.UserId)

	if foreignID != "" {
		p.sendRefreshEvent(foreignID, []string{OutListKey})

		title := fmt.Sprintf("@%s popped a Book you sent: %s", userName, book.Title)
		p.PostBotDM(foreignID, title)
	}

	p.sendRefreshEvent(extra.UserId, []string{MyListKey})

	responseMessage := "Removed top Book."

	replyMessage := fmt.Sprintf("@%s popped a book attached to this thread", userName)
	p.postReplyIfNeeded(book.PostID, replyMessage, book.Title)

	books, err := p.listManager.GetBookList(extra.UserId, MyListKey)
	if err != nil {
		p.API.LogError(err.Error())
		p.postCommandResponse(extra, responseMessage)
		return false, nil
	}

	responseMessage += listHeaderMessage
	responseMessage += booksListToString(books)
	p.postCommandResponse(extra, responseMessage)

	return false, nil
}

func (p *Plugin) runSettingsCommand(args []string, extra *model.CommandArgs) (bool, error) {
	const (
		on  = "on"
		off = "off"
	)
	if len(args) < 1 {
		currentSummarySetting := p.getReminderPreference(extra.UserId)
		currentAllowIncomingTaskRequestsSetting, err := p.getAllowIncomingTaskRequestsPreference(extra.UserId)
		if err != nil {
			p.API.LogError("Error when getting allow incoming task request preference, err=", err)
			currentAllowIncomingTaskRequestsSetting = true
		}
		p.postCommandResponse(extra, getAllSettings(currentSummarySetting, currentAllowIncomingTaskRequestsSetting))
		return false, nil
	}

	switch args[0] {
	case "summary":
		if len(args) < 2 {
			currentSummarySetting := p.getReminderPreference(extra.UserId)
			p.postCommandResponse(extra, getSummarySetting(currentSummarySetting))
			return false, nil
		}
		if len(args) > 2 {
			return true, errors.New("too many arguments")
		}
		var responseMessage string
		var err error

		switch args[1] {
		case on:
			err = p.saveReminderPreference(extra.UserId, true)
			responseMessage = "You will start receiving daily summaries."
		case off:
			err = p.saveReminderPreference(extra.UserId, false)
			responseMessage = "You will stop receiving daily summaries."
		default:
			responseMessage = "invalid input, allowed values for \"settings summary\" are `on` or `off`"
			return true, errors.New(responseMessage)
		}

		if err != nil {
			responseMessage = "error saving the reminder preference"
			p.API.LogDebug("runSettingsCommand: error saving the reminder preference", "error", err.Error())
			return false, errors.New(responseMessage)
		}

		p.postCommandResponse(extra, responseMessage)

	case "allow_incoming_task_requests":
		if len(args) < 2 {
			currentAllowIncomingTaskRequestsSetting, err := p.getAllowIncomingTaskRequestsPreference(extra.UserId)
			if err != nil {
				p.API.LogError("unable to parse the allow incoming task requests preference, err=", err.Error())
				currentAllowIncomingTaskRequestsSetting = true
			}
			p.postCommandResponse(extra, getAllowIncomingTaskRequestsSetting(currentAllowIncomingTaskRequestsSetting))
			return false, nil
		}
		if len(args) > 2 {
			return true, errors.New("too many arguments")
		}
		var responseMessage string
		var err error

		switch args[1] {
		case on:
			err = p.saveAllowIncomingTaskRequestsPreference(extra.UserId, true)
			responseMessage = "Other users can send task for you to accept/decline"
		case off:
			err = p.saveAllowIncomingTaskRequestsPreference(extra.UserId, false)
			responseMessage = "Other users cannot send you task request. They will see a message saying you have blocked incoming task requests"
		default:
			responseMessage = "invalid input, allowed values for \"settings allow_incoming_task_requests\" are `on` or `off`"
			return true, errors.New(responseMessage)
		}

		if err != nil {
			responseMessage = "error saving the block_incoming preference"
			p.API.LogDebug("runSettingsCommand: error saving the block_incoming preference", "error", err.Error())
			return false, errors.New(responseMessage)
		}

		p.postCommandResponse(extra, responseMessage)
	default:
		return true, fmt.Errorf("setting `%s` not recognized", args[0])
	}
	return false, nil
}

func getAutocompleteData() *model.AutocompleteData {
	book := model.NewAutocompleteData("book", "[command]", "Available commands: list, add, pop, send, settings, help")

	add := model.NewAutocompleteData("add", "[title]", "Adds a Book")
	add.AddTextArgument("E.g. be awesome", "[title]", "")
	book.AddCommand(add)

	list := model.NewAutocompleteData("list", "[name]", "Lists your Book issues")
	items := []model.AutocompleteListItem{{
		HelpText: "Received Books",
		Hint:     "(optional)",
		Item:     "in",
	}, {
		HelpText: "Sent Books",
		Hint:     "(optional)",
		Item:     "out",
	}}
	list.AddStaticListArgument("Lists your Book issues", false, items)
	book.AddCommand(list)

	pop := model.NewAutocompleteData("pop", "", "Removes the Book issue at the top of the list")
	book.AddCommand(pop)

	send := model.NewAutocompleteData("send", "[user] [book]", "Sends a Book to a specified user")
	send.AddTextArgument("Whom to send", "[@awesomePerson]", "")
	send.AddTextArgument("Book title", "[title]", "")
	book.AddCommand(send)

	settings := model.NewAutocompleteData("settings", "[setting] [on] [off]", "Sets the user settings")
	summary := model.NewAutocompleteData("summary", "[on] [off]", "Sets the summary settings")
	summaryOn := model.NewAutocompleteData("on", "", "sets the daily reminder to enable")
	summaryOff := model.NewAutocompleteData("off", "", "sets the daily reminder to disable")
	summary.AddCommand(summaryOn)
	summary.AddCommand(summaryOff)

	allowIncomingTask := model.NewAutocompleteData("allow_incoming_task_requests", "[on] [off]", "Allow other Mattermost users to send a task for you to accept/decline?")
	allowIncomingTaskOn := model.NewAutocompleteData("on", "", "Allow others to send you a Task, you can accept/decline")
	allowIncomingTaskOff := model.NewAutocompleteData("off", "", "Block others from sending you a Task, they will see a title saying you don't accept Book requests")
	allowIncomingTask.AddCommand(allowIncomingTaskOn)
	allowIncomingTask.AddCommand(allowIncomingTaskOff)

	settings.AddCommand(summary)
	settings.AddCommand(allowIncomingTask)
	book.AddCommand(settings)

	help := model.NewAutocompleteData("help", "", "Display usage")
	book.AddCommand(help)
	return book
}
