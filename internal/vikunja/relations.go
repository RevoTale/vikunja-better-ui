package vikunja

import (
	"context"
	"errors"
	"net/http"
	"strconv"
)

// RelationKind identifies a native direction from the base task to another task.
type RelationKind string

// Supported relation kinds keep child/parent directions explicit.
const (
	RelationRelated RelationKind = "related"
	RelationChild   RelationKind = "subtask"
	RelationParent  RelationKind = "parenttask"
)

// RelatedTask is a shallow summary; nested upstream relation graphs are not decoded.
type RelatedTask struct {
	ID        int64  `json:"id"`
	Title     string `json:"title"`
	Done      bool   `json:"done"`
	ProjectID int64  `json:"project_id"`
}

// TaskRelation is the native relation write and confirmation payload.
type TaskRelation struct {
	TaskID       int64        `json:"task_id,omitempty"`
	OtherTaskID  int64        `json:"other_task_id"`
	RelationKind RelationKind `json:"relation_kind"`
}

// TaskRelationState combines permissions and shallow relations in one upstream read.
type TaskRelationState struct {
	Task

	Relations map[RelationKind][]RelatedTask `json:"related_tasks"`
}

// TaskRelations reads accessible, shallow relations with bounded response handling.
func (client *Client) TaskRelations(ctx context.Context, taskID int64) (map[RelationKind][]RelatedTask, error) {
	state, err := client.TaskRelationState(ctx, taskID)
	return state.Relations, err
}

// TaskRelationState reads task identity, permissions and relations without decoding a recursive graph.
func (client *Client) TaskRelationState(ctx context.Context, taskID int64) (TaskRelationState, error) {
	if taskID <= 0 {
		return TaskRelationState{}, errors.New("task ID must be positive")
	}
	var response TaskRelationState
	path := "tasks/" + strconv.FormatInt(taskID, 10)
	if _, err := client.doJSON(ctx, http.MethodGet, path, nil, "", &response); err != nil {
		return TaskRelationState{}, err
	}
	if response.ID != taskID {
		return TaskRelationState{}, ErrRejectedResponse
	}
	count := 0
	for kind, items := range response.Relations {
		if !supportedRelation(kind) {
			delete(response.Relations, kind)
			continue
		}
		count += len(items)
		if count > maxUpstreamPageSize {
			return TaskRelationState{}, ErrRejectedResponse
		}
		for _, task := range items {
			if task.ID <= 0 || task.ID == taskID {
				return TaskRelationState{}, ErrRejectedResponse
			}
		}
	}
	return response, nil
}

// CreateTaskRelation creates both native directions once and checks the returned identity.
func (client *Client) CreateTaskRelation(ctx context.Context, taskID, otherID int64, kind RelationKind) error {
	if err := validateRelation(taskID, otherID, kind); err != nil {
		return err
	}
	input := TaskRelation{OtherTaskID: otherID, RelationKind: kind}
	var result TaskRelation
	path := "tasks/" + strconv.FormatInt(taskID, 10) + "/relations"
	if _, err := client.doJSON(ctx, http.MethodPost, path, input, "", &result); err != nil {
		return err
	}
	if result.TaskID != taskID || result.OtherTaskID != otherID || result.RelationKind != kind {
		return ErrRejectedResponse
	}
	return nil
}

// DeleteTaskRelation removes the relation and its inverse without deleting either task.
func (client *Client) DeleteTaskRelation(ctx context.Context, taskID, otherID int64, kind RelationKind) error {
	if err := validateRelation(taskID, otherID, kind); err != nil {
		return err
	}
	path := "tasks/" + strconv.FormatInt(taskID, 10) + "/relations/" + string(kind) + "/" + strconv.FormatInt(otherID, 10)
	_, err := client.doJSON(ctx, http.MethodDelete, path, nil, "", nil)
	return err
}

func supportedRelation(kind RelationKind) bool {
	return kind == RelationRelated || kind == RelationChild || kind == RelationParent
}

func validateRelation(taskID, otherID int64, kind RelationKind) error {
	if taskID <= 0 || otherID <= 0 || taskID == otherID || !supportedRelation(kind) {
		return errors.New("invalid task relation")
	}
	return nil
}
