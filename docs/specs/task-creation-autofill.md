# Task Creation Autofill

## Status

Implemented on 2026-08-27.

## Outcome

The New task form may prefill values from the last successfully created task in
the same browser. This is a convenience layer only: explicit navigation
context and current user input always win, and task creation continues normally
when browser storage is unavailable.

## User experience

- Autofill is available for one-time tasks, recurring tasks, one-time Jobs, and
  recurring Jobs.
- Remembered values are applied only when a new form is initialized or when the
  user explicitly changes between Task and Job variants.
- Every field populated from the previous task displays the muted helper text
  `From last task` beside its normal field description.
- Editing an autofilled field removes its helper, even when the entered value is
  equal to the remembered value.
- Autofill never uses a toast or alert. The helper is associated with its field
  through the field description so it remains understandable to assistive
  technology.
- Exact dates and times are restored without rebasing them to today. Normal form
  validation still applies, including when a remembered date is now in the
  past.

## Remembered values

Use versioned, namespaced `localStorage` records for these independent scopes:

```text
one-time:task
one-time:job
recurring:task
recurring:job
```

A separate remembered variant for each base form type records whether Task or
Job was used last. An explicit legacy `type=job` URL always overrides this
variant.

The first version remembers only:

- shared fields: title, project, and priority;
- the Task or Job variant;
- one-time task: due date and due time;
- recurring task: first due date and due time;
- one-time or recurring Job: start date, start time, duration, and completion
  window.

Description and recurrence policy fields are not remembered. In particular,
interval, unit, renewal mode, and fixed-time behavior continue to use their
normal application defaults.

Records must have a schema version and be decoded through runtime validation.
Unknown versions, malformed JSON, invalid field types, and inaccessible
projects are ignored. A bad field must not make the form unusable.

## Precedence

Resolve every field independently in this order:

```text
explicit URL/day/project context
-> current user input
-> remembered value
-> application default
```

An autofilled value becomes user-owned as soon as the user edits its field.
Ownership is based on interaction, not value equality. Therefore entering the
same value as the remembered value still makes the field dirty and prevents a
later autofill pass from replacing it.

The autofill snapshot is read once for a form scope. Storage events, delayed
project loading, and other asynchronous results must not reapply remembered
values. When project validation finishes after the user has interacted with the
form, the user's current selection remains unchanged.

When the user changes between Task and Job:

- load candidates from the new independent scope;
- preserve every shared field already owned by the user;
- populate only untouched fields that belong to the new variant;
- switching back must not restore remembered data over values edited during the
  current form session.

## Save boundary

Capture an immutable submission snapshot and persist it only after the server
has created the task. Do not persist on typing, validation failure, an upstream
creation failure, or form abandonment.

A repair-required result counts as successful creation because the task already
exists. Store the original successful submission once; repair retries do not
rewrite the memory. A navigation failure after creation also does not undo the
stored snapshot.

The last successful creation wins. A storage write failure must not change the
creation result, delay navigation, or show an error.

## Failure behavior

Access to `localStorage` is optional and fail-open:

- catch failures while detecting, reading, decoding, and writing storage;
- silently disable autofill when persistence is blocked or unavailable;
- never report an autofill failure as a task-creation failure;
- never make a network request to recover remembered values;
- do not reactively apply values written by another browser tab.

## Module boundary

Implement this as a dedicated feature-owned module under:

```text
frontend/src/features/tasks/autofill/
```

The module owns:

- typed remembered-value schemas and namespace selection;
- the safe, versioned `localStorage` adapter;
- pure precedence, ownership, and scope-transition logic;
- the reusable `From last task` field helper.

Task form components consume the module's typed API. They must not read, write,
parse, or listen to `localStorage` directly. The module must not submit tasks,
navigate, query Vikunja, or own general form validation. No code is added to
generated shadcn components for this feature.

## Required tests

### Precedence and collisions

- Explicit date and project context override different remembered values.
- User input made before delayed project loading is never overwritten.
- User input equal to a remembered value is still dirty and loses the helper.
- A storage event after initialization never reapplies values.
- Changing Task to Job preserves dirty shared fields and fills only untouched
  Job fields from the Job scope.
- Changing back does not overwrite values edited in the current session.
- An inaccessible remembered project falls through to the normal project
  default without displaying the helper.

### Persistence

- No record is written before a successful creation response.
- Validation and creation failures leave memory unchanged.
- Successful creation stores the immutable submitted values in the correct
  scope.
- Repair-required creation stores once; repair retries do not update it.
- Navigation failure after successful creation keeps the stored values.
- Concurrent forms do not reactively replace each other's current values; the
  latest successful write is used only by a future form.

### Degraded storage

- Unavailable storage, `SecurityError`, quota failure, corrupt JSON, unknown
  versions, and invalid field types all fall back without breaking creation.
- A write failure after creation does not change the successful UI result.

### Accessibility and display

- Only values sourced from memory receive `From last task`.
- Each helper is programmatically associated with its field.
- Manual interaction removes only that field's helper.

## Out of scope

- Vikunja searches for recently created tasks.
- Server-side preferences or GraphQL changes.
- Cross-device or cross-browser synchronization.
- Draft recovery and restoring abandoned forms.
- Remembering descriptions or recurrence policy.

## Design references

- [shadcn Base UI Field](https://ui.shadcn.com/docs/components/base/field) for
  field-associated descriptions rather than a global notification.
- [Apple: Entering data](https://developer.apple.com/design/human-interface-guidelines/entering-data)
  for using reasonable prefilled values to reduce repeated entry.
- [Apple: Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback)
  for keeping passive feedback close to the item it describes.
- [MDN: Window.localStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage)
  for persistence and blocked-storage failure behavior.
- [W3C: Understanding Status Messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html)
  for accessible, programmatically associated dynamic feedback.
