package main

type telemetrySource string

const (
	sourceCommand telemetrySource = "command"
	sourceWebapp  telemetrySource = "webapp"
)

func (p *Plugin) trackCommand(userID, command string) {
	_ = p.tracker.TrackUserEvent("command", userID, map[string]interface{}{
		"command": command,
	})
}

func (p *Plugin) trackAddBook(userID string, source telemetrySource, attached bool) {
	_ = p.tracker.TrackUserEvent("add_book", userID, map[string]interface{}{
		"source":   source,
		"attached": attached,
	})
}

func (p *Plugin) trackSendBook(userID string, source telemetrySource, attached bool) {
	_ = p.tracker.TrackUserEvent("send_book", userID, map[string]interface{}{
		"source":   source,
		"attached": attached,
	})
}

func (p *Plugin) trackCompleteBook(userID string) {
	_ = p.tracker.TrackUserEvent("complete_book", userID, map[string]interface{}{})
}

func (p *Plugin) trackRemoveBook(userID string) {
	_ = p.tracker.TrackUserEvent("remove_book", userID, map[string]interface{}{})
}

func (p *Plugin) trackAcceptBook(userID string) {
	_ = p.tracker.TrackUserEvent("accept_book", userID, map[string]interface{}{})
}

func (p *Plugin) trackEditBook(userID string) {
	_ = p.tracker.TrackUserEvent("edit_book", userID, map[string]interface{}{})
}

func (p *Plugin) trackChangeAssignment(userID string) {
	_ = p.tracker.TrackUserEvent("change_book_assignment", userID, map[string]interface{}{})
}

func (p *Plugin) trackBumpBook(userID string) {
	_ = p.tracker.TrackUserEvent("bump_book", userID, map[string]interface{}{})
}

func (p *Plugin) trackFrontend(userID, event string, properties map[string]interface{}) {
	if properties == nil {
		properties = map[string]interface{}{}
	}
	_ = p.tracker.TrackUserEvent("frontend_"+event, userID, properties)
}

func (p *Plugin) trackDailySummary(userID string) {
	_ = p.tracker.TrackUserEvent("daily_summary_sent", userID, map[string]interface{}{})
}
