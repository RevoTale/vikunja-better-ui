package service

import (
	"net/url"
	"reflect"
	"strings"
	"testing"
)

func referencePolicy() TaskReferencePolicy {
	return TaskReferencePolicy{
		BetterUI: &url.URL{Scheme: "https", Host: "tasks.example"},
		Vikunja:  &url.URL{Scheme: "https", Host: "native.example", Path: "/vikunja"},
	}
}

func TestTaskReferencesRespectContentAndURLBoundaries(t *testing.T) {
	t.Parallel()
	for _, testCase := range []struct {
		name, content string
		want          []int64
	}{
		{"anchor", `<a href="https://tasks.example/tasks/42/discussion?x=1#comment-7">Title</a>`, []int64{42}},
		{"native prefix", `<p>See https://native.example/vikunja/tasks/3.</p>`, []int64{3}},
		{"unsupported native suffix", `https://native.example/vikunja/tasks/3/edit`, nil},
		{"relative and duplicate", `/tasks/42/edit <a href="/tasks/42">same</a> /tasks/7`, []int64{42, 7}},
		{"foreign", `https://evil.example/tasks/42 //evil.example/tasks/7`, nil},
		{"wrong prefix", `https://native.example/tasks/42 https://tasks.example/not/tasks/7`, nil},
		{"unsafe URLs", `https://user@tasks.example/tasks/42 https://tasks.example:444/tasks/7`, nil},
		{"invalid IDs", `/tasks/0 /tasks/-2 /tasks/999999999999999999999 /tasks/3/unrelated`, nil},
		{"self", `/tasks/1`, nil},
		{"code", `<pre><code>/tasks/2</code></pre><code>/tasks/3</code>`, nil},
		{"quote", `<blockquote data-comment-id="2"><a href="/tasks/3">quote</a></blockquote>`, nil},
		{"hidden", `<div hidden>/tasks/2</div><span aria-hidden="true">/tasks/3</span>`, nil},
		{"metadata", `<!-- /tasks/2 --><script>/tasks/3</script><style>/tasks/4</style>`, nil},
		{"ordinary quote", `<blockquote>/tasks/2</blockquote><p>/tasks/3</p>`, []int64{2, 3}},
		{"visible formatting", `<span style="color: red">/tasks/3</span>`, []int64{3}},
		{"hidden styling", `<span style="display: none !important">/tasks/3</span>`, nil},
		{"not a URL boundary", `foo/tasks/3 https://evil.example/tasks/4`, nil},
	} {
		t.Run(testCase.name, func(t *testing.T) {
			t.Parallel()
			got := referencePolicy().Extract(testCase.content, 1)
			if got.Limited || !reflect.DeepEqual(got.IDs, testCase.want) {
				t.Fatalf("references = %+v, want %v", got, testCase.want)
			}
		})
	}
}

func TestTaskReferencesShareAnOriginWithDifferentPaths(t *testing.T) {
	t.Parallel()
	policy := referencePolicy()
	policy.Vikunja.Host = policy.BetterUI.Host
	got := policy.Extract(`https://tasks.example/vikunja/tasks/3`, 1)
	if !reflect.DeepEqual(got.IDs, []int64{3}) {
		t.Fatalf("references = %+v", got)
	}
}

func TestTaskReferencesBoundOversizedInput(t *testing.T) {
	t.Parallel()
	got := referencePolicy().Extract(strings.Repeat("x", 512*1024+1), 1)
	if !got.Limited || len(got.IDs) != 0 {
		t.Fatalf("oversized result = %+v", got)
	}
}
