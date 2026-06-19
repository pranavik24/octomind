import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scheduleTasks } from "./scheduling.ts";

const user = {
	id: "user-1",
	name: "Student",
	picturePath: null,
};

const localIso = (year: number, monthIndex: number, day: number, hour: number, minute = 0) => {
	const date = new Date(year, monthIndex, day, hour, minute, 0, 0);
	return date.toISOString();
};

const overlaps = (
	a: { startDate: string; endDate: string },
	b: { startDate: string; endDate: string },
) => new Date(a.startDate) < new Date(b.endDate) && new Date(b.startDate) < new Date(a.endDate);

describe("task scheduling", () => {
	it("schedules short quick-win tasks in the earliest clean slot", () => {
		const [task] = scheduleTasks({
			tasks: [
				{
					id: 4,
					title: "Email teacher",
					description: "Ask a quick clarification question.",
					color: "Other",
					user,
					dueDate: localIso(2026, 5, 20, 18),
					estimatedHours: 0.5,
				},
			],
			busy: [],
			earliestStart: localIso(2026, 5, 18, 8),
			dayStartHour: 8,
			dayEndHour: 18,
		});

		assert.equal(task.scheduledBlocks?.[0]?.startDate, localIso(2026, 5, 18, 8));
		assert.equal(task.scheduledBlocks?.[0]?.endDate, localIso(2026, 5, 18, 8, 30));
	});

	it("never schedules task blocks before the earliest allowed start time", () => {
		const earliestStart = localIso(2026, 5, 18, 14, 17);
		const [task] = scheduleTasks({
			tasks: [
				{
					id: 6,
					title: "Review worksheet",
					description: "Check answers before submitting.",
					color: "Homework",
					user,
					dueDate: localIso(2026, 5, 18, 18),
					estimatedHours: 1,
				},
			],
			busy: [],
			earliestStart,
			dayStartHour: 8,
			dayEndHour: 18,
		});

		for (const block of task.scheduledBlocks ?? []) {
			assert.ok(new Date(block.startDate) >= new Date(earliestStart));
		}
		assert.equal(task.scheduledBlocks?.[0]?.startDate, localIso(2026, 5, 18, 14, 30));
	});

	it("spreads long future tasks across multiple days instead of stacking them at the deadline", () => {
		const [task] = scheduleTasks({
			tasks: [
				{
					id: 5,
					title: "Build history presentation",
					description: "Research, outline, draft slides, and rehearse.",
					color: "Projects",
					user,
					dueDate: localIso(2026, 5, 22, 18),
					estimatedHours: 4,
				},
			],
			busy: [],
			earliestStart: localIso(2026, 5, 18, 8),
			dayStartHour: 8,
			dayEndHour: 18,
		});

		const days = new Set(
			(task.scheduledBlocks ?? []).map((block) =>
				new Date(block.startDate).toDateString(),
			),
		);

		assert.equal(task.scheduledBlocks?.length, 4);
		assert.ok(days.size >= 3);
		assert.ok(
			new Date(task.scheduledBlocks?.at(-1)?.endDate ?? 0).getTime() <=
				new Date(localIso(2026, 5, 21, 18)).getTime(),
		);
	});

	it("splits tasks longer than one hour into chunks that finish before the due date", () => {
		const dueDate = localIso(2026, 5, 18, 18);
		const [task] = scheduleTasks({
			tasks: [
				{
					id: 1,
					title: "Practice SAT math timed section",
					description: "Do one timed module and review mistakes.",
					color: "Studying",
					user,
					dueDate,
					estimatedHours: 2.5,
				},
			],
			busy: [],
			earliestStart: localIso(2026, 5, 18, 8),
			dayStartHour: 8,
			dayEndHour: 18,
		});

		assert.equal(task.scheduledBlocks?.length, 3);
		for (const block of task.scheduledBlocks ?? []) {
			const start = new Date(block.startDate).getTime();
			const end = new Date(block.endDate).getTime();
			assert.ok(end <= new Date(dueDate).getTime());
			assert.ok(end - start <= 60 * 60 * 1000);
		}
	});

	it("avoids busy events and still schedules all chunks before the deadline", () => {
		const busy = {
			startDate: localIso(2026, 5, 18, 10),
			endDate: localIso(2026, 5, 18, 11),
		};
		const [task] = scheduleTasks({
			tasks: [
				{
					id: 2,
					title: "Write lab report",
					description: "Finish conclusion and data table.",
					color: "Homework",
					user,
					dueDate: localIso(2026, 5, 18, 12),
					estimatedHours: 1.5,
				},
			],
			busy: [busy],
			earliestStart: localIso(2026, 5, 18, 8),
			dayStartHour: 8,
			dayEndHour: 12,
		});

		assert.equal(task.scheduledBlocks?.length, 2);
		for (const block of task.scheduledBlocks ?? []) {
			assert.equal(overlaps(block, busy), false);
			assert.ok(new Date(block.endDate) <= new Date(localIso(2026, 5, 18, 12)));
		}
	});

	it("throws an explicit error when there is not enough free time", () => {
		assert.throws(
			() =>
				scheduleTasks({
					tasks: [
						{
							id: 3,
							title: "Impossible task",
							description: "No time remains.",
							color: "Other",
							user,
							dueDate: localIso(2026, 5, 18, 9),
							estimatedHours: 2,
						},
					],
					busy: [],
					earliestStart: localIso(2026, 5, 18, 8),
					dayStartHour: 8,
					dayEndHour: 9,
				}),
			/Unable to schedule task 3 before its due date/,
		);
	});
});
