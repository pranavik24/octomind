import assert from "node:assert/strict";
import { describe, it } from "node:test";

// Keep this suite independent from the host machine timezone. The bug it
// covers is specifically the difference between the server timezone and the
// student's configured timezone.
process.env.TZ = "UTC";

const {
	eventFitsWithinSchoolHours,
	isTaskSchedulable,
	scheduleTasksResult,
} = await import("./scheduling.ts");

const task = (id, dueDate, estimatedHours = 1) => ({
	id,
	dueDate,
	estimatedHours,
});

const busy = (startDate, endDate) => ({ startDate, endDate });

const localParts = (value, timeZone) => {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		hourCycle: "h23",
	})
		.formatToParts(new Date(value))
		.reduce((result, part) => {
			if (part.type !== "literal") result[part.type] = part.value;
			return result;
		}, {});
	return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
};

const overlaps = (a, b) =>
	new Date(a.startDate) < new Date(b.endDate) &&
	new Date(b.startDate) < new Date(a.endDate);

const allBlocks = (result) =>
	result.status === "scheduled"
		? result.tasks.flatMap((scheduledTask) => scheduledTask.scheduledBlocks)
		: [];

describe("task/event insertion scheduling regressions", () => {
	it("recognizes events contained by protected school hours", () => {
		const schoolHours = {
			startDate: "2026-08-27T12:00:00.000Z",
			endDate: "2026-08-27T19:00:00.000Z",
			color: "School",
		};

		assert.equal(
			eventFitsWithinSchoolHours(
				{
					startDate: "2026-08-27T15:00:00.000Z",
					endDate: "2026-08-27T16:00:00.000Z",
				},
				[schoolHours],
			),
			true,
		);
		assert.equal(
			eventFitsWithinSchoolHours(
				{
					startDate: "2026-08-27T19:00:00.000Z",
					endDate: "2026-08-27T20:00:00.000Z",
				},
				[schoolHours],
			),
			false,
		);
	});

	it("schedules a same-day task using the student's timezone, not the server timezone", () => {
		const result = scheduleTasksResult({
			tasks: [task("same-day", "2026-08-27T03:59:00.000Z", 1)],
			busyIntervals: [],
			earliestStart: "2026-08-27T02:00:00.000Z",
			timezone: "America/New_York",
		});

		assert.equal(result.status, "scheduled");
		assert.equal(
			localParts(result.tasks[0].scheduledBlocks[0].startDate, "America/New_York"),
			"2026-08-26 22:00",
		);
		assert.equal(
			localParts(result.tasks[0].scheduledBlocks[0].endDate, "America/New_York"),
			"2026-08-26 23:00",
		);
	});

	it("keeps all task blocks inside the configured local workday across a DST boundary", () => {
		const result = scheduleTasksResult({
			tasks: [task("dst-task", "2026-11-02T04:59:00.000Z", 2)],
			busyIntervals: [],
			earliestStart: "2026-11-01T22:00:00.000Z",
			timezone: "America/New_York",
			dayStartHour: 6,
			dayEndHour: 23,
		});

		assert.equal(result.status, "scheduled");
		for (const block of result.tasks[0].scheduledBlocks) {
			const start = localParts(block.startDate, "America/New_York");
			const end = localParts(block.endDate, "America/New_York");
			assert.match(start, /^2026-11-01 (0[6-9]|1\d|2[0-2]):/);
			assert.match(end, /^2026-11-01 (0[6-9]|1\d|2[0-2]|23):/);
		}
	});

	it("uses open time around a busy event instead of reporting a false capacity failure", () => {
		const result = scheduleTasksResult({
			tasks: [task("busy-day", "2026-08-27T03:59:00.000Z", 3)],
			busyIntervals: [busy("2026-08-27T01:00:00.000Z", "2026-08-27T02:00:00.000Z")],
			earliestStart: "2026-08-26T22:00:00.000Z",
			timezone: "America/New_York",
		});

		assert.equal(result.status, "scheduled");
		assert.equal(result.tasks[0].scheduledBlocks.length, 3);
		assert.ok(
			result.tasks[0].scheduledBlocks.every(
				(block) => !overlaps(block, busy("2026-08-27T01:00:00.000Z", "2026-08-27T02:00:00.000Z")),
			),
		);
	});

	it("does not overlap blocks when two tasks are inserted together", () => {
		const result = scheduleTasksResult({
			tasks: [
				task("first", "2026-08-28T03:59:00.000Z", 2),
				task("second", "2026-08-28T03:59:00.000Z", 2),
			],
			busyIntervals: [],
			earliestStart: "2026-08-27T12:00:00.000Z",
			timezone: "America/New_York",
		});

		assert.equal(result.status, "scheduled");
		const blocks = allBlocks(result);
		for (let index = 0; index < blocks.length; index += 1) {
			for (let otherIndex = index + 1; otherIndex < blocks.length; otherIndex += 1) {
				assert.equal(overlaps(blocks[index], blocks[otherIndex]), false);
			}
		}
	});

	it("allows busy intervals that only touch a candidate block boundary", () => {
		const result = scheduleTasksResult({
			tasks: [task("touching-boundary", "2026-08-27T16:00:00.000Z", 1)],
			busyIntervals: [busy("2026-08-27T12:00:00.000Z", "2026-08-27T13:00:00.000Z")],
			earliestStart: "2026-08-27T12:00:00.000Z",
			timezone: "America/New_York",
			dayStartHour: 8,
			dayEndHour: 16,
		});

		assert.equal(result.status, "scheduled");
		assert.ok(result.tasks[0].scheduledBlocks.length > 0);
	});

	it("returns a specific failure for malformed busy intervals before attempting insertion", () => {
		const result = scheduleTasksResult({
			tasks: [task("malformed-busy", "2026-08-28T16:00:00.000Z")],
			busyIntervals: [busy("2026-08-28T13:00:00.000Z", "2026-08-28T12:00:00.000Z")],
			timezone: "America/New_York",
		});

		assert.deepEqual(
			{ status: result.status, reason: result.reason },
			{ status: "failed", reason: "INVALID_BUSY_INTERVAL" },
		);
	});

	it("does not treat a task due exactly at the current instant as schedulable", () => {
		assert.equal(
			isTaskSchedulable(task("now", "2026-08-27T12:00:00.000Z"), "2026-08-27T12:00:00.000Z"),
			false,
		);
	});

	it("does not mutate task input while scheduling an insertion", () => {
		const input = [task("immutable", "2026-08-28T16:00:00.000Z", 1)];
		const before = structuredClone(input);

		scheduleTasksResult({
			tasks: input,
			busyIntervals: [],
			timezone: "America/New_York",
		});

		assert.deepEqual(input, before);
	});
});
