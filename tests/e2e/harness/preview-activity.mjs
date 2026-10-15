// Demo-only data. A fresh seed varies previews; explicit seeds keep tests reproducible.
export function previewActivityTasks(now = new Date(), seed = Date.now()) {
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
  const tasks = [];
  for (let offset = 20; offset >= 0; offset -= 1) {
    const count = 3 + Math.floor(random() * 8);
    const onTimeChance = 0.2 + random() * 0.75;
    for (let index = 0; index < count; index += 1) {
      const done = new Date(`${today}T12:00:00Z`);
      done.setUTCDate(done.getUTCDate() - offset);
      done.setUTCMinutes(Math.floor(random() * 180));
      // Today's sample must never contain future completions, including early morning previews.
      const doneAt = offset === 0 ? now : done;
      const hasDeadline = random() > 0.12;
      const delta = (15 + Math.floor(random() * 240)) * 60_000;
      const dueAt = new Date(doneAt.getTime() + (random() < onTimeChance ? delta : -delta));
      tasks.push({
        title: `Preview activity ${offset}d / ${index + 1}`,
        priority: Math.floor(random() * 6),
        done: true,
        done_at: doneAt.toISOString(),
        ...(hasDeadline ? { due_date: dueAt.toISOString() } : {}),
      });
    }
  }
  return tasks;
}

export async function seedPreviewActivity(request, projectId, token) {
  for (const task of previewActivityTasks()) {
    const created = await request(`/projects/${projectId}/tasks`, {
      method: "POST", token, body: JSON.stringify(task),
    });
    // Vikunja may assign the completion clock when setting done; restore the historical fact afterward.
    const updated = await request(`/tasks/${created.id}`, {
      method: "PATCH", token, contentType: "application/json-patch+json",
      body: JSON.stringify([
        { op: "test", path: "/done", value: true },
        { op: "replace", path: "/done_at", value: task.done_at },
      ]),
    });
    if (new Date(updated.done_at).getTime() !== new Date(task.done_at).getTime()) {
      throw new Error("Vikunja did not preserve the preview completion date");
    }
  }
}
