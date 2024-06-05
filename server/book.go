package main

import (
	"fmt"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
)

// Book represents a Todo issue
type Book struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description,omitempty"`
	CreateAt    int64  `json:"create_at"`
	PostID      string `json:"post_id"`
}

type ExtendedBook struct {
	Book
	ForeignUser     string `json:"user"`
	ForeignList     string `json:"list"`
	ForeignPosition int    `json:"position"`
}

func newBook(title string, description, postID string) *Book {
	return &Book{
		ID:          model.NewId(),
		CreateAt:    model.GetMillis(),
		Title:       title,
		Description: description,
		PostID:      postID,
	}
}

func booksListToString(books []*ExtendedBook) string {
	if len(books) == 0 {
		return "Nothing to do!"
	}

	str := "\n\n"

	for _, book := range books {
		createAt := time.Unix(book.CreateAt/1000, 0)
		str += fmt.Sprintf("* %s\n  * (%s)\n", book.Title, createAt.Format("January 2, 2006 at 15:04"))
	}

	return str
}
