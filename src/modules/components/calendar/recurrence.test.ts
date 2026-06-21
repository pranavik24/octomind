import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	expandRecurringEvent,
	recurrenceForPreset,
	recurrenceOptionsForDate,
} from "./recurrence.ts";

const user = { id: "user", name: "Student", picturePath: null };

describe("date-aware recurrence presets", () => {
	it("adapts quick labels to Sunday, June 21", () => {
		const labels = recurrenceOptionsForDate(new Date(2026, 5, 21)).map(
			(option) => option.label,
		);
		assert.deepEqual(labels, [
			"Does not repeat",
			"Daily",
			"Weekly on Sunday",
			"Monthly on the third Sunday",
			"Annually on June 21",
			"Every weekday (Monday to Friday)",
			"Custom...",
		]);
	});

	it("uses the selected event day for labels and recurrence rules", () => {
		const date = new Date(2026, 8, 8);
		const labels = recurrenceOptionsForDate(date).map((option) => option.label);
		assert.ok(labels.includes("Weekly on Tuesday"));
		assert.ok(labels.includes("Monthly on the second Tuesday"));
		assert.ok(labels.includes("Annually on September 8"));

		assert.deepEqual(recurrenceForPreset("weekdays", date), {
			freq: "weekly",
			interval: 1,
			count: 260,
			byweekday: [1, 2, 3, 4, 5],
		});
	});

	it("expands a monthly nth-weekday rule on the matching weekday", () => {
		const event = {
			id: "series",
			startDate: new Date(2026, 5, 21, 10).toISOString(),
			endDate: new Date(2026, 5, 21, 11).toISOString(),
			title: "Review",
			color: "Studying" as const,
			description: "",
			user,
			recurrence: {
				freq: "monthly" as const,
				interval: 1,
				count: 3,
				byweekday: [0],
				bysetpos: 3,
			},
		};
		const occurrences = expandRecurringEvent(
			event,
			(index) => `event-${index}`,
		);

		assert.deepEqual(
			occurrences.map((occurrence) =>
				new Date(occurrence.startDate).toLocaleDateString("en-CA"),
			),
			["2026-06-21", "2026-07-19", "2026-08-16"],
		);
	});
});
