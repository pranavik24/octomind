import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { mergeDatePreservingTime } from "./date-time-utils.ts";
import { eventSchema, taskSchema } from "./schemas.ts";

const calendarContextSource = readFileSync(
	new URL("./contexts/calendar-context.tsx", import.meta.url),
	"utf8",
);

describe("calendar date selection", () => {
	it("defaults new calendar sessions to 12-hour time", () => {
		assert.match(
			calendarContextSource,
			/const DEFAULT_SETTINGS[\s\S]*?use24HourFormat:\s*false/,
		);
	});

	it("preserves the selected event or task time when changing its date", () => {
		const selectedDate = new Date(2026, 7, 28, 0, 0, 0, 0);
		const currentValue = new Date(2026, 7, 27, 14, 35, 42, 123);

		const result = mergeDatePreservingTime(selectedDate, currentValue);

		assert.equal(result.getFullYear(), 2026);
		assert.equal(result.getMonth(), 7);
		assert.equal(result.getDate(), 28);
		assert.equal(result.getHours(), 14);
		assert.equal(result.getMinutes(), 35);
		assert.equal(result.getSeconds(), 42);
		assert.equal(result.getMilliseconds(), 123);
	});

	it("defaults a date with no current value to the picker-selected instant", () => {
		const selectedDate = new Date(2026, 7, 28, 0, 0, 0, 0);

		assert.equal(
			mergeDatePreservingTime(selectedDate).getTime(),
			selectedDate.getTime(),
		);
	});

	it("does not mutate either date input", () => {
		const selectedDate = new Date(2026, 7, 28, 0, 0, 0, 0);
		const currentValue = new Date(2026, 7, 27, 14, 35, 42, 123);
		const selectedBefore = selectedDate.getTime();
		const currentBefore = currentValue.getTime();

		mergeDatePreservingTime(selectedDate, currentValue);

		assert.equal(selectedDate.getTime(), selectedBefore);
		assert.equal(currentValue.getTime(), currentBefore);
	});

	it("keeps optional event location in the validated form values", () => {
		const result = eventSchema.parse({
			title: "Lab",
			location: "Room 204",
			description: "Bring goggles",
			startDate: new Date(2026, 7, 28, 10),
			endDate: new Date(2026, 7, 28, 11),
			color: "School",
		});

		assert.equal(result.location, "Room 204");
	});

	it("rejects reversed event times in the client form", () => {
		const result = eventSchema.safeParse({
			title: "Lab",
			startDate: new Date(2026, 7, 28, 11),
			endDate: new Date(2026, 7, 28, 10),
			color: "School",
		});

		assert.equal(result.success, false);
	});

	it("rejects invalid homework form values before an API request", () => {
		const result = taskSchema.safeParse({
			title: "   ",
			description: "",
			dueDate: new Date(2026, 7, 28, 23, 59),
			estimatedHours: 0.25,
			color: "Homework",
		});

		assert.equal(result.success, false);
	});

	it("accepts a valid homework form with a manual estimate", () => {
		const result = taskSchema.safeParse({
			title: "Finish essay",
			description: "Use the assigned sources",
			dueDate: new Date(2026, 7, 28, 23, 59),
			estimatedHours: 2,
			color: "Homework",
		});

		assert.equal(result.success, true);
	});
});
