/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import type { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
/** Active ordering; revisitFirst groups tasks carrying the ordinary Revisit label before the selected sort. */
export type ActiveWorkOrderInput = {
  revisitFirst?: boolean;
  sort?: ActiveWorkSort;
};

/** Ordering keys for Active work, applied before pagination. */
export type ActiveWorkSort =
  | 'END_ASC'
  | 'END_DESC'
  | 'LABEL_ASC'
  | 'LABEL_DESC'
  | 'START_ASC'
  | 'START_DESC';

/** Complete the displayed task with workflow/occurrence preconditions. Renewal can already have succeeded when related history needs repair. */
export type CompleteTaskInput = {
  csrfToken: string;
  expectedDueAt?: string | null | undefined;
  expectedKind: TaskKind;
  expectedRecurring?: boolean;
  taskId: string | number;
};

/** Recorded outcome of completed work; a skipped recurrence is not productive completion. */
export type CompletionOutcome =
  | 'COMPLETED'
  | 'SKIPPED';

/** Completion has been confirmed; repair-required means related metadata/history remains incomplete, not that completion should be repeated. */
export type CompletionStatus =
  | 'CONFIRMED'
  | 'CONFIRMED_REPAIR_REQUIRED';

/** Create a timed session: end = start + duration; due = end + completion window. Both intervals must be positive. Recurrence is optional. */
export type CreateJobInput = {
  completionWindowMinutes?: number;
  csrfToken: string;
  description?: string | null | undefined;
  descriptionFormat?: TaskDescriptionFormat;
  durationMinutes: number;
  labelIds?: Array<string | number> | null | undefined;
  priority: TaskPriority;
  projectId: string | number;
  recurrence?: RecurrenceInput | null | undefined;
  /** Omitted/null creates no reminders; a supplied list defines the initial native reminders. */
  reminders?: Array<TaskReminderInput> | null | undefined;
  startAt: string;
  title?: string | null | undefined;
};

/** Create one-time work with optional availability/finish and a separate deadline. No duration is inferred from a planning window. */
export type CreateOneTimeTaskInput = {
  csrfToken: string;
  description?: string | null | undefined;
  descriptionFormat?: TaskDescriptionFormat;
  dueDate?: string | null | undefined;
  dueTime?: string | null | undefined;
  labelIds?: Array<string | number> | null | undefined;
  planningWindow?: PlanningWindowInput | null | undefined;
  priority: TaskPriority;
  projectId: string | number;
  /** Omitted/null creates no reminders; a supplied list defines the initial native reminders. */
  reminders?: Array<TaskReminderInput> | null | undefined;
  /** Use server creation time for automatic availability when the plan has not ended. */
  startNow?: boolean;
  title: string;
};

/** Create a live recurring task, optionally with first-occurrence availability. Completing it renews the live task and records history. */
export type CreateRecurringTaskInput = {
  /** Start day of the first flexible occurrence, in the user's timezone. */
  availableFrom?: string | null | undefined;
  /** Optional local clock time for availability; retained on managed renewal. */
  availableFromTime?: string | null | undefined;
  csrfToken: string;
  description?: string | null | undefined;
  descriptionFormat?: TaskDescriptionFormat;
  dueTime?: string | null | undefined;
  firstDueDate: string;
  interval: number;
  keepDueTime?: boolean;
  labelIds?: Array<string | number> | null | undefined;
  mode?: RecurrenceMode;
  priority: TaskPriority;
  projectId: string | number;
  /** Omitted/null creates no reminders; a supplied list defines the initial native reminders. */
  reminders?: Array<TaskReminderInput> | null | undefined;
  /** Use server creation time for automatic availability when the first occurrence has not ended. */
  startNow?: boolean;
  title: string;
  unit: RecurrenceUnit;
};

/** Create a one-time child with optional project/priority/ordinary labels using the subtask workflow defaults. */
export type CreateSubtaskInput = {
  csrfToken: string;
  labelIds?: Array<string | number> | null | undefined;
  parentTaskId: string | number;
  priority?: TaskPriority | null | undefined;
  projectId?: string | number | null | undefined;
  title: string;
};

/** Create a discussion entry from supported rich HTML; not a task completion or a stored subtask. */
export type CreateTaskCommentInput = {
  bodyHtml: string;
  csrfToken: string;
  taskId: string | number;
};

/** A specific local day and optional filters for tasks and recurrence projections. */
export type DayInput = {
  date: string;
  labelId?: string | number | null | undefined;
  priority?: TaskPriority | null | undefined;
  projectId?: string | number | null | undefined;
};

/** Delete only the identified comment on the identified task. */
export type DeleteTaskCommentInput = {
  commentId: string | number;
  csrfToken: string;
  taskId: string | number;
};

/** Delete an active task explicitly; completed tasks/history are not editable through this workflow. */
export type DeleteTaskInput = {
  csrfToken: string;
  taskId: string | number;
};

/** Chronological comment-page ordering, independent of task ordering. */
export type DiscussionOrder =
  | 'ASC'
  | 'DESC';

/** Configured Better UI login credentials; never use a Vikunja password here. */
export type LoginInput = {
  password: string;
  username: string;
};

/** Internal metadata required by the workflow. These are not ordinary user labels or planning horizons. */
export type MarkerKind =
  | 'DATE_ONLY'
  | 'FIXED_DUE_TIME'
  | 'JOB'
  | 'RECURRENCE_HISTORY'
  | 'RECURRING_AVAILABILITY'
  | 'SKIPPED';

/** Why a bounded response cannot be treated as the complete matching result set. */
export type PageIssueCode =
  | 'RESULT_SET_TOO_LARGE'
  | 'UPSTREAM_PARTIAL';

/** Availability-to-planned-finish window, stored in native start_date/end_date. Finish must follow start; its local date cannot be after the deadline date. */
export type PlanningWindowInput = {
  /** Optional local clock time for the planned finish. Defaults to the last second of the finish day. */
  endsAtTime?: string | null | undefined;
  endsOn: string;
  /** Optional local start clock time. Defaults to midnight. */
  startsAtTime?: string | null | undefined;
  startsOn: string;
};

/** Native recurrence settings. keepDueTime requires a timed day/week rule from completion; disable it for other combinations. */
export type RecurrenceInput = {
  interval: number;
  keepDueTime?: boolean;
  mode?: RecurrenceMode;
  unit: RecurrenceUnit;
};

/** How native recurrence chooses the next occurrence when this one is completed. */
export type RecurrenceMode =
  /** Advance relative to completion; eligible timed day/week rules may retain their clock time. */
  | 'FROM_COMPLETION'
  /** Advance using the existing schedule rather than shifting the series to completion time. */
  | 'SCHEDULED_CYCLE';

/** Native supported recurrence interval unit; a month is not a fixed number of seconds. */
export type RecurrenceUnit =
  | 'DAY'
  | 'MONTH'
  | 'WEEK';

/** Remaining recovery work after a partially confirmed mutation. Use its scoped repair capability, not a fresh completion. */
export type RepairStep =
  | 'ATTACH_DATE_ONLY'
  | 'ATTACH_FIXED_DUE_TIME'
  | 'ATTACH_JOB'
  | 'ATTACH_RECURRENCE_HISTORY'
  | 'ATTACH_RECURRING_AVAILABILITY'
  | 'ATTACH_SKIPPED'
  | 'CREATE_HISTORY_SNAPSHOT'
  | 'NORMALIZE_DUE'
  | 'NORMALIZE_JOB_SCHEDULE';

/** Use the unexpired session-bound capability to finish only the authorized recovery steps. */
export type RepairTaskMetadataInput = {
  capability: string;
  csrfToken: string;
};

/** Retry a bounded explicit set of reference targets in saved task/comment content; not arbitrary metadata recovery. */
export type RepairTaskReferencesInput = {
  commentId?: string | number | null | undefined;
  csrfToken: string;
  targetIds: Array<string | number>;
  taskId: string | number;
};

/** Change the eligible live series' keep-clock-time setting, not a historical occurrence. */
export type SetRecurringKeepDueTimeInput = {
  csrfToken: string;
  enabled: boolean;
  taskId: string | number;
};

/** Add or remove one directed native relation. Self-links, cycles and conflicting parents are rejected. */
export type SetTaskRelationInput = {
  csrfToken: string;
  kind: TaskRelationKind;
  otherTaskId: string | number;
  remove?: boolean;
  taskId: string | number;
};

/** Skip only the displayed recurring occurrence. A stale expectedDueAt is rejected before renewal. */
export type SkipRecurringTaskInput = {
  csrfToken: string;
  expectedDueAt: string;
  taskId: string | number;
};

/** Accepted description encoding at creation; Markdown is converted to stored HTML. */
export type TaskDescriptionFormat =
  | 'HTML'
  | 'MARKDOWN';

/** Workflow classification from native recurrence and reserved markers, never from the length of a planning window. */
export type TaskKind =
  /** Contradictory reserved metadata; do not infer a safe mutation from the dates alone. */
  | 'INVALID'
  /** A timed session. It may also recur; inspect recurrenceRule rather than assuming JOB means one-time. */
  | 'JOB'
  /** Ordinary one-time work, optionally available within a flexible planning window. */
  | 'ONE_TIME'
  /** Flexible recurring work or its completed history snapshot; inspect recurrenceRule and isDone. */
  | 'RECURRING';

/** Fresh bounded list request. Filters combine with scope; period dates and Active ordering are scope-specific. */
export type TaskListInput = {
  /** Ordering within ACTIVE, applied before pagination. */
  activeOrder?: ActiveWorkOrderInput | null | undefined;
  /** Inclusive local calendar bounds, required only for PERIOD. */
  from?: string | null | undefined;
  labelId?: string | number | null | undefined;
  page?: number;
  pageSize?: number;
  priority?: TaskPriority | null | undefined;
  projectId?: string | number | null | undefined;
  scope: TaskScope;
  through?: string | null | undefined;
};

/** Whether creation or metadata changes were fully confirmed upstream. A repair result may already contain saved data. */
export type TaskMutationStatus =
  | 'CONFIRMED'
  | 'REPAIR_REQUIRED';

/** Native Vikunja priority. UNSET is a real priority value, not an omitted update field. */
export type TaskPriority =
  | 'DO_NOW'
  | 'HIGH'
  | 'LOW'
  | 'MEDIUM'
  | 'UNSET'
  | 'URGENT';

/** Native relationship direction relative to taskId; hierarchy is unrelated to overlapping task times. */
export type TaskRelationKind =
  | 'PARENT'
  | 'RELATED'
  | 'SUBTASK';

/** Absolute: supply exactly one of at/localAt. Relative: supply a native anchor and signed seconds; do not supply localAt. */
export type TaskReminderInput = {
  at?: string | null | undefined;
  localAt?: string | null | undefined;
  relativePeriod?: number;
  relativeTo?: string;
};

/** Named server-side membership and ordering policies. Scopes overlap; they are not task types. */
export type TaskScope =
  /** Unfinished valid tasks available at the current instant within a bounded window. Includes short windows and Jobs; use an ordinary Revisit label to select work to revisit. */
  | 'ACTIVE'
  /** Completed tasks and recorded recurrence snapshots; history is read-only through task editing. */
  | 'HISTORY'
  /** Unfinished timed Jobs, including recurring Jobs. */
  | 'JOBS'
  /** Unfinished tasks with no due date or due more than seven local calendar days from now. Not a duration classification. */
  | 'LONG_TERM'
  /** Unfinished tasks due before next month, including backlog. Use PERIOD for planned-finish membership. */
  | 'MONTH'
  /** Unfinished work with planned finish or due in inclusive from/through dates. A period containing now also includes earlier backlog. */
  | 'PERIOD'
  /** Unfinished recurring tasks, including recurring Jobs. */
  | 'RECURRING'
  /** Unfinished work whose effective finish is before tomorrow, including backlog. One-time work uses the earlier planned end or due; other kinds use due. */
  | 'TODAY'
  /** Unfinished tasks with no due date; they may still have availability and planned-finish dates. */
  | 'UNSCHEDULED'
  /** Unfinished tasks due before the next configured week boundary, including backlog. Not the projected week query. */
  | 'WEEK';

/** Use the unexpired session-bound capability from a supported completion; no arbitrary task reopening. */
export type UndoTaskCompletionInput = {
  capability: string;
  csrfToken: string;
};

/** Replace the specified comment body under upstream edit permissions. */
export type UpdateTaskCommentInput = {
  bodyHtml: string;
  commentId: string | number;
  csrfToken: string;
  taskId: string | number;
};

/** Full-form replacement, not a patch. Omitted/null dates clear their fields and omitted/null recurrence removes recurrence. Only reminders and ordinary label IDs preserve on omission/null. */
export type UpdateTaskInput = {
  csrfToken: string;
  description: string;
  dueDate?: string | null | undefined;
  dueTime?: string | null | undefined;
  endAt?: string | null | undefined;
  expectedVersion: string;
  job: boolean;
  labelIds?: Array<string | number> | null | undefined;
  /** Sets native start/end with optional clocks; one-time tasks only. When supplied, replaces startAt/endAt inputs. Does not change due. */
  planningWindow?: PlanningWindowInput | null | undefined;
  priority: TaskPriority;
  projectId: string | number;
  recurrence?: RecurrenceInput | null | undefined;
  /** Omitted preserves reminders; an empty list clears them. */
  reminders?: Array<TaskReminderInput> | null | undefined;
  startAt?: string | null | undefined;
  taskId: string | number;
  title: string;
};

/** Upload supported media to a visible task with bounded input and upstream permission checks. */
export type UploadTaskMediaInput = {
  csrfToken: string;
  file: File;
  taskId: string | number;
};

/** Week containing a local date, defaulting to the current week; optional project filter. */
export type WeekInput = {
  containing?: string | null | undefined;
  projectId?: string | number | null | undefined;
};

export type PublicActivityQueryVariables = Exact<{ [key: string]: never; }>;


export type PublicActivityQuery = { publicActivity: { total: number, timezone: string, generatedAt: string, refreshAt: string, days: Array<{ date: string, count: number, completedWithDeadline: number, completedOnTime: number }>, priorities: Array<{ priority: TaskPriority, count: number }> } | null };

export type PublicAllTimeActivityQueryVariables = Exact<{ [key: string]: never; }>;


export type PublicAllTimeActivityQuery = { publicAllTimeActivity: { total: number, timezone: string, generatedAt: string, refreshAt: string, weeks: Array<{ date: string, priorities: Array<{ priority: TaskPriority, count: number, completedWithDeadline: number, completedOnTime: number }> }>, priorities: Array<{ priority: TaskPriority, count: number }> } | null };

export type LoginMutationVariables = Exact<{
  input: LoginInput;
}>;


export type LoginMutation = { login: { session: { use12HourTime: boolean, authenticated: boolean, csrfToken: string | null, expiresAt: string | null, vikunjaUser: { id: string, username: string, timezone: string, weekStart: number, defaultProjectId: string | null } | null } } };

export type LogoutMutationVariables = Exact<{
  csrfToken: string;
}>;


export type LogoutMutation = { logout: { authenticated: boolean } };

export type AuthSessionQueryVariables = Exact<{ [key: string]: never; }>;


export type AuthSessionQuery = { session: { use12HourTime: boolean, authenticated: boolean, csrfToken: string | null, expiresAt: string | null } };

export type SessionQueryVariables = Exact<{ [key: string]: never; }>;


export type SessionQuery = { session: { use12HourTime: boolean, authenticated: boolean, csrfToken: string | null, expiresAt: string | null, vikunjaUser: { id: string, username: string, timezone: string, weekStart: number, defaultProjectId: string | null } | null } };

export type DiscussionAvatarQueryVariables = Exact<{
  username: string;
}>;


export type DiscussionAvatarQuery = { discussionAvatar: string | null };

export type DiscussionCommentFragment = { id: string, bodyHtml: string, createdAt: string, updatedAt: string, author: { id: string, username: string, name: string } };

export type DiscussionTaskLinkQueryVariables = Exact<{
  id: string | number;
}>;


export type DiscussionTaskLinkQuery = { task: { id: string, title: string } | null };

export type DiscussionCommentsQueryVariables = Exact<{
  taskId: string | number;
  page: number;
  order: DiscussionOrder;
}>;


export type DiscussionCommentsQuery = { taskComments: { page: number, pageSize: number, totalPages: number, hasMore: boolean, items: Array<{ id: string, bodyHtml: string, createdAt: string, updatedAt: string, author: { id: string, username: string, name: string } }> } };

export type DiscussionOriginalQueryVariables = Exact<{
  taskId: string | number;
  commentId: string | number;
}>;


export type DiscussionOriginalQuery = { taskComment: { id: string, bodyHtml: string, createdAt: string, updatedAt: string, author: { id: string, username: string, name: string } } };

export type CreateDiscussionCommentMutationVariables = Exact<{
  input: CreateTaskCommentInput;
}>;


export type CreateDiscussionCommentMutation = { createTaskComment: { id: string, bodyHtml: string, createdAt: string, updatedAt: string, referenceLinking: { taskId: string, commentId: string | null, failedTargetIds: Array<string>, linkedCount: number, limited: boolean } | null, author: { id: string, username: string, name: string } } };

export type UpdateDiscussionCommentMutationVariables = Exact<{
  input: UpdateTaskCommentInput;
}>;


export type UpdateDiscussionCommentMutation = { updateTaskComment: { id: string, bodyHtml: string, createdAt: string, updatedAt: string, referenceLinking: { taskId: string, commentId: string | null, failedTargetIds: Array<string>, linkedCount: number, limited: boolean } | null, author: { id: string, username: string, name: string } } };

export type DeleteDiscussionCommentMutationVariables = Exact<{
  input: DeleteTaskCommentInput;
}>;


export type DeleteDiscussionCommentMutation = { deleteTaskComment: { deletedCommentId: string } };

export type DiscussionAttachmentFragment = { id: string, taskId: string, name: string, mimeType: string, sizeBytes: number, contentUrl: string, sourceUrl: string };

export type UploadDiscussionMediaMutationVariables = Exact<{
  input: UploadTaskMediaInput;
}>;


export type UploadDiscussionMediaMutation = { uploadTaskMedia: { id: string, taskId: string, name: string, mimeType: string, sizeBytes: number, contentUrl: string, sourceUrl: string } };

export type DiscussionAttachmentsQueryVariables = Exact<{
  taskId: string | number;
  page: number;
}>;


export type DiscussionAttachmentsQuery = { taskAttachments: { page: number, totalPages: number, hasMore: boolean, items: Array<{ id: string, taskId: string, name: string, mimeType: string, sizeBytes: number, contentUrl: string, sourceUrl: string }> } };

export type ActionableTaskCountQueryVariables = Exact<{ [key: string]: never; }>;


export type ActionableTaskCountQuery = { actionableTaskCount: number };

export type CreateOneTimeTaskMutationVariables = Exact<{
  input: CreateOneTimeTaskInput;
}>;


export type CreateOneTimeTaskMutation = { createOneTimeTask: { labelError: string | null, status: TaskMutationStatus, repairCapability: string | null, missingMarkers: Array<MarkerKind>, remainingRepairSteps: Array<RepairStep>, task: { id: string, title: string, kind: TaskKind, isDone: boolean, priority: TaskPriority, dueAt: string | null, hasDueTime: boolean, isOverdue: boolean, timezone: string, referenceLinking: { taskId: string, commentId: string | null, failedTargetIds: Array<string>, linkedCount: number, limited: boolean } | null, project: { id: string, title: string, isDefault: boolean }, labels: Array<{ id: string, title: string }> } } };

export type CreateRecurringTaskMutationVariables = Exact<{
  input: CreateRecurringTaskInput;
}>;


export type CreateRecurringTaskMutation = { createRecurringTask: { labelError: string | null, status: TaskMutationStatus, repairCapability: string | null, missingMarkers: Array<MarkerKind>, remainingRepairSteps: Array<RepairStep>, task: { id: string, title: string, kind: TaskKind, isDone: boolean, priority: TaskPriority, dueAt: string | null, hasDueTime: boolean, isOverdue: boolean, timezone: string, referenceLinking: { taskId: string, commentId: string | null, failedTargetIds: Array<string>, linkedCount: number, limited: boolean } | null, project: { id: string, title: string, isDefault: boolean }, labels: Array<{ id: string, title: string }>, recurrenceRule: { interval: number, unit: RecurrenceUnit, mode: RecurrenceMode, keepDueTime: boolean } | null } } };

export type CreateJobMutationVariables = Exact<{
  input: CreateJobInput;
}>;


export type CreateJobMutation = { createJob: { labelError: string | null, status: TaskMutationStatus, repairCapability: string | null, missingMarkers: Array<MarkerKind>, remainingRepairSteps: Array<RepairStep>, task: { id: string, title: string, kind: TaskKind, isDone: boolean, priority: TaskPriority, dueAt: string | null, hasDueTime: boolean, startAt: string | null, endAt: string | null, isOverdue: boolean, timezone: string, referenceLinking: { taskId: string, commentId: string | null, failedTargetIds: Array<string>, linkedCount: number, limited: boolean } | null, project: { id: string, title: string, isDefault: boolean }, labels: Array<{ id: string, title: string }> } } };

export type RelatedTaskFieldsFragment = { id: string, title: string, isDone: boolean };

export type ReferenceLinkingResultFragment = { taskId: string, commentId: string | null, failedTargetIds: Array<string>, linkedCount: number, limited: boolean };

export type RepairTaskReferencesMutationVariables = Exact<{
  input: RepairTaskReferencesInput;
}>;


export type RepairTaskReferencesMutation = { repairTaskReferences: { taskId: string, commentId: string | null, failedTargetIds: Array<string>, linkedCount: number, limited: boolean } };

export type TaskRelationshipFieldsFragment = { taskId: string, canEdit: boolean, parents: Array<{ id: string, title: string, isDone: boolean }>, children: Array<{ id: string, title: string, isDone: boolean }>, related: Array<{ id: string, title: string, isDone: boolean }> };

export type TaskRelationshipsQueryVariables = Exact<{
  taskId: string | number;
}>;


export type TaskRelationshipsQuery = { taskRelationships: { taskId: string, canEdit: boolean, parents: Array<{ id: string, title: string, isDone: boolean }>, children: Array<{ id: string, title: string, isDone: boolean }>, related: Array<{ id: string, title: string, isDone: boolean }> } };

export type RelationCandidatesQueryVariables = Exact<{
  taskId: string | number;
  search: string;
  page: number;
}>;


export type RelationCandidatesQuery = { relationCandidates: { page: number, hasMore: boolean, items: Array<{ id: string, title: string, isDone: boolean }> } };

export type SetTaskRelationMutationVariables = Exact<{
  input: SetTaskRelationInput;
}>;


export type SetTaskRelationMutation = { setTaskRelation: { taskId: string, canEdit: boolean, parents: Array<{ id: string, title: string, isDone: boolean }>, children: Array<{ id: string, title: string, isDone: boolean }>, related: Array<{ id: string, title: string, isDone: boolean }> } };

export type CreateSubtaskMutationVariables = Exact<{
  input: CreateSubtaskInput;
}>;


export type CreateSubtaskMutation = { createSubtask: { relationError: string | null, labelError: string | null, task: { id: string, title: string, isDone: boolean } } };

export type TaskLabelsQueryVariables = Exact<{ [key: string]: never; }>;


export type TaskLabelsQuery = { taskLabels: Array<{ id: string, title: string }> };

export type CreateTaskLabelMutationVariables = Exact<{
  csrfToken: string;
  title: string;
}>;


export type CreateTaskLabelMutation = { createTaskLabel: { id: string, title: string } };

export type TaskReuseValuesQueryVariables = Exact<{
  job: boolean;
  recurring: boolean;
}>;


export type TaskReuseValuesQuery = { taskReuseValues: { taskId: string, title: string, projectId: string, priority: TaskPriority, durationMinutes: number | null, completionWindowMinutes: number | null, dueDate: string | null, dueTime: string | null, startDate: string | null, startTime: string | null, labels: Array<{ id: string, title: string }> } | null };

export type TaskDetailsQueryVariables = Exact<{
  id: string | number;
}>;


export type TaskDetailsQuery = { task: { id: string, version: string, title: string, description: string, kind: TaskKind, isDone: boolean, doneAt: string | null, completionOutcome: CompletionOutcome | null, priority: TaskPriority, dueAt: string | null, hasDueTime: boolean, startAt: string | null, endAt: string | null, isOverdue: boolean, timezone: string, reminders: Array<{ at: string | null, relativeTo: string, relativePeriod: number }>, project: { id: string, title: string, isDefault: boolean }, recurrenceRule: { interval: number, unit: RecurrenceUnit, mode: RecurrenceMode, keepDueTime: boolean } | null, labels: Array<{ id: string, title: string }> } | null };

export type UpdateTaskMutationVariables = Exact<{
  input: UpdateTaskInput;
}>;


export type UpdateTaskMutation = { updateTask: { id: string, version: string, referenceLinking: { taskId: string, commentId: string | null, failedTargetIds: Array<string>, linkedCount: number, limited: boolean } | null } };

export type SkipRecurringTaskMutationVariables = Exact<{
  input: SkipRecurringTaskInput;
}>;


export type SkipRecurringTaskMutation = { skipRecurringTask: { status: CompletionStatus, repairCapability: string | null, missingMarkers: Array<MarkerKind>, remainingRepairSteps: Array<RepairStep>, completedTask: { id: string, completionOutcome: CompletionOutcome | null } | null, nextOccurrence: { id: string, dueAt: string | null } | null } };

export type SetRecurringKeepDueTimeMutationVariables = Exact<{
  input: SetRecurringKeepDueTimeInput;
}>;


export type SetRecurringKeepDueTimeMutation = { setRecurringKeepDueTime: { status: TaskMutationStatus, repairCapability: string | null, missingMarkers: Array<MarkerKind>, remainingRepairSteps: Array<RepairStep>, task: { id: string, kind: TaskKind, dueAt: string | null, hasDueTime: boolean, recurrenceRule: { interval: number, unit: RecurrenceUnit, mode: RecurrenceMode, keepDueTime: boolean } | null } } };

export type DeleteTaskMutationVariables = Exact<{
  input: DeleteTaskInput;
}>;


export type DeleteTaskMutation = { deleteTask: { deletedTaskId: string } };

export type TaskDiagnosticsQueryVariables = Exact<{
  id: string | number;
}>;


export type TaskDiagnosticsQuery = { taskDiagnostics: { id: string, projectId: string, title: string, kind: TaskKind, isDone: boolean, doneAt: string | null, dueAt: string | null, startAt: string | null, endAt: string | null, priority: TaskPriority, createdAt: string, updatedAt: string, maxPermission: string | null, recurrenceRule: { interval: number, unit: RecurrenceUnit, mode: RecurrenceMode, keepDueTime: boolean } | null, labels: Array<{ id: string, title: string }>, creator: { id: string, username: string, name: string } | null } | null };

export type ProjectsQueryVariables = Exact<{ [key: string]: never; }>;


export type ProjectsQuery = { projects: { items: Array<{ id: string, title: string, isDefault: boolean }> } };

export type WeekQueryVariables = Exact<{
  input: WeekInput;
}>;


export type WeekQuery = { week: { startsOn: string, endsOn: string, isComplete: boolean, days: Array<{ date: string, tasks: Array<{ commentCount: number | null, id: string, title: string, kind: TaskKind, isDone: boolean, doneAt: string | null, completionOutcome: CompletionOutcome | null, priority: TaskPriority, dueAt: string | null, hasDueTime: boolean, startAt: string | null, endAt: string | null, isOverdue: boolean, timezone: string, project: { id: string, title: string, isDefault: boolean }, recurrenceRule: { interval: number, unit: RecurrenceUnit, mode: RecurrenceMode, keepDueTime: boolean } | null, labels: Array<{ id: string, title: string }> }>, projections: Array<{ startAt: string | null, endAt: string | null, dueAt: string, hasDueTime: boolean, sourceTask: { commentCount: number | null, id: string, title: string, kind: TaskKind, isDone: boolean, doneAt: string | null, completionOutcome: CompletionOutcome | null, priority: TaskPriority, dueAt: string | null, hasDueTime: boolean, startAt: string | null, endAt: string | null, isOverdue: boolean, timezone: string, project: { id: string, title: string, isDefault: boolean }, recurrenceRule: { interval: number, unit: RecurrenceUnit, mode: RecurrenceMode, keepDueTime: boolean } | null, labels: Array<{ id: string, title: string }> } }> }>, issues: Array<{ code: PageIssueCode, message: string, projectId: string | null }> } };

export type DayQueryVariables = Exact<{
  input: DayInput;
}>;


export type DayQuery = { day: { isComplete: boolean, day: { date: string, tasks: Array<{ commentCount: number | null, id: string, title: string, kind: TaskKind, isDone: boolean, doneAt: string | null, completionOutcome: CompletionOutcome | null, priority: TaskPriority, dueAt: string | null, hasDueTime: boolean, startAt: string | null, endAt: string | null, isOverdue: boolean, timezone: string, project: { id: string, title: string, isDefault: boolean }, recurrenceRule: { interval: number, unit: RecurrenceUnit, mode: RecurrenceMode, keepDueTime: boolean } | null, labels: Array<{ id: string, title: string }> }>, projections: Array<{ startAt: string | null, endAt: string | null, dueAt: string, hasDueTime: boolean, sourceTask: { commentCount: number | null, id: string, title: string, kind: TaskKind, isDone: boolean, doneAt: string | null, completionOutcome: CompletionOutcome | null, priority: TaskPriority, dueAt: string | null, hasDueTime: boolean, startAt: string | null, endAt: string | null, isOverdue: boolean, timezone: string, project: { id: string, title: string, isDefault: boolean }, recurrenceRule: { interval: number, unit: RecurrenceUnit, mode: RecurrenceMode, keepDueTime: boolean } | null, labels: Array<{ id: string, title: string }> } }> }, issues: Array<{ code: PageIssueCode, message: string, projectId: string | null }> } };

export type WeekTaskFragment = { commentCount: number | null, id: string, title: string, kind: TaskKind, isDone: boolean, doneAt: string | null, completionOutcome: CompletionOutcome | null, priority: TaskPriority, dueAt: string | null, hasDueTime: boolean, startAt: string | null, endAt: string | null, isOverdue: boolean, timezone: string, project: { id: string, title: string, isDefault: boolean }, recurrenceRule: { interval: number, unit: RecurrenceUnit, mode: RecurrenceMode, keepDueTime: boolean } | null, labels: Array<{ id: string, title: string }> };

export type TaskListQueryVariables = Exact<{
  input: TaskListInput;
}>;


export type TaskListQuery = { tasks: { page: number, pageSize: number, totalItems: number, totalPages: number, hasMore: boolean, isComplete: boolean, items: Array<{ commentCount: number | null, id: string, title: string, kind: TaskKind, isDone: boolean, doneAt: string | null, completionOutcome: CompletionOutcome | null, priority: TaskPriority, dueAt: string | null, hasDueTime: boolean, startAt: string | null, endAt: string | null, isOverdue: boolean, timezone: string, project: { id: string, title: string, isDefault: boolean }, recurrenceRule: { interval: number, unit: RecurrenceUnit, mode: RecurrenceMode, keepDueTime: boolean } | null, labels: Array<{ id: string, title: string }> }>, issues: Array<{ code: PageIssueCode, message: string, projectId: string | null }> } };

export type CompleteTaskMutationVariables = Exact<{
  input: CompleteTaskInput;
}>;


export type CompleteTaskMutation = { completeTask: { status: CompletionStatus, undoUntil: string | null, undoCapability: string | null, repairCapability: string | null, missingMarkers: Array<MarkerKind>, remainingRepairSteps: Array<RepairStep>, completedTask: { id: string, title: string, description: string, kind: TaskKind, isDone: boolean, doneAt: string | null, priority: TaskPriority, dueAt: string | null, hasDueTime: boolean, startAt: string | null, endAt: string | null, isOverdue: boolean, timezone: string, project: { id: string, title: string, isDefault: boolean }, recurrenceRule: { interval: number, unit: RecurrenceUnit, mode: RecurrenceMode, keepDueTime: boolean } | null, labels: Array<{ id: string, title: string }> } | null, nextOccurrence: { id: string, title: string, description: string, kind: TaskKind, isDone: boolean, doneAt: string | null, priority: TaskPriority, dueAt: string | null, hasDueTime: boolean, startAt: string | null, endAt: string | null, isOverdue: boolean, timezone: string, project: { id: string, title: string, isDefault: boolean }, recurrenceRule: { interval: number, unit: RecurrenceUnit, mode: RecurrenceMode, keepDueTime: boolean } | null, labels: Array<{ id: string, title: string }> } | null } };

export type UndoTaskCompletionMutationVariables = Exact<{
  input: UndoTaskCompletionInput;
}>;


export type UndoTaskCompletionMutation = { undoTaskCompletion: { status: TaskMutationStatus, repairCapability: string | null, missingMarkers: Array<MarkerKind>, remainingRepairSteps: Array<RepairStep>, task: { id: string, title: string, description: string, kind: TaskKind, isDone: boolean, doneAt: string | null, priority: TaskPriority, dueAt: string | null, hasDueTime: boolean, startAt: string | null, endAt: string | null, isOverdue: boolean, timezone: string, project: { id: string, title: string, isDefault: boolean }, recurrenceRule: { interval: number, unit: RecurrenceUnit, mode: RecurrenceMode, keepDueTime: boolean } | null, labels: Array<{ id: string, title: string }> } } };

export type RepairTaskMetadataMutationVariables = Exact<{
  input: RepairTaskMetadataInput;
}>;


export type RepairTaskMetadataMutation = { repairTaskMetadata: { status: TaskMutationStatus, repairCapability: string | null, missingMarkers: Array<MarkerKind>, remainingRepairSteps: Array<RepairStep>, task: { id: string, title: string, kind: TaskKind, isDone: boolean, priority: TaskPriority, dueAt: string | null, hasDueTime: boolean, isOverdue: boolean, timezone: string, project: { id: string, title: string, isDefault: boolean }, labels: Array<{ id: string, title: string }> } } };

export const DiscussionCommentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiscussionComment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TaskComment"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"bodyHtml"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]} as unknown as DocumentNode<DiscussionCommentFragment, unknown>;
export const DiscussionAttachmentFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiscussionAttachment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TaskAttachment"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"taskId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"mimeType"}},{"kind":"Field","name":{"kind":"Name","value":"sizeBytes"}},{"kind":"Field","name":{"kind":"Name","value":"contentUrl"}},{"kind":"Field","name":{"kind":"Name","value":"sourceUrl"}}]}}]} as unknown as DocumentNode<DiscussionAttachmentFragment, unknown>;
export const ReferenceLinkingResultFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ReferenceLinkingResult"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TaskReferenceResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"taskId"}},{"kind":"Field","name":{"kind":"Name","value":"commentId"}},{"kind":"Field","name":{"kind":"Name","value":"failedTargetIds"}},{"kind":"Field","name":{"kind":"Name","value":"linkedCount"}},{"kind":"Field","name":{"kind":"Name","value":"limited"}}]}}]} as unknown as DocumentNode<ReferenceLinkingResultFragment, unknown>;
export const RelatedTaskFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"RelatedTaskFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"RelatedTask"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"isDone"}}]}}]} as unknown as DocumentNode<RelatedTaskFieldsFragment, unknown>;
export const TaskRelationshipFieldsFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TaskRelationshipFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TaskRelationships"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"taskId"}},{"kind":"Field","name":{"kind":"Name","value":"canEdit"}},{"kind":"Field","name":{"kind":"Name","value":"parents"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"RelatedTaskFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"children"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"RelatedTaskFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"related"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"RelatedTaskFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"RelatedTaskFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"RelatedTask"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"isDone"}}]}}]} as unknown as DocumentNode<TaskRelationshipFieldsFragment, unknown>;
export const WeekTaskFragmentDoc = {"kind":"Document","definitions":[{"kind":"FragmentDefinition","name":{"kind":"Name","value":"WeekTask"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Task"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"commentCount"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"isDone"}},{"kind":"Field","name":{"kind":"Name","value":"doneAt"}},{"kind":"Field","name":{"kind":"Name","value":"completionOutcome"}},{"kind":"Field","name":{"kind":"Name","value":"project"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"isDefault"}}]}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"dueAt"}},{"kind":"Field","name":{"kind":"Name","value":"hasDueTime"}},{"kind":"Field","name":{"kind":"Name","value":"startAt"}},{"kind":"Field","name":{"kind":"Name","value":"endAt"}},{"kind":"Field","name":{"kind":"Name","value":"recurrenceRule"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"interval"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"mode"}},{"kind":"Field","name":{"kind":"Name","value":"keepDueTime"}}]}},{"kind":"Field","name":{"kind":"Name","value":"labels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}},{"kind":"Field","name":{"kind":"Name","value":"isOverdue"}},{"kind":"Field","name":{"kind":"Name","value":"timezone"}}]}}]} as unknown as DocumentNode<WeekTaskFragment, unknown>;
export const PublicActivityDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PublicActivity"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"publicActivity"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"days"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"count"}},{"kind":"Field","name":{"kind":"Name","value":"completedWithDeadline"}},{"kind":"Field","name":{"kind":"Name","value":"completedOnTime"}}]}},{"kind":"Field","name":{"kind":"Name","value":"priorities"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"timezone"}},{"kind":"Field","name":{"kind":"Name","value":"generatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"refreshAt"}}]}}]}}]} as unknown as DocumentNode<PublicActivityQuery, PublicActivityQueryVariables>;
export const PublicAllTimeActivityDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"PublicAllTimeActivity"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"publicAllTimeActivity"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"weeks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"priorities"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"count"}},{"kind":"Field","name":{"kind":"Name","value":"completedWithDeadline"}},{"kind":"Field","name":{"kind":"Name","value":"completedOnTime"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"priorities"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"count"}}]}},{"kind":"Field","name":{"kind":"Name","value":"total"}},{"kind":"Field","name":{"kind":"Name","value":"timezone"}},{"kind":"Field","name":{"kind":"Name","value":"generatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"refreshAt"}}]}}]}}]} as unknown as DocumentNode<PublicAllTimeActivityQuery, PublicAllTimeActivityQueryVariables>;
export const LoginDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"Login"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LoginInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"login"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"session"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"use12HourTime"}},{"kind":"Field","name":{"kind":"Name","value":"authenticated"}},{"kind":"Field","name":{"kind":"Name","value":"csrfToken"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"vikunjaUser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"timezone"}},{"kind":"Field","name":{"kind":"Name","value":"weekStart"}},{"kind":"Field","name":{"kind":"Name","value":"defaultProjectId"}}]}}]}}]}}]}}]} as unknown as DocumentNode<LoginMutation, LoginMutationVariables>;
export const LogoutDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"Logout"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"csrfToken"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"logout"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"csrfToken"},"value":{"kind":"Variable","name":{"kind":"Name","value":"csrfToken"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"authenticated"}}]}}]}}]} as unknown as DocumentNode<LogoutMutation, LogoutMutationVariables>;
export const AuthSessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"AuthSession"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"session"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"use12HourTime"}},{"kind":"Field","name":{"kind":"Name","value":"authenticated"}},{"kind":"Field","name":{"kind":"Name","value":"csrfToken"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}}]}}]}}]} as unknown as DocumentNode<AuthSessionQuery, AuthSessionQueryVariables>;
export const SessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Session"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"session"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"use12HourTime"}},{"kind":"Field","name":{"kind":"Name","value":"authenticated"}},{"kind":"Field","name":{"kind":"Name","value":"csrfToken"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"vikunjaUser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"timezone"}},{"kind":"Field","name":{"kind":"Name","value":"weekStart"}},{"kind":"Field","name":{"kind":"Name","value":"defaultProjectId"}}]}}]}}]}}]} as unknown as DocumentNode<SessionQuery, SessionQueryVariables>;
export const DiscussionAvatarDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DiscussionAvatar"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"username"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"discussionAvatar"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"username"},"value":{"kind":"Variable","name":{"kind":"Name","value":"username"}}}]}]}}]} as unknown as DocumentNode<DiscussionAvatarQuery, DiscussionAvatarQueryVariables>;
export const DiscussionTaskLinkDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DiscussionTaskLink"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"task"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}}]}}]} as unknown as DocumentNode<DiscussionTaskLinkQuery, DiscussionTaskLinkQueryVariables>;
export const DiscussionCommentsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DiscussionComments"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"taskId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"page"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"order"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"DiscussionOrder"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"taskComments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"taskId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"taskId"}}},{"kind":"Argument","name":{"kind":"Name","value":"page"},"value":{"kind":"Variable","name":{"kind":"Name","value":"page"}}},{"kind":"Argument","name":{"kind":"Name","value":"order"},"value":{"kind":"Variable","name":{"kind":"Name","value":"order"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DiscussionComment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"page"}},{"kind":"Field","name":{"kind":"Name","value":"pageSize"}},{"kind":"Field","name":{"kind":"Name","value":"totalPages"}},{"kind":"Field","name":{"kind":"Name","value":"hasMore"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiscussionComment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TaskComment"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"bodyHtml"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]} as unknown as DocumentNode<DiscussionCommentsQuery, DiscussionCommentsQueryVariables>;
export const DiscussionOriginalDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DiscussionOriginal"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"taskId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"commentId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"taskComment"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"taskId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"taskId"}}},{"kind":"Argument","name":{"kind":"Name","value":"commentId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"commentId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DiscussionComment"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiscussionComment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TaskComment"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"bodyHtml"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]} as unknown as DocumentNode<DiscussionOriginalQuery, DiscussionOriginalQueryVariables>;
export const CreateDiscussionCommentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateDiscussionComment"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateTaskCommentInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createTaskComment"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"referenceLinking"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ReferenceLinkingResult"}}]}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"DiscussionComment"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ReferenceLinkingResult"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TaskReferenceResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"taskId"}},{"kind":"Field","name":{"kind":"Name","value":"commentId"}},{"kind":"Field","name":{"kind":"Name","value":"failedTargetIds"}},{"kind":"Field","name":{"kind":"Name","value":"linkedCount"}},{"kind":"Field","name":{"kind":"Name","value":"limited"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiscussionComment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TaskComment"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"bodyHtml"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]} as unknown as DocumentNode<CreateDiscussionCommentMutation, CreateDiscussionCommentMutationVariables>;
export const UpdateDiscussionCommentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateDiscussionComment"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateTaskCommentInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateTaskComment"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"referenceLinking"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ReferenceLinkingResult"}}]}},{"kind":"FragmentSpread","name":{"kind":"Name","value":"DiscussionComment"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ReferenceLinkingResult"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TaskReferenceResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"taskId"}},{"kind":"Field","name":{"kind":"Name","value":"commentId"}},{"kind":"Field","name":{"kind":"Name","value":"failedTargetIds"}},{"kind":"Field","name":{"kind":"Name","value":"linkedCount"}},{"kind":"Field","name":{"kind":"Name","value":"limited"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiscussionComment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TaskComment"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"bodyHtml"}},{"kind":"Field","name":{"kind":"Name","value":"author"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}}]}}]} as unknown as DocumentNode<UpdateDiscussionCommentMutation, UpdateDiscussionCommentMutationVariables>;
export const DeleteDiscussionCommentDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteDiscussionComment"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"DeleteTaskCommentInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteTaskComment"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deletedCommentId"}}]}}]}}]} as unknown as DocumentNode<DeleteDiscussionCommentMutation, DeleteDiscussionCommentMutationVariables>;
export const UploadDiscussionMediaDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UploadDiscussionMedia"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UploadTaskMediaInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"uploadTaskMedia"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DiscussionAttachment"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiscussionAttachment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TaskAttachment"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"taskId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"mimeType"}},{"kind":"Field","name":{"kind":"Name","value":"sizeBytes"}},{"kind":"Field","name":{"kind":"Name","value":"contentUrl"}},{"kind":"Field","name":{"kind":"Name","value":"sourceUrl"}}]}}]} as unknown as DocumentNode<UploadDiscussionMediaMutation, UploadDiscussionMediaMutationVariables>;
export const DiscussionAttachmentsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"DiscussionAttachments"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"taskId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"page"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"taskAttachments"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"taskId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"taskId"}}},{"kind":"Argument","name":{"kind":"Name","value":"page"},"value":{"kind":"Variable","name":{"kind":"Name","value":"page"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"DiscussionAttachment"}}]}},{"kind":"Field","name":{"kind":"Name","value":"page"}},{"kind":"Field","name":{"kind":"Name","value":"totalPages"}},{"kind":"Field","name":{"kind":"Name","value":"hasMore"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"DiscussionAttachment"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TaskAttachment"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"taskId"}},{"kind":"Field","name":{"kind":"Name","value":"name"}},{"kind":"Field","name":{"kind":"Name","value":"mimeType"}},{"kind":"Field","name":{"kind":"Name","value":"sizeBytes"}},{"kind":"Field","name":{"kind":"Name","value":"contentUrl"}},{"kind":"Field","name":{"kind":"Name","value":"sourceUrl"}}]}}]} as unknown as DocumentNode<DiscussionAttachmentsQuery, DiscussionAttachmentsQueryVariables>;
export const ActionableTaskCountDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"ActionableTaskCount"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","alias":{"kind":"Name","value":"actionableTaskCount"},"name":{"kind":"Name","value":"todayTaskCount"}}]}}]} as unknown as DocumentNode<ActionableTaskCountQuery, ActionableTaskCountQueryVariables>;
export const CreateOneTimeTaskDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateOneTimeTask"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateOneTimeTaskInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createOneTimeTask"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"labelError"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"task"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"referenceLinking"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ReferenceLinkingResult"}}]}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"isDone"}},{"kind":"Field","name":{"kind":"Name","value":"project"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"isDefault"}}]}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"dueAt"}},{"kind":"Field","name":{"kind":"Name","value":"hasDueTime"}},{"kind":"Field","name":{"kind":"Name","value":"isOverdue"}},{"kind":"Field","name":{"kind":"Name","value":"timezone"}},{"kind":"Field","name":{"kind":"Name","value":"labels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"repairCapability"}},{"kind":"Field","name":{"kind":"Name","value":"missingMarkers"}},{"kind":"Field","name":{"kind":"Name","value":"remainingRepairSteps"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ReferenceLinkingResult"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TaskReferenceResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"taskId"}},{"kind":"Field","name":{"kind":"Name","value":"commentId"}},{"kind":"Field","name":{"kind":"Name","value":"failedTargetIds"}},{"kind":"Field","name":{"kind":"Name","value":"linkedCount"}},{"kind":"Field","name":{"kind":"Name","value":"limited"}}]}}]} as unknown as DocumentNode<CreateOneTimeTaskMutation, CreateOneTimeTaskMutationVariables>;
export const CreateRecurringTaskDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateRecurringTask"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateRecurringTaskInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createRecurringTask"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"labelError"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"task"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"referenceLinking"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ReferenceLinkingResult"}}]}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"isDone"}},{"kind":"Field","name":{"kind":"Name","value":"project"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"isDefault"}}]}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"dueAt"}},{"kind":"Field","name":{"kind":"Name","value":"hasDueTime"}},{"kind":"Field","name":{"kind":"Name","value":"isOverdue"}},{"kind":"Field","name":{"kind":"Name","value":"timezone"}},{"kind":"Field","name":{"kind":"Name","value":"labels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}},{"kind":"Field","name":{"kind":"Name","value":"recurrenceRule"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"interval"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"mode"}},{"kind":"Field","name":{"kind":"Name","value":"keepDueTime"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"repairCapability"}},{"kind":"Field","name":{"kind":"Name","value":"missingMarkers"}},{"kind":"Field","name":{"kind":"Name","value":"remainingRepairSteps"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ReferenceLinkingResult"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TaskReferenceResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"taskId"}},{"kind":"Field","name":{"kind":"Name","value":"commentId"}},{"kind":"Field","name":{"kind":"Name","value":"failedTargetIds"}},{"kind":"Field","name":{"kind":"Name","value":"linkedCount"}},{"kind":"Field","name":{"kind":"Name","value":"limited"}}]}}]} as unknown as DocumentNode<CreateRecurringTaskMutation, CreateRecurringTaskMutationVariables>;
export const CreateJobDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateJob"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateJobInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createJob"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"labelError"}},{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"task"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"referenceLinking"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ReferenceLinkingResult"}}]}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"isDone"}},{"kind":"Field","name":{"kind":"Name","value":"project"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"isDefault"}}]}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"dueAt"}},{"kind":"Field","name":{"kind":"Name","value":"hasDueTime"}},{"kind":"Field","name":{"kind":"Name","value":"startAt"}},{"kind":"Field","name":{"kind":"Name","value":"endAt"}},{"kind":"Field","name":{"kind":"Name","value":"isOverdue"}},{"kind":"Field","name":{"kind":"Name","value":"timezone"}},{"kind":"Field","name":{"kind":"Name","value":"labels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"repairCapability"}},{"kind":"Field","name":{"kind":"Name","value":"missingMarkers"}},{"kind":"Field","name":{"kind":"Name","value":"remainingRepairSteps"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ReferenceLinkingResult"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TaskReferenceResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"taskId"}},{"kind":"Field","name":{"kind":"Name","value":"commentId"}},{"kind":"Field","name":{"kind":"Name","value":"failedTargetIds"}},{"kind":"Field","name":{"kind":"Name","value":"linkedCount"}},{"kind":"Field","name":{"kind":"Name","value":"limited"}}]}}]} as unknown as DocumentNode<CreateJobMutation, CreateJobMutationVariables>;
export const RepairTaskReferencesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RepairTaskReferences"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RepairTaskReferencesInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"repairTaskReferences"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ReferenceLinkingResult"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ReferenceLinkingResult"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TaskReferenceResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"taskId"}},{"kind":"Field","name":{"kind":"Name","value":"commentId"}},{"kind":"Field","name":{"kind":"Name","value":"failedTargetIds"}},{"kind":"Field","name":{"kind":"Name","value":"linkedCount"}},{"kind":"Field","name":{"kind":"Name","value":"limited"}}]}}]} as unknown as DocumentNode<RepairTaskReferencesMutation, RepairTaskReferencesMutationVariables>;
export const TaskRelationshipsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TaskRelationships"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"taskId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"taskRelationships"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"taskId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"taskId"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"TaskRelationshipFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"RelatedTaskFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"RelatedTask"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"isDone"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TaskRelationshipFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TaskRelationships"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"taskId"}},{"kind":"Field","name":{"kind":"Name","value":"canEdit"}},{"kind":"Field","name":{"kind":"Name","value":"parents"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"RelatedTaskFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"children"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"RelatedTaskFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"related"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"RelatedTaskFields"}}]}}]}}]} as unknown as DocumentNode<TaskRelationshipsQuery, TaskRelationshipsQueryVariables>;
export const RelationCandidatesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"RelationCandidates"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"taskId"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"search"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"page"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Int"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"relationCandidates"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"taskId"},"value":{"kind":"Variable","name":{"kind":"Name","value":"taskId"}}},{"kind":"Argument","name":{"kind":"Name","value":"search"},"value":{"kind":"Variable","name":{"kind":"Name","value":"search"}}},{"kind":"Argument","name":{"kind":"Name","value":"page"},"value":{"kind":"Variable","name":{"kind":"Name","value":"page"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"RelatedTaskFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"page"}},{"kind":"Field","name":{"kind":"Name","value":"hasMore"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"RelatedTaskFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"RelatedTask"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"isDone"}}]}}]} as unknown as DocumentNode<RelationCandidatesQuery, RelationCandidatesQueryVariables>;
export const SetTaskRelationDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetTaskRelation"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SetTaskRelationInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setTaskRelation"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"TaskRelationshipFields"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"RelatedTaskFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"RelatedTask"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"isDone"}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"TaskRelationshipFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TaskRelationships"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"taskId"}},{"kind":"Field","name":{"kind":"Name","value":"canEdit"}},{"kind":"Field","name":{"kind":"Name","value":"parents"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"RelatedTaskFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"children"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"RelatedTaskFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"related"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"RelatedTaskFields"}}]}}]}}]} as unknown as DocumentNode<SetTaskRelationMutation, SetTaskRelationMutationVariables>;
export const CreateSubtaskDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateSubtask"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateSubtaskInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createSubtask"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"task"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"RelatedTaskFields"}}]}},{"kind":"Field","name":{"kind":"Name","value":"relationError"}},{"kind":"Field","name":{"kind":"Name","value":"labelError"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"RelatedTaskFields"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"RelatedTask"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"isDone"}}]}}]} as unknown as DocumentNode<CreateSubtaskMutation, CreateSubtaskMutationVariables>;
export const TaskLabelsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TaskLabels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"taskLabels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}}]}}]} as unknown as DocumentNode<TaskLabelsQuery, TaskLabelsQueryVariables>;
export const CreateTaskLabelDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateTaskLabel"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"csrfToken"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"title"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createTaskLabel"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"csrfToken"},"value":{"kind":"Variable","name":{"kind":"Name","value":"csrfToken"}}},{"kind":"Argument","name":{"kind":"Name","value":"title"},"value":{"kind":"Variable","name":{"kind":"Name","value":"title"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}}]}}]} as unknown as DocumentNode<CreateTaskLabelMutation, CreateTaskLabelMutationVariables>;
export const TaskReuseValuesDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TaskReuseValues"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"job"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}},{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"recurring"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"Boolean"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"taskReuseValues"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"job"},"value":{"kind":"Variable","name":{"kind":"Name","value":"job"}}},{"kind":"Argument","name":{"kind":"Name","value":"recurring"},"value":{"kind":"Variable","name":{"kind":"Name","value":"recurring"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"taskId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"projectId"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"labels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}},{"kind":"Field","name":{"kind":"Name","value":"durationMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"completionWindowMinutes"}},{"kind":"Field","name":{"kind":"Name","value":"dueDate"}},{"kind":"Field","name":{"kind":"Name","value":"dueTime"}},{"kind":"Field","name":{"kind":"Name","value":"startDate"}},{"kind":"Field","name":{"kind":"Name","value":"startTime"}}]}}]}}]} as unknown as DocumentNode<TaskReuseValuesQuery, TaskReuseValuesQueryVariables>;
export const TaskDetailsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TaskDetails"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"task"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}},{"kind":"Field","name":{"kind":"Name","value":"reminders"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"at"}},{"kind":"Field","name":{"kind":"Name","value":"relativeTo"}},{"kind":"Field","name":{"kind":"Name","value":"relativePeriod"}}]}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"isDone"}},{"kind":"Field","name":{"kind":"Name","value":"doneAt"}},{"kind":"Field","name":{"kind":"Name","value":"completionOutcome"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"dueAt"}},{"kind":"Field","name":{"kind":"Name","value":"hasDueTime"}},{"kind":"Field","name":{"kind":"Name","value":"startAt"}},{"kind":"Field","name":{"kind":"Name","value":"endAt"}},{"kind":"Field","name":{"kind":"Name","value":"isOverdue"}},{"kind":"Field","name":{"kind":"Name","value":"timezone"}},{"kind":"Field","name":{"kind":"Name","value":"project"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"isDefault"}}]}},{"kind":"Field","name":{"kind":"Name","value":"recurrenceRule"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"interval"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"mode"}},{"kind":"Field","name":{"kind":"Name","value":"keepDueTime"}}]}},{"kind":"Field","name":{"kind":"Name","value":"labels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}}]}}]}}]} as unknown as DocumentNode<TaskDetailsQuery, TaskDetailsQueryVariables>;
export const UpdateTaskDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UpdateTask"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UpdateTaskInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"updateTask"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"referenceLinking"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"ReferenceLinkingResult"}}]}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"version"}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"ReferenceLinkingResult"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"TaskReferenceResult"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"taskId"}},{"kind":"Field","name":{"kind":"Name","value":"commentId"}},{"kind":"Field","name":{"kind":"Name","value":"failedTargetIds"}},{"kind":"Field","name":{"kind":"Name","value":"linkedCount"}},{"kind":"Field","name":{"kind":"Name","value":"limited"}}]}}]} as unknown as DocumentNode<UpdateTaskMutation, UpdateTaskMutationVariables>;
export const SkipRecurringTaskDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SkipRecurringTask"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SkipRecurringTaskInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"skipRecurringTask"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"completedTask"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"completionOutcome"}}]}},{"kind":"Field","name":{"kind":"Name","value":"nextOccurrence"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"dueAt"}}]}},{"kind":"Field","name":{"kind":"Name","value":"repairCapability"}},{"kind":"Field","name":{"kind":"Name","value":"missingMarkers"}},{"kind":"Field","name":{"kind":"Name","value":"remainingRepairSteps"}}]}}]}}]} as unknown as DocumentNode<SkipRecurringTaskMutation, SkipRecurringTaskMutationVariables>;
export const SetRecurringKeepDueTimeDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"SetRecurringKeepDueTime"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"SetRecurringKeepDueTimeInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"setRecurringKeepDueTime"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"task"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"dueAt"}},{"kind":"Field","name":{"kind":"Name","value":"hasDueTime"}},{"kind":"Field","name":{"kind":"Name","value":"recurrenceRule"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"interval"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"mode"}},{"kind":"Field","name":{"kind":"Name","value":"keepDueTime"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"repairCapability"}},{"kind":"Field","name":{"kind":"Name","value":"missingMarkers"}},{"kind":"Field","name":{"kind":"Name","value":"remainingRepairSteps"}}]}}]}}]} as unknown as DocumentNode<SetRecurringKeepDueTimeMutation, SetRecurringKeepDueTimeMutationVariables>;
export const DeleteTaskDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"DeleteTask"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"DeleteTaskInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deleteTask"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"deletedTaskId"}}]}}]}}]} as unknown as DocumentNode<DeleteTaskMutation, DeleteTaskMutationVariables>;
export const TaskDiagnosticsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TaskDiagnostics"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"taskDiagnostics"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"projectId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"isDone"}},{"kind":"Field","name":{"kind":"Name","value":"doneAt"}},{"kind":"Field","name":{"kind":"Name","value":"dueAt"}},{"kind":"Field","name":{"kind":"Name","value":"startAt"}},{"kind":"Field","name":{"kind":"Name","value":"endAt"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"recurrenceRule"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"interval"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"mode"}},{"kind":"Field","name":{"kind":"Name","value":"keepDueTime"}}]}},{"kind":"Field","name":{"kind":"Name","value":"labels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"creator"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"maxPermission"}}]}}]}}]} as unknown as DocumentNode<TaskDiagnosticsQuery, TaskDiagnosticsQueryVariables>;
export const ProjectsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Projects"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"projects"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"isDefault"}}]}}]}}]}}]} as unknown as DocumentNode<ProjectsQuery, ProjectsQueryVariables>;
export const WeekDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Week"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"WeekInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"week"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startsOn"}},{"kind":"Field","name":{"kind":"Name","value":"endsOn"}},{"kind":"Field","name":{"kind":"Name","value":"days"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"tasks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WeekTask"}}]}},{"kind":"Field","name":{"kind":"Name","value":"projections"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startAt"}},{"kind":"Field","name":{"kind":"Name","value":"endAt"}},{"kind":"Field","name":{"kind":"Name","value":"dueAt"}},{"kind":"Field","name":{"kind":"Name","value":"hasDueTime"}},{"kind":"Field","name":{"kind":"Name","value":"sourceTask"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WeekTask"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"isComplete"}},{"kind":"Field","name":{"kind":"Name","value":"issues"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"projectId"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"WeekTask"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Task"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"commentCount"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"isDone"}},{"kind":"Field","name":{"kind":"Name","value":"doneAt"}},{"kind":"Field","name":{"kind":"Name","value":"completionOutcome"}},{"kind":"Field","name":{"kind":"Name","value":"project"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"isDefault"}}]}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"dueAt"}},{"kind":"Field","name":{"kind":"Name","value":"hasDueTime"}},{"kind":"Field","name":{"kind":"Name","value":"startAt"}},{"kind":"Field","name":{"kind":"Name","value":"endAt"}},{"kind":"Field","name":{"kind":"Name","value":"recurrenceRule"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"interval"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"mode"}},{"kind":"Field","name":{"kind":"Name","value":"keepDueTime"}}]}},{"kind":"Field","name":{"kind":"Name","value":"labels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}},{"kind":"Field","name":{"kind":"Name","value":"isOverdue"}},{"kind":"Field","name":{"kind":"Name","value":"timezone"}}]}}]} as unknown as DocumentNode<WeekQuery, WeekQueryVariables>;
export const DayDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Day"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"DayInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"day"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"day"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"date"}},{"kind":"Field","name":{"kind":"Name","value":"tasks"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WeekTask"}}]}},{"kind":"Field","name":{"kind":"Name","value":"projections"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"startAt"}},{"kind":"Field","name":{"kind":"Name","value":"endAt"}},{"kind":"Field","name":{"kind":"Name","value":"dueAt"}},{"kind":"Field","name":{"kind":"Name","value":"hasDueTime"}},{"kind":"Field","name":{"kind":"Name","value":"sourceTask"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"FragmentSpread","name":{"kind":"Name","value":"WeekTask"}}]}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"isComplete"}},{"kind":"Field","name":{"kind":"Name","value":"issues"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"projectId"}}]}}]}}]}},{"kind":"FragmentDefinition","name":{"kind":"Name","value":"WeekTask"},"typeCondition":{"kind":"NamedType","name":{"kind":"Name","value":"Task"}},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"commentCount"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"isDone"}},{"kind":"Field","name":{"kind":"Name","value":"doneAt"}},{"kind":"Field","name":{"kind":"Name","value":"completionOutcome"}},{"kind":"Field","name":{"kind":"Name","value":"project"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"isDefault"}}]}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"dueAt"}},{"kind":"Field","name":{"kind":"Name","value":"hasDueTime"}},{"kind":"Field","name":{"kind":"Name","value":"startAt"}},{"kind":"Field","name":{"kind":"Name","value":"endAt"}},{"kind":"Field","name":{"kind":"Name","value":"recurrenceRule"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"interval"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"mode"}},{"kind":"Field","name":{"kind":"Name","value":"keepDueTime"}}]}},{"kind":"Field","name":{"kind":"Name","value":"labels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}},{"kind":"Field","name":{"kind":"Name","value":"isOverdue"}},{"kind":"Field","name":{"kind":"Name","value":"timezone"}}]}}]} as unknown as DocumentNode<DayQuery, DayQueryVariables>;
export const TaskListDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TaskList"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"TaskListInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tasks"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"commentCount"}},{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"isDone"}},{"kind":"Field","name":{"kind":"Name","value":"doneAt"}},{"kind":"Field","name":{"kind":"Name","value":"completionOutcome"}},{"kind":"Field","name":{"kind":"Name","value":"project"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"isDefault"}}]}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"dueAt"}},{"kind":"Field","name":{"kind":"Name","value":"hasDueTime"}},{"kind":"Field","name":{"kind":"Name","value":"startAt"}},{"kind":"Field","name":{"kind":"Name","value":"endAt"}},{"kind":"Field","name":{"kind":"Name","value":"recurrenceRule"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"interval"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"mode"}},{"kind":"Field","name":{"kind":"Name","value":"keepDueTime"}}]}},{"kind":"Field","name":{"kind":"Name","value":"labels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}},{"kind":"Field","name":{"kind":"Name","value":"isOverdue"}},{"kind":"Field","name":{"kind":"Name","value":"timezone"}}]}},{"kind":"Field","name":{"kind":"Name","value":"page"}},{"kind":"Field","name":{"kind":"Name","value":"pageSize"}},{"kind":"Field","name":{"kind":"Name","value":"totalItems"}},{"kind":"Field","name":{"kind":"Name","value":"totalPages"}},{"kind":"Field","name":{"kind":"Name","value":"hasMore"}},{"kind":"Field","name":{"kind":"Name","value":"isComplete"}},{"kind":"Field","name":{"kind":"Name","value":"issues"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"projectId"}}]}}]}}]}}]} as unknown as DocumentNode<TaskListQuery, TaskListQueryVariables>;
export const CompleteTaskDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CompleteTask"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CompleteTaskInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"completeTask"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"completedTask"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"isDone"}},{"kind":"Field","name":{"kind":"Name","value":"doneAt"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"dueAt"}},{"kind":"Field","name":{"kind":"Name","value":"hasDueTime"}},{"kind":"Field","name":{"kind":"Name","value":"startAt"}},{"kind":"Field","name":{"kind":"Name","value":"endAt"}},{"kind":"Field","name":{"kind":"Name","value":"isOverdue"}},{"kind":"Field","name":{"kind":"Name","value":"timezone"}},{"kind":"Field","name":{"kind":"Name","value":"project"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"isDefault"}}]}},{"kind":"Field","name":{"kind":"Name","value":"recurrenceRule"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"interval"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"mode"}},{"kind":"Field","name":{"kind":"Name","value":"keepDueTime"}}]}},{"kind":"Field","name":{"kind":"Name","value":"labels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"nextOccurrence"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"isDone"}},{"kind":"Field","name":{"kind":"Name","value":"doneAt"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"dueAt"}},{"kind":"Field","name":{"kind":"Name","value":"hasDueTime"}},{"kind":"Field","name":{"kind":"Name","value":"startAt"}},{"kind":"Field","name":{"kind":"Name","value":"endAt"}},{"kind":"Field","name":{"kind":"Name","value":"isOverdue"}},{"kind":"Field","name":{"kind":"Name","value":"timezone"}},{"kind":"Field","name":{"kind":"Name","value":"project"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"isDefault"}}]}},{"kind":"Field","name":{"kind":"Name","value":"recurrenceRule"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"interval"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"mode"}},{"kind":"Field","name":{"kind":"Name","value":"keepDueTime"}}]}},{"kind":"Field","name":{"kind":"Name","value":"labels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"undoUntil"}},{"kind":"Field","name":{"kind":"Name","value":"undoCapability"}},{"kind":"Field","name":{"kind":"Name","value":"repairCapability"}},{"kind":"Field","name":{"kind":"Name","value":"missingMarkers"}},{"kind":"Field","name":{"kind":"Name","value":"remainingRepairSteps"}}]}}]}}]} as unknown as DocumentNode<CompleteTaskMutation, CompleteTaskMutationVariables>;
export const UndoTaskCompletionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UndoTaskCompletion"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UndoTaskCompletionInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"undoTaskCompletion"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"task"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"isDone"}},{"kind":"Field","name":{"kind":"Name","value":"doneAt"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"dueAt"}},{"kind":"Field","name":{"kind":"Name","value":"hasDueTime"}},{"kind":"Field","name":{"kind":"Name","value":"startAt"}},{"kind":"Field","name":{"kind":"Name","value":"endAt"}},{"kind":"Field","name":{"kind":"Name","value":"isOverdue"}},{"kind":"Field","name":{"kind":"Name","value":"timezone"}},{"kind":"Field","name":{"kind":"Name","value":"project"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"isDefault"}}]}},{"kind":"Field","name":{"kind":"Name","value":"recurrenceRule"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"interval"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"mode"}},{"kind":"Field","name":{"kind":"Name","value":"keepDueTime"}}]}},{"kind":"Field","name":{"kind":"Name","value":"labels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"repairCapability"}},{"kind":"Field","name":{"kind":"Name","value":"missingMarkers"}},{"kind":"Field","name":{"kind":"Name","value":"remainingRepairSteps"}}]}}]}}]} as unknown as DocumentNode<UndoTaskCompletionMutation, UndoTaskCompletionMutationVariables>;
export const RepairTaskMetadataDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RepairTaskMetadata"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RepairTaskMetadataInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"repairTaskMetadata"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"task"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"isDone"}},{"kind":"Field","name":{"kind":"Name","value":"project"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"isDefault"}}]}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"dueAt"}},{"kind":"Field","name":{"kind":"Name","value":"hasDueTime"}},{"kind":"Field","name":{"kind":"Name","value":"isOverdue"}},{"kind":"Field","name":{"kind":"Name","value":"timezone"}},{"kind":"Field","name":{"kind":"Name","value":"labels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"repairCapability"}},{"kind":"Field","name":{"kind":"Name","value":"missingMarkers"}},{"kind":"Field","name":{"kind":"Name","value":"remainingRepairSteps"}}]}}]}}]} as unknown as DocumentNode<RepairTaskMetadataMutation, RepairTaskMetadataMutationVariables>;