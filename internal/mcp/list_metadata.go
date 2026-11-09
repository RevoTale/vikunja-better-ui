package mcp

import (
	"context"

	"github.com/RevoTale/vikunja-better-ui/internal/service"
	"github.com/RevoTale/vikunja-better-ui/internal/vikunja"
)

func listMetadata(ctx context.Context, client *vikunja.Client, input listInput, request *service.ListRequest) error {
	if err := validateOrdering(input); err != nil {
		return err
	}
	return loadListMetadata(ctx, client, input, request)
}

func validateOrdering(input listInput) error {
	if input.Scope != service.TaskScopeAllJobs && (input.JobSort != "" || input.JobOrder != "") {
		return errorsForTool("Job ordering requires ALL_JOBS scope.")
	}
	if input.Scope != service.TaskScopeActive && (input.Sort != "" || input.RevisitFirst) {
		return errorsForTool("Active ordering requires ACTIVE scope.")
	}
	return nil
}

func loadListMetadata(
	ctx context.Context, client *vikunja.Client, input listInput, request *service.ListRequest,
) error {
	projects, err := client.Projects(ctx)
	if err != nil {
		return errorsForTool("Cannot read projects; check token permissions.")
	}
	request.ProjectTitles = make(map[int64]string, len(projects))
	for _, project := range projects {
		request.ProjectTitles[project.ID] = project.Title
	}
	if input.ProjectID != nil {
		if _, ok := request.ProjectTitles[*input.ProjectID]; !ok {
			return errorsForTool("Project is not accessible.")
		}
	}
	jobs := jobScope(input.Scope)
	if input.LabelID == nil && !jobs {
		return nil
	}
	labels, err := client.Labels(ctx)
	if err != nil {
		return errorsForTool("Cannot read labels; check token permissions.")
	}
	if jobs {
		request.JobLabelIDs = service.ExactLabelIDs(labels, "vbu:job")
	}
	if input.LabelID != nil {
		if _, err := service.SelectTaskLabels(labels, []int64{*input.LabelID}); err != nil {
			return errorsForTool("Choose an accessible ordinary label.")
		}
	}
	return nil
}

func jobScope(scope service.TaskScope) bool {
	return scope == service.TaskScopeJobs || scope == service.TaskScopeAllJobs || scope == service.TaskScopeCompletedJobs
}
