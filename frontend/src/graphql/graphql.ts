/* eslint-disable */
/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
import { TypedDocumentNode as DocumentNode } from '@graphql-typed-document-node/core';
export type CompleteTaskInput = {
  csrfToken: string;
  expectedKind: TaskKind;
  taskId: string | number;
};

export type CompletionStatus =
  | 'CONFIRMED'
  | 'CONFIRMED_REPAIR_REQUIRED';

export type CreateJobInput = {
  completionWindowMinutes?: number;
  csrfToken: string;
  description?: string | null | undefined;
  durationMinutes: number;
  priority: TaskPriority;
  projectId: string | number;
  startAt: string;
  title?: string | null | undefined;
};

export type CreateOneTimeTaskInput = {
  csrfToken: string;
  description?: string | null | undefined;
  dueDate?: string | null | undefined;
  dueTime?: string | null | undefined;
  priority: TaskPriority;
  projectId: string | number;
  title: string;
};

export type CreateRecurringTaskInput = {
  csrfToken: string;
  description?: string | null | undefined;
  dueTime?: string | null | undefined;
  firstDueDate: string;
  interval: number;
  mode?: RecurrenceMode;
  priority: TaskPriority;
  projectId: string | number;
  title: string;
  unit: RecurrenceUnit;
};

export type LoginInput = {
  password: string;
  username: string;
};

export type MarkerKind =
  | 'DATE_ONLY'
  | 'JOB'
  | 'RECURRENCE_HISTORY';

export type PageIssueCode =
  | 'RESULT_SET_TOO_LARGE'
  | 'UPSTREAM_PARTIAL';

export type RecurrenceMode =
  | 'FROM_COMPLETION'
  | 'SCHEDULED_CYCLE';

export type RecurrenceUnit =
  | 'DAY'
  | 'MONTH'
  | 'WEEK';

export type RepairStep =
  | 'ATTACH_DATE_ONLY'
  | 'ATTACH_JOB'
  | 'ATTACH_RECURRENCE_HISTORY'
  | 'CREATE_HISTORY_SNAPSHOT'
  | 'NORMALIZE_DUE';

export type RepairTaskMetadataInput = {
  capability: string;
  csrfToken: string;
};

export type TaskKind =
  | 'INVALID'
  | 'JOB'
  | 'ONE_TIME'
  | 'RECURRING';

export type TaskListInput = {
  page?: number;
  pageSize?: number;
  projectId?: string | number | null | undefined;
  scope: TaskScope;
};

export type TaskMutationStatus =
  | 'CONFIRMED'
  | 'REPAIR_REQUIRED';

export type TaskPriority =
  | 'DO_NOW'
  | 'HIGH'
  | 'LOW'
  | 'MEDIUM'
  | 'UNSET'
  | 'URGENT';

export type TaskScope =
  | 'HISTORY'
  | 'JOBS'
  | 'MONTH'
  | 'TODAY'
  | 'UNSCHEDULED'
  | 'WEEK';

export type UndoTaskCompletionInput = {
  capability: string;
  csrfToken: string;
};

export type LoginMutationVariables = Exact<{
  input: LoginInput;
}>;


export type LoginMutation = { login: { session: { authenticated: boolean, csrfToken: string | null, expiresAt: string | null, vikunjaUser: { id: string, username: string, timezone: string, weekStart: number, defaultProjectId: string | null } | null } } };

export type LogoutMutationVariables = Exact<{
  csrfToken: string;
}>;


export type LogoutMutation = { logout: { authenticated: boolean } };

export type SessionQueryVariables = Exact<{ [key: string]: never; }>;


export type SessionQuery = { session: { authenticated: boolean, csrfToken: string | null, expiresAt: string | null, vikunjaUser: { id: string, username: string, timezone: string, weekStart: number, defaultProjectId: string | null } | null } };

export type CreateOneTimeTaskMutationVariables = Exact<{
  input: CreateOneTimeTaskInput;
}>;


export type CreateOneTimeTaskMutation = { createOneTimeTask: { status: TaskMutationStatus, repairCapability: string | null, missingMarkers: Array<MarkerKind>, remainingRepairSteps: Array<RepairStep>, task: { id: string, title: string, kind: TaskKind, isDone: boolean, priority: TaskPriority, dueAt: string | null, hasDueTime: boolean, isOverdue: boolean, timezone: string, project: { id: string, title: string, isDefault: boolean }, labels: Array<{ id: string, title: string }> } } };

export type CreateRecurringTaskMutationVariables = Exact<{
  input: CreateRecurringTaskInput;
}>;


export type CreateRecurringTaskMutation = { createRecurringTask: { status: TaskMutationStatus, repairCapability: string | null, missingMarkers: Array<MarkerKind>, remainingRepairSteps: Array<RepairStep>, task: { id: string, title: string, kind: TaskKind, isDone: boolean, priority: TaskPriority, dueAt: string | null, hasDueTime: boolean, isOverdue: boolean, timezone: string, project: { id: string, title: string, isDefault: boolean }, labels: Array<{ id: string, title: string }>, recurrenceRule: { interval: number, unit: RecurrenceUnit, mode: RecurrenceMode } | null } } };

export type CreateJobMutationVariables = Exact<{
  input: CreateJobInput;
}>;


export type CreateJobMutation = { createJob: { status: TaskMutationStatus, repairCapability: string | null, missingMarkers: Array<MarkerKind>, remainingRepairSteps: Array<RepairStep>, task: { id: string, title: string, kind: TaskKind, isDone: boolean, priority: TaskPriority, dueAt: string | null, hasDueTime: boolean, startAt: string | null, endAt: string | null, isOverdue: boolean, timezone: string, project: { id: string, title: string, isDefault: boolean }, labels: Array<{ id: string, title: string }> } } };

export type TaskDetailsQueryVariables = Exact<{
  id: string | number;
}>;


export type TaskDetailsQuery = { task: { id: string, title: string, description: string, kind: TaskKind, isDone: boolean, doneAt: string | null, priority: TaskPriority, dueAt: string | null, hasDueTime: boolean, startAt: string | null, endAt: string | null, isOverdue: boolean, timezone: string, project: { id: string, title: string, isDefault: boolean }, recurrenceRule: { interval: number, unit: RecurrenceUnit, mode: RecurrenceMode } | null, labels: Array<{ id: string, title: string }> } | null };

export type TaskDiagnosticsQueryVariables = Exact<{
  id: string | number;
}>;


export type TaskDiagnosticsQuery = { taskDiagnostics: { id: string, projectId: string, title: string, kind: TaskKind, isDone: boolean, doneAt: string | null, dueAt: string | null, startAt: string | null, endAt: string | null, priority: TaskPriority, createdAt: string, updatedAt: string, maxPermission: string | null, recurrenceRule: { interval: number, unit: RecurrenceUnit, mode: RecurrenceMode } | null, labels: Array<{ id: string, title: string }>, creator: { id: string, username: string, name: string } | null } | null };

export type ProjectsQueryVariables = Exact<{ [key: string]: never; }>;


export type ProjectsQuery = { projects: { items: Array<{ id: string, title: string, isDefault: boolean }> } };

export type TaskListQueryVariables = Exact<{
  input: TaskListInput;
}>;


export type TaskListQuery = { tasks: { page: number, pageSize: number, totalItems: number, totalPages: number, hasMore: boolean, isComplete: boolean, items: Array<{ id: string, title: string, description: string, kind: TaskKind, isDone: boolean, doneAt: string | null, priority: TaskPriority, dueAt: string | null, hasDueTime: boolean, startAt: string | null, endAt: string | null, isOverdue: boolean, timezone: string, project: { id: string, title: string, isDefault: boolean }, recurrenceRule: { interval: number, unit: RecurrenceUnit, mode: RecurrenceMode } | null, labels: Array<{ id: string, title: string }> }>, issues: Array<{ code: PageIssueCode, message: string, projectId: string | null }> } };

export type CompleteTaskMutationVariables = Exact<{
  input: CompleteTaskInput;
}>;


export type CompleteTaskMutation = { completeTask: { status: CompletionStatus, undoUntil: string | null, undoCapability: string | null, repairCapability: string | null, missingMarkers: Array<MarkerKind>, remainingRepairSteps: Array<RepairStep>, completedTask: { id: string, title: string, description: string, kind: TaskKind, isDone: boolean, doneAt: string | null, priority: TaskPriority, dueAt: string | null, hasDueTime: boolean, startAt: string | null, endAt: string | null, isOverdue: boolean, timezone: string, project: { id: string, title: string, isDefault: boolean }, recurrenceRule: { interval: number, unit: RecurrenceUnit, mode: RecurrenceMode } | null, labels: Array<{ id: string, title: string }> } | null, nextOccurrence: { id: string, title: string, description: string, kind: TaskKind, isDone: boolean, doneAt: string | null, priority: TaskPriority, dueAt: string | null, hasDueTime: boolean, startAt: string | null, endAt: string | null, isOverdue: boolean, timezone: string, project: { id: string, title: string, isDefault: boolean }, recurrenceRule: { interval: number, unit: RecurrenceUnit, mode: RecurrenceMode } | null, labels: Array<{ id: string, title: string }> } | null } };

export type UndoTaskCompletionMutationVariables = Exact<{
  input: UndoTaskCompletionInput;
}>;


export type UndoTaskCompletionMutation = { undoTaskCompletion: { status: TaskMutationStatus, repairCapability: string | null, missingMarkers: Array<MarkerKind>, remainingRepairSteps: Array<RepairStep>, task: { id: string, title: string, description: string, kind: TaskKind, isDone: boolean, doneAt: string | null, priority: TaskPriority, dueAt: string | null, hasDueTime: boolean, startAt: string | null, endAt: string | null, isOverdue: boolean, timezone: string, project: { id: string, title: string, isDefault: boolean }, recurrenceRule: { interval: number, unit: RecurrenceUnit, mode: RecurrenceMode } | null, labels: Array<{ id: string, title: string }> } } };

export type RepairTaskMetadataMutationVariables = Exact<{
  input: RepairTaskMetadataInput;
}>;


export type RepairTaskMetadataMutation = { repairTaskMetadata: { status: TaskMutationStatus, repairCapability: string | null, missingMarkers: Array<MarkerKind>, remainingRepairSteps: Array<RepairStep>, task: { id: string, title: string, kind: TaskKind, isDone: boolean, priority: TaskPriority, dueAt: string | null, hasDueTime: boolean, isOverdue: boolean, timezone: string, project: { id: string, title: string, isDefault: boolean }, labels: Array<{ id: string, title: string }> } } };


export const LoginDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"Login"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"LoginInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"login"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"session"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"authenticated"}},{"kind":"Field","name":{"kind":"Name","value":"csrfToken"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"vikunjaUser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"timezone"}},{"kind":"Field","name":{"kind":"Name","value":"weekStart"}},{"kind":"Field","name":{"kind":"Name","value":"defaultProjectId"}}]}}]}}]}}]}}]} as unknown as DocumentNode<LoginMutation, LoginMutationVariables>;
export const LogoutDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"Logout"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"csrfToken"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"String"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"logout"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"csrfToken"},"value":{"kind":"Variable","name":{"kind":"Name","value":"csrfToken"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"authenticated"}}]}}]}}]} as unknown as DocumentNode<LogoutMutation, LogoutMutationVariables>;
export const SessionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Session"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"session"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"authenticated"}},{"kind":"Field","name":{"kind":"Name","value":"csrfToken"}},{"kind":"Field","name":{"kind":"Name","value":"expiresAt"}},{"kind":"Field","name":{"kind":"Name","value":"vikunjaUser"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"timezone"}},{"kind":"Field","name":{"kind":"Name","value":"weekStart"}},{"kind":"Field","name":{"kind":"Name","value":"defaultProjectId"}}]}}]}}]}}]} as unknown as DocumentNode<SessionQuery, SessionQueryVariables>;
export const CreateOneTimeTaskDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateOneTimeTask"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateOneTimeTaskInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createOneTimeTask"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"task"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"isDone"}},{"kind":"Field","name":{"kind":"Name","value":"project"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"isDefault"}}]}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"dueAt"}},{"kind":"Field","name":{"kind":"Name","value":"hasDueTime"}},{"kind":"Field","name":{"kind":"Name","value":"isOverdue"}},{"kind":"Field","name":{"kind":"Name","value":"timezone"}},{"kind":"Field","name":{"kind":"Name","value":"labels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"repairCapability"}},{"kind":"Field","name":{"kind":"Name","value":"missingMarkers"}},{"kind":"Field","name":{"kind":"Name","value":"remainingRepairSteps"}}]}}]}}]} as unknown as DocumentNode<CreateOneTimeTaskMutation, CreateOneTimeTaskMutationVariables>;
export const CreateRecurringTaskDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateRecurringTask"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateRecurringTaskInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createRecurringTask"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"task"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"isDone"}},{"kind":"Field","name":{"kind":"Name","value":"project"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"isDefault"}}]}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"dueAt"}},{"kind":"Field","name":{"kind":"Name","value":"hasDueTime"}},{"kind":"Field","name":{"kind":"Name","value":"isOverdue"}},{"kind":"Field","name":{"kind":"Name","value":"timezone"}},{"kind":"Field","name":{"kind":"Name","value":"labels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}},{"kind":"Field","name":{"kind":"Name","value":"recurrenceRule"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"interval"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"mode"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"repairCapability"}},{"kind":"Field","name":{"kind":"Name","value":"missingMarkers"}},{"kind":"Field","name":{"kind":"Name","value":"remainingRepairSteps"}}]}}]}}]} as unknown as DocumentNode<CreateRecurringTaskMutation, CreateRecurringTaskMutationVariables>;
export const CreateJobDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CreateJob"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CreateJobInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"createJob"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"task"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"isDone"}},{"kind":"Field","name":{"kind":"Name","value":"project"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"isDefault"}}]}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"dueAt"}},{"kind":"Field","name":{"kind":"Name","value":"hasDueTime"}},{"kind":"Field","name":{"kind":"Name","value":"startAt"}},{"kind":"Field","name":{"kind":"Name","value":"endAt"}},{"kind":"Field","name":{"kind":"Name","value":"isOverdue"}},{"kind":"Field","name":{"kind":"Name","value":"timezone"}},{"kind":"Field","name":{"kind":"Name","value":"labels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"repairCapability"}},{"kind":"Field","name":{"kind":"Name","value":"missingMarkers"}},{"kind":"Field","name":{"kind":"Name","value":"remainingRepairSteps"}}]}}]}}]} as unknown as DocumentNode<CreateJobMutation, CreateJobMutationVariables>;
export const TaskDetailsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TaskDetails"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"task"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"isDone"}},{"kind":"Field","name":{"kind":"Name","value":"doneAt"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"dueAt"}},{"kind":"Field","name":{"kind":"Name","value":"hasDueTime"}},{"kind":"Field","name":{"kind":"Name","value":"startAt"}},{"kind":"Field","name":{"kind":"Name","value":"endAt"}},{"kind":"Field","name":{"kind":"Name","value":"isOverdue"}},{"kind":"Field","name":{"kind":"Name","value":"timezone"}},{"kind":"Field","name":{"kind":"Name","value":"project"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"isDefault"}}]}},{"kind":"Field","name":{"kind":"Name","value":"recurrenceRule"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"interval"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"mode"}}]}},{"kind":"Field","name":{"kind":"Name","value":"labels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}}]}}]}}]} as unknown as DocumentNode<TaskDetailsQuery, TaskDetailsQueryVariables>;
export const TaskDiagnosticsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TaskDiagnostics"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"id"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"ID"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"taskDiagnostics"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"id"},"value":{"kind":"Variable","name":{"kind":"Name","value":"id"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"projectId"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"isDone"}},{"kind":"Field","name":{"kind":"Name","value":"doneAt"}},{"kind":"Field","name":{"kind":"Name","value":"dueAt"}},{"kind":"Field","name":{"kind":"Name","value":"startAt"}},{"kind":"Field","name":{"kind":"Name","value":"endAt"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"recurrenceRule"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"interval"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"mode"}}]}},{"kind":"Field","name":{"kind":"Name","value":"labels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}},{"kind":"Field","name":{"kind":"Name","value":"createdAt"}},{"kind":"Field","name":{"kind":"Name","value":"updatedAt"}},{"kind":"Field","name":{"kind":"Name","value":"creator"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"username"}},{"kind":"Field","name":{"kind":"Name","value":"name"}}]}},{"kind":"Field","name":{"kind":"Name","value":"maxPermission"}}]}}]}}]} as unknown as DocumentNode<TaskDiagnosticsQuery, TaskDiagnosticsQueryVariables>;
export const ProjectsDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"Projects"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"projects"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"isDefault"}}]}}]}}]}}]} as unknown as DocumentNode<ProjectsQuery, ProjectsQueryVariables>;
export const TaskListDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"query","name":{"kind":"Name","value":"TaskList"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"TaskListInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"tasks"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"items"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"isDone"}},{"kind":"Field","name":{"kind":"Name","value":"doneAt"}},{"kind":"Field","name":{"kind":"Name","value":"project"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"isDefault"}}]}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"dueAt"}},{"kind":"Field","name":{"kind":"Name","value":"hasDueTime"}},{"kind":"Field","name":{"kind":"Name","value":"startAt"}},{"kind":"Field","name":{"kind":"Name","value":"endAt"}},{"kind":"Field","name":{"kind":"Name","value":"recurrenceRule"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"interval"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"mode"}}]}},{"kind":"Field","name":{"kind":"Name","value":"labels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}},{"kind":"Field","name":{"kind":"Name","value":"isOverdue"}},{"kind":"Field","name":{"kind":"Name","value":"timezone"}}]}},{"kind":"Field","name":{"kind":"Name","value":"page"}},{"kind":"Field","name":{"kind":"Name","value":"pageSize"}},{"kind":"Field","name":{"kind":"Name","value":"totalItems"}},{"kind":"Field","name":{"kind":"Name","value":"totalPages"}},{"kind":"Field","name":{"kind":"Name","value":"hasMore"}},{"kind":"Field","name":{"kind":"Name","value":"isComplete"}},{"kind":"Field","name":{"kind":"Name","value":"issues"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"code"}},{"kind":"Field","name":{"kind":"Name","value":"message"}},{"kind":"Field","name":{"kind":"Name","value":"projectId"}}]}}]}}]}}]} as unknown as DocumentNode<TaskListQuery, TaskListQueryVariables>;
export const CompleteTaskDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"CompleteTask"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"CompleteTaskInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"completeTask"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"completedTask"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"isDone"}},{"kind":"Field","name":{"kind":"Name","value":"doneAt"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"dueAt"}},{"kind":"Field","name":{"kind":"Name","value":"hasDueTime"}},{"kind":"Field","name":{"kind":"Name","value":"startAt"}},{"kind":"Field","name":{"kind":"Name","value":"endAt"}},{"kind":"Field","name":{"kind":"Name","value":"isOverdue"}},{"kind":"Field","name":{"kind":"Name","value":"timezone"}},{"kind":"Field","name":{"kind":"Name","value":"project"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"isDefault"}}]}},{"kind":"Field","name":{"kind":"Name","value":"recurrenceRule"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"interval"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"mode"}}]}},{"kind":"Field","name":{"kind":"Name","value":"labels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"nextOccurrence"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"isDone"}},{"kind":"Field","name":{"kind":"Name","value":"doneAt"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"dueAt"}},{"kind":"Field","name":{"kind":"Name","value":"hasDueTime"}},{"kind":"Field","name":{"kind":"Name","value":"startAt"}},{"kind":"Field","name":{"kind":"Name","value":"endAt"}},{"kind":"Field","name":{"kind":"Name","value":"isOverdue"}},{"kind":"Field","name":{"kind":"Name","value":"timezone"}},{"kind":"Field","name":{"kind":"Name","value":"project"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"isDefault"}}]}},{"kind":"Field","name":{"kind":"Name","value":"recurrenceRule"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"interval"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"mode"}}]}},{"kind":"Field","name":{"kind":"Name","value":"labels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"undoUntil"}},{"kind":"Field","name":{"kind":"Name","value":"undoCapability"}},{"kind":"Field","name":{"kind":"Name","value":"repairCapability"}},{"kind":"Field","name":{"kind":"Name","value":"missingMarkers"}},{"kind":"Field","name":{"kind":"Name","value":"remainingRepairSteps"}}]}}]}}]} as unknown as DocumentNode<CompleteTaskMutation, CompleteTaskMutationVariables>;
export const UndoTaskCompletionDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"UndoTaskCompletion"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"UndoTaskCompletionInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"undoTaskCompletion"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"task"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"description"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"isDone"}},{"kind":"Field","name":{"kind":"Name","value":"doneAt"}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"dueAt"}},{"kind":"Field","name":{"kind":"Name","value":"hasDueTime"}},{"kind":"Field","name":{"kind":"Name","value":"startAt"}},{"kind":"Field","name":{"kind":"Name","value":"endAt"}},{"kind":"Field","name":{"kind":"Name","value":"isOverdue"}},{"kind":"Field","name":{"kind":"Name","value":"timezone"}},{"kind":"Field","name":{"kind":"Name","value":"project"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"isDefault"}}]}},{"kind":"Field","name":{"kind":"Name","value":"recurrenceRule"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"interval"}},{"kind":"Field","name":{"kind":"Name","value":"unit"}},{"kind":"Field","name":{"kind":"Name","value":"mode"}}]}},{"kind":"Field","name":{"kind":"Name","value":"labels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"repairCapability"}},{"kind":"Field","name":{"kind":"Name","value":"missingMarkers"}},{"kind":"Field","name":{"kind":"Name","value":"remainingRepairSteps"}}]}}]}}]} as unknown as DocumentNode<UndoTaskCompletionMutation, UndoTaskCompletionMutationVariables>;
export const RepairTaskMetadataDocument = {"kind":"Document","definitions":[{"kind":"OperationDefinition","operation":"mutation","name":{"kind":"Name","value":"RepairTaskMetadata"},"variableDefinitions":[{"kind":"VariableDefinition","variable":{"kind":"Variable","name":{"kind":"Name","value":"input"}},"type":{"kind":"NonNullType","type":{"kind":"NamedType","name":{"kind":"Name","value":"RepairTaskMetadataInput"}}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"repairTaskMetadata"},"arguments":[{"kind":"Argument","name":{"kind":"Name","value":"input"},"value":{"kind":"Variable","name":{"kind":"Name","value":"input"}}}],"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"status"}},{"kind":"Field","name":{"kind":"Name","value":"task"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"kind"}},{"kind":"Field","name":{"kind":"Name","value":"isDone"}},{"kind":"Field","name":{"kind":"Name","value":"project"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}},{"kind":"Field","name":{"kind":"Name","value":"isDefault"}}]}},{"kind":"Field","name":{"kind":"Name","value":"priority"}},{"kind":"Field","name":{"kind":"Name","value":"dueAt"}},{"kind":"Field","name":{"kind":"Name","value":"hasDueTime"}},{"kind":"Field","name":{"kind":"Name","value":"isOverdue"}},{"kind":"Field","name":{"kind":"Name","value":"timezone"}},{"kind":"Field","name":{"kind":"Name","value":"labels"},"selectionSet":{"kind":"SelectionSet","selections":[{"kind":"Field","name":{"kind":"Name","value":"id"}},{"kind":"Field","name":{"kind":"Name","value":"title"}}]}}]}},{"kind":"Field","name":{"kind":"Name","value":"repairCapability"}},{"kind":"Field","name":{"kind":"Name","value":"missingMarkers"}},{"kind":"Field","name":{"kind":"Name","value":"remainingRepairSteps"}}]}}]}}]} as unknown as DocumentNode<RepairTaskMetadataMutation, RepairTaskMetadataMutationVariables>;