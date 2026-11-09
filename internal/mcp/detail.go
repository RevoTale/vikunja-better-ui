package mcp

import (
	"context"

	"github.com/RevoTale/vikunja-better-ui/internal/service"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
	sdk "github.com/modelcontextprotocol/go-sdk/mcp"
)

type taskInput struct {
	TaskID           int64 `json:"taskId"`
	IncludeRelations bool  `json:"includeRelations,omitempty"`
	AttachmentPage   int64 `json:"attachmentPage,omitempty"   jsonschema:"Metadata page; omit to skip"`
}

type taskDetail struct {
	Task                 taskSummary             `json:"task"`
	Version              string                  `json:"version"`
	Timezone             string                  `json:"timezone"`
	DescriptionHTML      string                  `json:"descriptionHtml"`
	DescriptionTruncated bool                    `json:"descriptionTruncated"`
	Labels               []labelSummary          `json:"labels"`
	Reminders            []vikunja.TaskReminder  `json:"reminders"`
	NativeRepeatAfter    int64                   `json:"nativeRepeatAfter"`
	NativeRepeatMode     int                     `json:"nativeRepeatMode"`
	Rule                 *recurrenceInput        `json:"rule,omitempty"`
	Relations            []relationSummary       `json:"relations,omitempty"`
	RelationsTruncated   bool                    `json:"relationsTruncated"`
	Attachments          *vikunja.AttachmentPage `json:"attachments,omitempty"`
	MetadataTruncated    bool                    `json:"metadataTruncated"`
}

type labelSummary struct {
	ID    int64  `json:"id"`
	Title string `json:"title"`
}

type taskReference struct {
	Task     taskSummary `json:"task"`
	Version  string      `json:"version"`
	Timezone string      `json:"timezone"`
}

func mutationDetail(task vikunja.Task, timezone string, c *caller) taskReference {
	return taskReference{Task: summarize(task, c.now), Version: service.TaskVersion(task), Timezone: timezone}
}

func getTask(ctx context.Context, _ *sdk.CallToolRequest, input taskInput) (*sdk.CallToolResult, taskDetail, error) {
	c, user, err := userContext(ctx)
	if err != nil {
		return nil, taskDetail{}, err
	}
	if input.TaskID <= 0 {
		return nil, taskDetail{}, errorsForTool("A positive taskId is required.")
	}
	task, _, err := c.client.Task(ctx, input.TaskID)
	if err != nil {
		return nil, taskDetail{}, errorsForTool("Task could not be read; check its ID and access permissions.")
	}
	output := detail(task, user.Settings.Timezone, c)
	if err := expandDetail(ctx, c, input, &output); err != nil {
		return nil, taskDetail{}, err
	}
	return nil, output, nil
}

func detail(task vikunja.Task, timezone string, c *caller) taskDetail {
	const maxDescriptionRunes = 8000
	text, truncated := boundedText(task.Description, maxDescriptionRunes)
	labels := make([]labelSummary, 0, min(len(task.Labels), maxMetadataItems))
	for _, label := range task.Labels[:min(len(task.Labels), maxMetadataItems)] {
		labels = append(labels, labelSummary{ID: label.ID, Title: label.Title})
	}
	return taskDetail{Task: summarize(task, c.now), Version: service.TaskVersion(task), Timezone: timezone,
		DescriptionHTML: text, DescriptionTruncated: truncated, Labels: labels,
		Reminders:         task.Reminders[:min(len(task.Reminders), maxMetadataItems)],
		MetadataTruncated: len(task.Labels) > maxMetadataItems || len(task.Reminders) > maxMetadataItems,
		NativeRepeatAfter: task.RepeatAfter, NativeRepeatMode: task.RepeatMode, Rule: semanticRule(task)}
}

func semanticRule(task vikunja.Task) *recurrenceInput {
	rule, err := nativeRule(task)
	if err != nil || rule == nil {
		return nil
	}
	return &recurrenceInput{Interval: rule.Interval, Unit: rule.Unit, Mode: rule.Mode, KeepDueTime: rule.KeepDueTime}
}

func boundedText(value string, limit int) (string, bool) {
	count := 0
	for index := range value {
		if count == limit {
			return value[:index], true
		}
		count++
	}
	return value, false
}
