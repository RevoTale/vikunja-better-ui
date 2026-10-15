import { readFileSync, realpathSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";

interface FixtureLocation {
  directory: string | undefined;
  databasePath: string | undefined;
  upstreamURL: string | undefined;
}

function environmentLocation(): FixtureLocation {
  return {
    directory: process.env["E2E_FIXTURE_DIR"],
    databasePath: process.env["VIKUNJA_DATABASE_PATH"],
    upstreamURL: process.env["VIKUNJA_SERVICE_PUBLICURL"],
  };
}

function validatedLocation(location: FixtureLocation) {
  const { directory, databasePath, upstreamURL } = location;
  if (!directory || !databasePath || !upstreamURL) throw new Error("Missing E2E fixture location");
  const root = realpathSync(directory);
  const database = realpathSync(databasePath);
  const url = new URL(upstreamURL);
  if (
    dirname(root) !== realpathSync(tmpdir()) ||
    !basename(root).startsWith("vikunja-better-ui-e2e.") ||
    database !== join(root, "vikunja.db") ||
    url.protocol !== "http:" ||
    url.hostname !== "127.0.0.1" ||
    !url.port ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  ) {
    throw new Error("Refusing a non-isolated E2E fixture");
  }
  return { database, marker: join(root, ".discussion-fixture"), owner: url.origin };
}

// Only the isolated harness registers ownership; tests must verify it before writing.
export function registerDiscussionFixture(location = environmentLocation()) {
  const { marker, owner } = validatedLocation(location);
  writeFileSync(marker, owner, { flag: "wx", mode: 0o600 });
}

export function seedDiscussionReplyChain(taskId: string, location = environmentLocation()) {
  if (!/^[1-9]\d*$/.test(taskId) || !Number.isSafeInteger(Number(taskId))) {
    throw new Error("Invalid fixture task ID");
  }
  const { database, marker, owner } = validatedLocation(location);
  if (readFileSync(marker, "utf8") !== owner) throw new Error("Invalid E2E fixture ownership");
  const connection = new DatabaseSync(database, { timeout: 5000 });
  try {
    // Acquire the write lock before reading: deferred SQLite transaction upgrades
    // can fail immediately despite busy_timeout when Vikunja's event listeners write.
    connection.exec("BEGIN IMMEDIATE");
    try {
      const source = insertReplyChain(connection, Number(taskId));
      connection.exec("COMMIT");
      return source;
    } catch (error) {
      connection.exec("ROLLBACK");
      throw error;
    }
  } finally {
    connection.close();
  }
}

function insertReplyChain(connection: DatabaseSync, taskId: number) {
  const task = connection.prepare("SELECT created_by_id FROM tasks WHERE id = ?").get(taskId);
  const author = task?.["created_by_id"];
  if (typeof author !== "number" || !Number.isSafeInteger(author) || author <= 0) {
    throw new Error("Missing fixture task or author");
  }
  const insert = connection.prepare(
    "INSERT INTO task_comments (comment, author_id, task_id, created, updated) VALUES (?, ?, ?, ?, ?)",
  );
  let source = "";
  let parent = "";
  const start = Date.now() - 60_000;
  for (let index = 0; index < 51; index++) {
    let body = `<p>Journal ${index}</p>`;
    if (index === 1) body = `<blockquote data-comment-id="${source}">Journal 0</blockquote>${body}`;
    if (index === 50) {
      body = `<blockquote data-comment-id="${parent}">Journal 1</blockquote><p>Last reply</p>`;
    }
    const timestamp = new Date(start + index * 1000).toISOString().slice(0, 19).replace("T", " ");
    const id = String(insert.run(body, author, taskId, timestamp, timestamp).lastInsertRowid);
    if (index === 0) source = id;
    if (index === 1) parent = id;
  }
  return source;
}
