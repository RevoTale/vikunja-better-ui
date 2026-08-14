package vikunja

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"testing"
	"time"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (function roundTripFunc) RoundTrip(request *http.Request) (*http.Response, error) {
	return function(request)
}

func BenchmarkClientTaskPage(b *testing.B) {
	payload := benchmarkTaskPagePayload(b, 1000)
	baseURL, err := url.Parse("https://vikunja.test")
	if err != nil {
		b.Fatal(err)
	}
	client := NewClient(baseURL, "benchmark-token")
	client.httpClient.Transport = roundTripFunc(func(*http.Request) (*http.Response, error) {
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     http.Header{"Content-Type": []string{"application/json"}},
			Body:       io.NopCloser(bytes.NewReader(payload)),
		}, nil
	})

	b.ReportAllocs()
	b.SetBytes(int64(len(payload)))
	for b.Loop() {
		var page TaskPage
		if _, err := client.doJSON(context.Background(), http.MethodGet, "tasks", nil, "", &page); err != nil {
			b.Fatal(err)
		}
		if len(page.Items) != 1000 {
			b.Fatalf("decoded %d tasks", len(page.Items))
		}
	}
}

func benchmarkTaskPagePayload(b *testing.B, count int) []byte {
	b.Helper()
	tasks := make([]Task, count)
	for index := range tasks {
		tasks[index] = Task{
			ID:          int64(index + 1),
			Title:       "Scheduled task " + strconv.Itoa(index+1),
			Description: "Representative task description",
			DueDate:     time.Date(2026, time.August, 15, 12, index%60, 0, 0, time.UTC),
			ProjectID:   int64(index%10 + 1),
			Priority:    int64(index % 6),
			Labels: []Label{{
				ID: int64(index%5 + 1), Title: "benchmark-label", HexColor: "4f46e5",
			}},
			CreatedBy: User{ID: 1, Username: "benchmark-user"},
		}
	}
	payload, err := json.Marshal(TaskPage{
		Items: tasks, Total: int64(count), Page: 1, PerPage: int64(count), TotalPages: 1,
	})
	if err != nil {
		b.Fatal(err)
	}
	return payload
}
