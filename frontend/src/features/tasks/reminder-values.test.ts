import { describe, expect, it } from "vitest";
import { creationReminderAnchors, reminderAnchors } from "./reminder-anchors";
import { formReminders, relativeReminderLabel } from "./reminder-values";
import { defaultTaskCreationValues } from "./task-creation-values";

describe("relative reminders", () => {
  it("uses readable exact units without rounding imported offsets", () => {
    expect(relativeReminderLabel("due_date", -7200)).toBe("2 hours before deadline");
    expect(relativeReminderLabel("end_date", -86400)).toBe("1 day before planned finish");
    expect(relativeReminderLabel("start_date", 37)).toBe("37 seconds after start");
    expect(relativeReminderLabel("due_date", 0)).toBe("At deadline");
  });
  it("prefers deadline for tasks and start for sessions", () => {
    expect(reminderAnchors(true, true, true, false)[0]?.value).toBe("due_date");
    expect(reminderAnchors(true, true, true, true)[0]?.value).toBe("start_date");
    const values = defaultTaskCreationValues({
      job: false,
      projectId: "1",
      today: "2026-11-07",
      date: undefined,
      jobStart: { date: "2026-11-07", time: "12:00" },
    });
    expect(creationReminderAnchors(values, false).some((anchor) => anchor.available)).toBe(false);
    expect(
      creationReminderAnchors({ ...values, planningEndsOn: "2026-11-30" }, false).find(
        (anchor) => anchor.available,
      )?.value,
    ).toBe("end_date");
  });
  it("serializes a native relative rule without an absolute timestamp", () => {
    const form = new FormData();
    expect(formReminders(form)).toBeNull();
    form.set("remindersPresent", "true");
    expect(formReminders(form)).toEqual([]);
    form.append("reminderAt", "");
    form.append("reminderLocalAt", "");
    form.append("reminderRelativeTo", "due_date");
    form.append("reminderRelativePeriod", "-7200");
    expect(formReminders(form)).toEqual([
      { at: null, localAt: null, relativeTo: "due_date", relativePeriod: -7200 },
    ]);
  });
});
