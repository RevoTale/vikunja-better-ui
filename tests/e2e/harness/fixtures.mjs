const [baseURL, username, password] = process.argv.slice(2);

if (!baseURL || !username || !password) {
  throw new Error("usage: fixtures.mjs <base-url> <username> <password>");
}

const login = await request("/login", {
  method: "POST",
  body: JSON.stringify({ username, password, long_token: false }),
});
const jwt = requiredString(login.token, "login token");

const project = await request("/projects", {
  method: "POST",
  token: jwt,
  body: JSON.stringify({ title: "E2E Daily Tasks" }),
});
const emptyProject = await request("/projects", {
  method: "POST",
  token: jwt,
  body: JSON.stringify({ title: "E2E Empty Project" }),
});
const currentUser = await request("/user", { token: jwt });

for (let index = 1; index <= 31; index += 1) {
  const task = await request(`/projects/${project.id}/tasks`, {
    method: "POST",
    token: jwt,
    body: JSON.stringify({ title: `History seed ${String(index).padStart(2, "0")}` }),
  });
  await request(`/tasks/${task.id}`, {
    method: "PATCH",
    token: jwt,
    contentType: "application/json-patch+json",
    body: JSON.stringify([
      { op: "test", path: "/done", value: false },
      { op: "replace", path: "/done", value: true },
    ]),
  });
}

const jobLabel = await request("/labels", {
  method: "POST",
  token: jwt,
  body: JSON.stringify({ title: "job" }),
});
const invalidTitle = "Invalid mixed task fixture";
const invalidTask = await request(`/projects/${project.id}/tasks`, {
  method: "POST",
  token: jwt,
  body: JSON.stringify({
    title: invalidTitle,
    due_date: endOfToday().toISOString(),
    repeat_after: 86400,
    repeat_mode: 2,
  }),
});
await request(`/tasks/${invalidTask.id}/labels`, {
  method: "POST",
  token: jwt,
  body: JSON.stringify({ label_id: jobLabel.id }),
});

const routes = await request("/routes", { token: jwt });
const permissions = {
  other: selectPermissions(routes, "other", ["user"]),
  projects: selectPermissions(routes, "projects", ["read_all"]),
  tasks: selectPermissions(routes, "tasks", ["create", "read_all", "read_one", "update"]),
  labels: selectPermissions(routes, "labels", ["create", "read_all"]),
  tasks_labels: selectPermissions(routes, "tasks_labels", ["create", "read_all"]),
};

const apiToken = await request("/tokens", {
  method: "POST",
  token: jwt,
  body: JSON.stringify({
    title: "Vikunja Better UI E2E",
    expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    permissions,
  }),
});

process.stdout.write(
  JSON.stringify({
    token: requiredString(apiToken.token, "API token"),
    projectId: String(project.id),
    emptyProjectId: String(emptyProject.id),
    timezone: requiredString(currentUser.settings?.timezone, "user timezone"),
    invalidTitle,
  }),
);

async function request(path, options = {}) {
  const response = await fetch(`${baseURL}/api/v2${path}`, {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.contentType ? { "Content-Type": options.contentType } : {}),
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body,
  });
  if (!response.ok) {
    throw new Error(`${options.method ?? "GET"} ${path} returned ${response.status}: ${await response.text()}`);
  }
  return response.json();
}

function endOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
}

function requiredString(value, name) {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${name} is missing`);
  return value;
}

function selectPermissions(routes, group, names) {
  const available = routes[group];
  if (!available || typeof available !== "object") {
    throw new Error(`Vikunja route group ${group} is missing`);
  }
  for (const name of names) {
    if (!(name in available)) throw new Error(`Vikunja permission ${group}:${name} is missing`);
  }
  return names;
}
