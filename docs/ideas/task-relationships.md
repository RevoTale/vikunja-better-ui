# Task relationships and emoji

## Problem

How might we help Better UI users split work into smaller tasks and connect
related discussions without repeating task setup or losing context?

## Direction

The user accepted the refined direction on 2026-09-29 and explicitly requested
the breaking marker rename from `job` to `vbu:job`. This authorizes planning,
not implementation or changes to upstream task data.

Use Vikunja's native subtask/parent and related-task relations. Put quick subtask
creation below the description, show navigation in both directions, and create
related-task links when users save recognized task URLs in Better UI comments
or descriptions. Add Unicode emoji insertion through the existing rich editor.

## Alternatives considered

- Manual relations alone: simplest, but misses the requested automatic linking.
- Quick child creation with explicit defaults: selected; reduces repeated setup.
- Automatic relations from saved links: selected; preserves discussion context.
- Convert selected text or comments to children: useful follow-up, deferred.
- Paste multiple titles to create children: useful follow-up, deferred.
- Mirror every direct Vikunja edit: requires additional synchronization and
  failure handling; defer in favor of Better UI saves only.

## Assumptions to validate

- Pinned Vikunja 2.5.0 supports the required API v2 operations, permissions and
  inverse relations: verify against the isolated fixture before implementation.
- Relationship writes and content/task creation are separate operations:
  explicitly expose partial success and retry only the missing operation.
- Parent defaults help more than remembered form values: test precedence and
  preserve user edits during asynchronous loading.
- Recurring tasks retain their existing lifecycle; children relate to the live
  task, without automatic child renewal or completion.

## First release

- Breaking `vbu:job` marker contract and rollout instructions.
- Add/remove native related-task links.
- Create or attach a child, navigate to its parent, and detach without deletion.
- Copy project, priority and ordinary labels once when creating a child.
- Automatically relate recognized links on confirmed Better UI content saves.
- Emoji picker and shortcode suggestions in descriptions/comments.

## Not included

Reactions, custom emoji uploads, project/task icons, bulk child creation,
comment-to-child conversion, subprojects, status cascades, child regeneration,
background synchronization, and retrospective scanning of existing content.

## Next artifact

See [implementation plan](../../tasks/task-relationships-plan.md) and
[task checklist](../../tasks/task-relationships-todo.md). Technical decisions
that require evidence are explicit gates in the plan.
