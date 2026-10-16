import assert from "node:assert/strict";
import { copyFileSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import {
  registerDiscussionFixture,
  seedDiscussionReplyChain,
} from "../../../frontend/e2e/discussion-seed.ts";

function fixture(context) {
  const directory = mkdtempSync(join(tmpdir(), "vikunja-better-ui-e2e."));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const databasePath = join(directory, "vikunja.db");
  const database = new DatabaseSync(databasePath);
  context.after(() => database.close());
  database.exec(`
    CREATE TABLE tasks (id INTEGER PRIMARY KEY, created_by_id INTEGER);
    INSERT INTO tasks VALUES (42, 9);
    CREATE TABLE task_comments (
      id INTEGER PRIMARY KEY, comment TEXT, author_id INTEGER, task_id INTEGER,
      created DATETIME, updated DATETIME
    );
  `);
  const location = { directory, databasePath, upstreamURL: "http://127.0.0.1:12345" };
  registerDiscussionFixture(location);
  return { location, database };
}

test("pagination setup writes 51 ordered comments and their reply chain atomically", (context) => {
  const { location, database } = fixture(context);
  const source = seedDiscussionReplyChain("42", location);
  const comments = database.prepare("SELECT * FROM task_comments ORDER BY created, id").all();
  assert.equal(comments.length, 51);
  assert.equal(source, String(comments[0].id));
  assert.ok(comments.every((comment) => comment.author_id === 9 && comment.task_id === 42));
  assert.match(comments[1].comment, new RegExp(`data-comment-id="${source}"`));
  assert.match(comments[50].comment, new RegExp(`data-comment-id="${comments[1].id}"`));
  assert.ok(
    comments.every((comment, index) => index === 0 || comment.created > comments[index - 1].created),
  );
});

test("failed inserts roll back the entire pagination setup", (context) => {
  const { location, database } = fixture(context);
  database.exec(`CREATE TRIGGER reject_comment BEFORE INSERT ON task_comments
    WHEN NEW.comment = '<p>Journal 2</p>' BEGIN SELECT RAISE(ABORT, 'test rejection'); END;`);
  assert.throws(() => seedDiscussionReplyChain("42", location), /test rejection/);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM task_comments").get().count, 0);
  assert.throws(() => seedDiscussionReplyChain("999", location), /fixture task/);
});

test("seeding rejects foreign ownership, databases, URLs and invalid task IDs", (context) => {
  const { location, database } = fixture(context);
  const marker = join(location.directory, ".discussion-fixture");
  const ownership = readFileSync(marker, "utf8");
  assert.throws(() => registerDiscussionFixture(location), /EEXIST/);
  writeFileSync(marker, "foreign fixture");
  assert.throws(() => seedDiscussionReplyChain("42", location), /ownership/);
  writeFileSync(marker, ownership);
  const otherPath = join(location.directory, "other.db");
  copyFileSync(location.databasePath, otherPath);
  assert.throws(() => seedDiscussionReplyChain("42", { ...location, databasePath: otherPath }));
  const other = new DatabaseSync(otherPath, { readOnly: true });
  assert.equal(other.prepare("SELECT COUNT(*) AS count FROM task_comments").get().count, 0);
  other.close();
  assert.throws(() => seedDiscussionReplyChain("42", { ...location, upstreamURL: "https://example.com" }));
  assert.throws(() => seedDiscussionReplyChain("42 OR 1=1", location), /task ID/);
  rmSync(marker);
  assert.throws(() => seedDiscussionReplyChain("42", location), /ENOENT/);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM task_comments").get().count, 0);
});
