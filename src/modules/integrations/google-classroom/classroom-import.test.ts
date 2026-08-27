import assert from "node:assert/strict";
import test from "node:test";
import {
	buildClassroomTaskInput,
	classroomDueAt,
	classroomExternalId,
} from "./classroom-import.ts";

test("classroomDueAt uses provided due time when present", () => {
	const dueAt = classroomDueAt(
		{
			year: 2026,
			month: 6,
			day: 20,
		},
		{
			hours: 14,
			minutes: 30,
		},
	);

	assert.equal(dueAt.toISOString(), "2026-06-20T14:30:00.000Z");
});

test("classroomDueAt defaults missing due time to end of day", () => {
	const dueAt = classroomDueAt({
		year: 2026,
		month: 6,
		day: 20,
	});

	assert.equal(dueAt.toISOString(), "2026-06-20T23:59:00.000Z");
});

test("buildClassroomTaskInput returns null for coursework without a due date", () => {
	const taskInput = buildClassroomTaskInput({
		courseId: "math-101",
		courseName: "Math",
		courseWork: {
			id: "cw-1",
			title: "Read chapter 3",
			state: "PUBLISHED",
		},
		estimatedMinutes: 60,
	});

	assert.equal(taskInput, null);
});

test("buildClassroomTaskInput creates stable imported task payload", () => {
	const taskInput = buildClassroomTaskInput({
		courseId: "math-101",
		courseName: "Math",
		courseWork: {
			id: "cw-1",
			title: "Problem Set",
			description: "Complete odds only.",
			state: "PUBLISHED",
			alternateLink: "https://classroom.google.com/c/example",
			dueDate: { year: 2026, month: 6, day: 21 },
		},
		estimatedMinutes: 90,
		estimateReason: "AI estimate",
	});

	assert.deepEqual(taskInput, {
		title: "Problem Set",
		description: "Math: Complete odds only.",
		color: "Homework",
		dueDate: "2026-06-21T23:59:00.000Z",
		estimatedHours: 1.5,
		externalProvider: "google_classroom",
		externalId: classroomExternalId("math-101", "cw-1"),
		externalCourseId: "math-101",
		externalUrl: "https://classroom.google.com/c/example",
		estimateSource: "gemini",
		estimateModel: null,
		estimateReason: "AI estimate",
	});
});
