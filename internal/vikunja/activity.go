package vikunja

import (
	"context"
	"net/http"
	"net/url"
	"strconv"
	"time"
)

// ActivityTask decodes only fields needed for anonymous completion statistics.
// Descriptions, comments, attachments and relation graphs are never retained.
type ActivityTask struct {
	Done     bool      `json:"done"`
	DoneAt   time.Time `json:"done_at"`
	Priority int64     `json:"priority"`
	Labels   []Label   `json:"labels"`
}

// ActivityPage is one bounded page of completion facts.
type ActivityPage = page[ActivityTask]

// ActivityPage reads filtered completion facts without expanding rich task data.
func (client *Client) ActivityPage(ctx context.Context, input TaskQuery) (ActivityPage, error) {
	if err := validateTaskQuery(input); err != nil {
		return ActivityPage{}, err
	}
	query := url.Values{
		"page":     {strconv.FormatInt(input.Page, 10)},
		"per_page": {strconv.FormatInt(input.PerPage, 10)},
		"filter":   {input.Filter}, "filter_timezone": {input.FilterTimezone},
		"filter_include_nulls": {"false"}, "sort_by": {"id"}, "order_by": {ascendingOrder},
	}
	var result ActivityPage
	if _, err := client.doJSONWithQuery(ctx, http.MethodGet, "tasks", query, nil, "", &result); err != nil {
		return ActivityPage{}, err
	}
	if err := validatePage(
		result.Page, result.PerPage, result.Total, result.TotalPages, input.Page, input.PerPage,
	); err != nil {
		return ActivityPage{}, err
	}
	if err := validatePageItemCount(
		len(result.Items), result.Page, result.PerPage, result.Total, result.TotalPages,
	); err != nil {
		return ActivityPage{}, err
	}
	return result, nil
}
