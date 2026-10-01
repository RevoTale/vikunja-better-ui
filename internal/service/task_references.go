package service

import (
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"

	"golang.org/x/net/html"
)

const (
	maxReferenceBytes = 512 * 1024
	maxTaskReferences = 20
)

var visibleTaskURL = regexp.MustCompile(`(?:https?://|//|/tasks/)[^\s<>"']+`)

// TaskReferencePolicy trusts configured frontend URLs, never request headers or pasted origins.
type TaskReferencePolicy struct {
	BetterUI *url.URL
	Vikunja  *url.URL
}

// TaskReferences is bounded in input size and unique target count.
type TaskReferences struct {
	IDs     []int64
	Limited bool
}

// Extract reads visible links without executing or fetching HTML. It is not an HTML sanitizer.
func (policy TaskReferencePolicy) Extract(content string, self int64) TaskReferences {
	if len(content) > maxReferenceBytes {
		return TaskReferences{Limited: true}
	}
	root, err := html.Parse(strings.NewReader(content))
	if err != nil {
		return TaskReferences{Limited: true}
	}
	result := TaskReferences{}
	seen := map[int64]bool{self: true}
	add := func(raw string) {
		id := policy.taskID(raw)
		if id <= 0 || seen[id] {
			return
		}
		if len(result.IDs) == maxTaskReferences {
			result.Limited = true
			return
		}
		seen[id] = true
		result.IDs = append(result.IDs, id)
	}
	walkReferenceHTML(root, add)
	return result
}

func walkReferenceHTML(node *html.Node, add func(string)) {
	if hiddenReferenceNode(node) {
		return
	}
	if node.Type == html.ElementNode && node.Data == "a" {
		for _, attribute := range node.Attr {
			if attribute.Key == "href" {
				add(attribute.Val)
			}
		}
		// An anchor's display title is not a second link target.
		return
	}
	if node.Type == html.TextNode {
		walkReferenceText(node.Data, add)
	}
	for child := node.FirstChild; child != nil; child = child.NextSibling {
		walkReferenceHTML(child, add)
	}
}

func walkReferenceText(text string, add func(string)) {
	for _, match := range visibleTaskURL.FindAllStringIndex(text, -1) {
		if match[0] > 0 {
			previous, _ := utf8.DecodeLastRuneInString(text[:match[0]])
			if !unicode.IsSpace(previous) && !strings.ContainsRune("([{", previous) {
				continue
			}
		}
		add(strings.TrimRight(text[match[0]:match[1]], ".,;:!?)]}"))
	}
}

func hiddenReferenceNode(node *html.Node) bool {
	if node.Type != html.ElementNode {
		return false
	}
	switch node.Data {
	case "pre", "code", "script", "style", "head", "template", "noscript":
		return true
	}
	for _, attribute := range node.Attr {
		if attribute.Key == "hidden" || (attribute.Key == "style" && hiddenStyle(attribute.Val)) ||
			(attribute.Key == "aria-hidden" && attribute.Val == "true") ||
			strings.HasPrefix(attribute.Key, "data-vbu-") || attribute.Key == "data-comment-id" {
			return true
		}
	}
	return false
}

func hiddenStyle(style string) bool {
	for declaration := range strings.SplitSeq(strings.ToLower(style), ";") {
		key, value, ok := strings.Cut(declaration, ":")
		if !ok {
			continue
		}
		value = strings.TrimSpace(strings.TrimSuffix(strings.TrimSpace(value), "!important"))
		key = strings.TrimSpace(key)
		if (key == "display" && value == "none") || (key == "visibility" && value == "hidden") {
			return true
		}
	}
	return false
}

func (policy TaskReferencePolicy) taskID(raw string) int64 {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || parsed.User != nil || parsed.Opaque != "" || parsed.RawPath != "" {
		return 0
	}
	path := parsed.Path
	allowSuffix := true
	if parsed.IsAbs() || parsed.Host != "" {
		base := policy.matchOrigin(parsed)
		if base == nil {
			return 0
		}
		prefix := strings.TrimSuffix(base.Path, "/")
		path = strings.TrimPrefix(path, prefix)
		allowSuffix = base == policy.BetterUI
	}
	return referencePathID(path, allowSuffix)
}

func referencePathID(path string, allowSuffix bool) int64 {
	parts := strings.Split(strings.TrimSuffix(path, "/"), "/")
	if len(parts) < 3 || len(parts) > 4 || parts[0] != "" || parts[1] != "tasks" {
		return 0
	}
	if len(parts) == 4 && (!allowSuffix || (parts[3] != "discussion" && parts[3] != "edit")) {
		return 0
	}
	id, err := strconv.ParseInt(parts[2], 10, 64)
	if err != nil || id <= 0 || strconv.FormatInt(id, 10) != parts[2] {
		return 0
	}
	return id
}

func (policy TaskReferencePolicy) matchOrigin(target *url.URL) *url.URL {
	for _, base := range []*url.URL{policy.BetterUI, policy.Vikunja} {
		if base != nil && target.Scheme == base.Scheme && strings.EqualFold(target.Host, base.Host) &&
			strings.HasPrefix(target.Path, strings.TrimSuffix(base.Path, "/")+"/tasks/") {
			return base
		}
	}
	return nil
}
