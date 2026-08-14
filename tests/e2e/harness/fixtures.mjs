const [baseURL, username, password] = process.argv.slice(2);
const fixtureTimezone = "Europe/Kyiv";

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
await request("/user/settings/general", {
  method: "PUT",
  token: jwt,
  body: JSON.stringify({
    default_project_id: project.id,
    discoverable_by_email: false,
    discoverable_by_name: false,
    email_reminders_enabled: false,
    frontend_settings: {},
    language: "en",
    name: "E2E User",
    overdue_tasks_reminders_enabled: false,
    overdue_tasks_reminders_time: "09:00",
    timezone: fixtureTimezone,
    week_start: 1,
  }),
});
const currentUser = await request("/user", { token: jwt });
if (currentUser.settings?.timezone !== fixtureTimezone) {
  throw new Error(`user timezone is ${currentUser.settings?.timezone}, want ${fixtureTimezone}`);
}

const jobLabel = await request("/labels", {
  method: "POST",
  token: jwt,
  body: JSON.stringify({ title: "job" }),
});
const focusLabel = await request("/labels", {
  method: "POST",
  token: jwt,
  body: JSON.stringify({ title: "focus" }),
});
const workLabel = await createLabel("work");
const sportLabel = await createLabel("sport");
const readingLabel = await createLabel("reading");
const practiceLabel = await createLabel("practice");

const schedule = [
  {
    title: "Prepare weekly status update",
    description: "Review progress, blockers, and the next priorities.",
    priority: 4,
    labels: [jobLabel, workLabel],
    history: { hour: 9, minute: 0, duration: 90 },
    active: {
      start_date: scheduledAfter(15),
      end_date: scheduledAfter(105),
      due_date: scheduledAfter(135),
    },
  },
  {
    title: "Client follow-up and invoices",
    description: "Reply to open questions and send this week's invoices.",
    priority: 3,
    labels: [jobLabel, workLabel],
    history: { hour: 14, minute: 0, duration: 60 },
    active: {
      start_date: scheduledAfter(180),
      end_date: scheduledAfter(240),
      due_date: scheduledAfter(300),
    },
  },
  {
    title: "Morning run",
    priority: 2,
    labels: [sportLabel],
    history: { hour: 7, minute: 30 },
    active: { due_date: scheduledAt(7, 30), repeat_after: 86400, repeat_mode: 0 },
  },
  {
    title: "Strength training",
    priority: 3,
    labels: [sportLabel],
    history: { hour: 18, minute: 30 },
    active: { due_date: scheduledAt(18, 30), repeat_after: 3 * 86400, repeat_mode: 2 },
  },
  {
    title: "Practice vocal warm-ups",
    priority: 2,
    labels: [practiceLabel],
    history: { hour: 19, minute: 15 },
    active: { due_date: scheduledAt(19, 15), repeat_after: 86400, repeat_mode: 2 },
  },
  {
    title: "Read 20 pages",
    priority: 0,
    labels: [readingLabel],
    history: { hour: 21, minute: 30 },
    active: { due_date: scheduledAt(21, 30), repeat_after: 86400, repeat_mode: 2 },
  },
  {
    title: "Plan tomorrow",
    priority: 1,
    labels: [focusLabel],
    history: { hour: 22, minute: 0 },
    active: { due_date: scheduledAt(22, 0) },
  },
];
for (let index = 0; index < 125; index += 1) {
  const scheduled = schedule[index % schedule.length];
  const dayOffset = -Math.floor(index / schedule.length) - 1;
  const task = await createTask(historyTask(scheduled, dayOffset), scheduled.labels);
  await completeTask(task.id);
}

for (const scheduled of schedule) {
  await createTask(
    {
      title: scheduled.title,
      description: scheduled.description,
      priority: scheduled.priority,
      ...scheduled.active,
    },
    scheduled.labels,
  );
}

const labeledTitle = "Labeled task fixture";
const labeledTask = await request(`/projects/${project.id}/tasks`, {
  method: "POST",
  token: jwt,
  body: JSON.stringify({ title: labeledTitle, due_date: new Date().toISOString() }),
});
await request(`/tasks/${labeledTask.id}/labels`, {
  method: "POST",
  token: jwt,
  body: JSON.stringify({ label_id: focusLabel.id }),
});
const invalidTitle = "Invalid mixed task fixture";
const invalidTask = await request(`/projects/${project.id}/tasks`, {
  method: "POST",
  token: jwt,
  body: JSON.stringify({
    title: invalidTitle,
    due_date: new Date().toISOString(),
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
    labeledTitle,
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

function requiredString(value, name) {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${name} is missing`);
  return value;
}

async function createLabel(title) {
  return request("/labels", {
    method: "POST",
    token: jwt,
    body: JSON.stringify({ title }),
  });
}

async function createTask(task, labels) {
  const created = await request(`/projects/${project.id}/tasks`, {
    method: "POST",
    token: jwt,
    body: JSON.stringify(task),
  });
  for (const label of labels) {
    await request(`/tasks/${created.id}/labels`, {
      method: "POST",
      token: jwt,
      body: JSON.stringify({ label_id: label.id }),
    });
  }
  return created;
}

async function completeTask(taskID) {
  await request(`/tasks/${taskID}`, {
    method: "PATCH",
    token: jwt,
    contentType: "application/json-patch+json",
    body: JSON.stringify([
      { op: "test", path: "/done", value: false },
      { op: "replace", path: "/done", value: true },
    ]),
  });
}

function historyTask(scheduled, dayOffset) {
  const { hour, minute, duration } = scheduled.history;
  const startDate = scheduledAt(hour, minute, dayOffset);
  return {
    title: scheduled.title,
    priority: scheduled.priority,
    due_date: duration ? scheduledAt(hour, minute + duration + 60, dayOffset) : startDate,
    ...(duration
      ? {
          start_date: startDate,
          end_date: scheduledAt(hour, minute + duration, dayOffset),
        }
      : {}),
  };
}

function scheduledAt(hour, minute, dayOffset = 0) {
  const now = new Date();
  const today = zonedParts(now);
  const localTimestamp = Date.UTC(
    today.year,
    today.month - 1,
    today.day + dayOffset,
    hour,
    minute,
  );
  let instant = new Date(localTimestamp);

  for (let iteration = 0; iteration < 2; iteration += 1) {
    const represented = zonedParts(instant);
    const representedTimestamp = Date.UTC(
      represented.year,
      represented.month - 1,
      represented.day,
      represented.hour,
      represented.minute,
    );
    instant = new Date(instant.getTime() + localTimestamp - representedTimestamp);
  }
  return instant.toISOString();
}

function scheduledAfter(minutes) {
  return new Date(Date.now() + minutes * 60 * 1000).toISOString();
}

function zonedParts(value) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: fixtureTimezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
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
