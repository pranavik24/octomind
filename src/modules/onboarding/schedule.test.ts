import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildOnboardingEvents } from "./schedule.ts";

function localParts(date: Date, timeZone: string) {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	}).formatToParts(date);
	return Object.fromEntries(parts.map((part) => [part.type, part.value]));
}

describe("first-login schedule generation", () => {
	it("creates sleep blocks at the requested local times across DST", () => {
		const events = buildOnboardingEvents({
			timezone: "America/New_York",
			sleepTime: "23:00",
			wakeTime: "07:00",
			schoolDays: [],
			schoolStartTime: "08:00",
			schoolEndTime: "15:00",
			startDate: new Date("2026-03-07T17:00:00.000Z"),
			days: 3,
		});

		assert.equal(events.length, 3);
		for (const event of events) {
			assert.equal(event.title, "Sleep");
			assert.equal(localParts(event.startAt, "America/New_York").hour, "23");
			assert.equal(localParts(event.endAt, "America/New_York").hour, "07");
			assert.ok(event.endAt > event.startAt);
		}
	});

	it("creates school only on selected weekdays for the requested horizon", () => {
		const events = buildOnboardingEvents({
			timezone: "America/New_York",
			sleepTime: "23:00",
			wakeTime: "07:00",
			schoolDays: [1, 3, 5],
			schoolStartTime: "08:30",
			schoolEndTime: "15:15",
			startDate: new Date("2026-06-21T16:00:00.000Z"),
			days: 7,
		}).filter((event) => event.title === "School");

		assert.equal(events.length, 3);
		assert.deepEqual(
			events.map((event) => event.localWeekday),
			[1, 3, 5],
		);
		for (const event of events) {
			assert.equal(localParts(event.startAt, "America/New_York").hour, "08");
			assert.equal(localParts(event.startAt, "America/New_York").minute, "30");
			assert.equal(localParts(event.endAt, "America/New_York").hour, "15");
			assert.equal(localParts(event.endAt, "America/New_York").minute, "15");
		}
	});
});
