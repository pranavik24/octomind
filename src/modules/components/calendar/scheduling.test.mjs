import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scheduleTasksResult } from "./scheduling.ts";

const task = (id, dueDate, estimatedHours = 1) => ({
	id,
	dueDate,
	estimatedHours,
});

const busy = (startDate, endDate) => ({ startDate, endDate });

const minutesBetween = (startDate, endDate) =>
	(new Date(endDate).getTime() - new Date(startDate).getTime()) / 60000;

const intervalsOverlap = (a, b) =>
	new Date(a.startDate) < new Date(b.endDate) &&
	new Date(b.startDate) < new Date(a.endDate);

const allBlocks = (tasks) => tasks.flatMap((scheduledTask) => scheduledTask.scheduledBlocks);

describe("scheduleTasks", () => {
	it("schedules every task block to finish no later than the due date", () => {
		const dueDate = "2026-06-18T17:00:00.000Z";

		const result = scheduleTasksResult({
			tasks: [task("1", dueDate, 2.5)],
			busyIntervals: [],
		});

		assert.equal(result.status, "scheduled");

		const [scheduledTask] = result.tasks;
		assert.equal(scheduledTask.estimatedHours, 2.5);
		assert.equal(
			scheduledTask.scheduledBlocks.reduce(
				(total, block) => total + minutesBetween(block.startDate, block.endDate),
				0,
			),
			150,
		);

		for (const block of scheduledTask.scheduledBlocks) {
			assert.ok(
				new Date(block.endDate).getTime() <= new Date(dueDate).getTime(),
				`${block.endDate} should finish before ${dueDate}`,
			);
		}
	});

	it("splits tasks longer than one hour into chunks of at most one hour", () => {
		const result = scheduleTasksResult({
			tasks: [task("1", "2026-06-18T17:00:00.000Z", 3)],
			busyIntervals: [],
		});

		assert.equal(result.status, "scheduled");
		assert.ok(result.tasks[0].scheduledBlocks.length > 1);

		for (const block of result.tasks[0].scheduledBlocks) {
			assert.ok(
				minutesBetween(block.startDate, block.endDate) <= 60,
				`${block.startDate} to ${block.endDate} exceeded 60 minutes`,
			);
		}
	});

	it("avoids busy events and previously scheduled task chunks", () => {
		const result = scheduleTasksResult({
			tasks: [
				task("1", "2026-06-18T17:00:00.000Z", 1),
				task("2", "2026-06-18T17:00:00.000Z", 1),
			],
			busyIntervals: [busy("2026-06-18T15:00:00.000Z", "2026-06-18T16:00:00.000Z")],
		});

		assert.equal(result.status, "scheduled");

		const blocks = allBlocks(result.tasks);
		for (const block of blocks) {
			assert.equal(
				intervalsOverlap(
					block,
					busy("2026-06-18T15:00:00.000Z", "2026-06-18T16:00:00.000Z"),
				),
				false,
			);
		}

		for (let index = 0; index < blocks.length; index++) {
			for (let otherIndex = index + 1; otherIndex < blocks.length; otherIndex++) {
				assert.equal(intervalsOverlap(blocks[index], blocks[otherIndex]), false);
			}
		}
	});

	it("returns an explicit failure when capacity before the due date is insufficient", () => {
		const result = scheduleTasksResult({
			tasks: [task("7", "2026-06-18T17:00:00.000Z", 1)],
			busyIntervals: [busy("2026-06-11T00:00:00.000Z", "2026-06-18T17:00:00.000Z")],
			scheduleWindowDays: 7,
		});

		assert.equal(result.status, "failed");
		assert.equal(result.reason, "INSUFFICIENT_CAPACITY");
		assert.equal(result.taskId, "7");
		assert.match(result.message, /before its due date/i);
	});

	it("returns an explicit failure for invalid due dates without mutating input tasks", () => {
		const inputTasks = [task("9", "not-a-date", 1)];

		const result = scheduleTasksResult({
			tasks: inputTasks,
			busyIntervals: [],
		});

		assert.equal(result.status, "failed");
		assert.equal(result.reason, "INVALID_DUE_DATE");
		assert.equal(result.taskId, "9");
		assert.deepEqual(inputTasks, [task("9", "not-a-date", 1)]);
	});
});
