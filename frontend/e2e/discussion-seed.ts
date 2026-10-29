import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execute = promisify(execFile);

export async function seedDiscussionReplyChain(taskId: string) {
  const { stdout } = await execute(
    "go",
    ["run", "./tests/e2e/harness", "seed-discussion", taskId],
    {
      cwd: fileURLToPath(new URL("../../", import.meta.url)),
      timeout: 30_000,
    },
  );
  const source = stdout.trim();
  if (!/^[1-9]\d*$/.test(source)) throw new Error("Missing fixture source comment");
  return source;
}
