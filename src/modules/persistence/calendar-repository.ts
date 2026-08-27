import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NotFoundError, SchedulingError } from "@/modules/api/auth";
import type { IEvent, ITask } from "@/modules/components/calendar/interfaces";
import { expandRecurringEvent } from "@/modules/components/calendar/recurrence";
import {
	type BusyInterval,
	eventFitsWithinSchoolHours,
	isTaskSchedulable,
	scheduleTasksResult,
} from "@/modules/components/calendar/scheduling";
import {
	type PersistenceUser,
	toPersistedEventInput,
	toPersistedTaskInput,
	toUiEvent,
	toUiTask,
} from "@/modules/persistence/calendar-mappers";

const taskInclude = {
	blocks: {
		orderBy: { position: "asc" as const },
	},
} satisfies Prisma.TaskInclude;

function prismaUserToPersistenceUser(user: {
	id: string;
	email: string | null;
	name: string | null;
	image: string | null;
	timezone?: string | null;
}): PersistenceUser {
	return {
		id: user.id,
		email: user.email,
		name: user.name,
		image: user.image,
		timezone: user.timezone,
	};
}

function toBusyIntervals(events: IEvent[]): BusyInterval[] {
	return events.map((event) => ({
		startDate: event.startDate,
		endDate: event.endDate,
	}));
}

function taskBlocksForCreate(
	userId: string,
	task: ITask,
): Prisma.TaskBlockCreateManyInput[] {
	return (task.scheduledBlocks ?? []).map((block, position) => ({
		taskId: task.id,
		userId,
		startAt: new Date(block.startDate),
		endAt: new Date(block.endDate),
		position,
		scheduleStatus: "scheduled",
	}));
}

async function getUserOrThrow(userId: string) {
	const user = await prisma.user.findUnique({ where: { id: userId } });
	if (!user) throw new NotFoundError("Authenticated user was not found.");
	return user;
}

async function assertEventOwnedByUser(userId: string, eventId: string) {
	const event = await prisma.event.findFirst({
		where: { id: eventId, userId },
		select: { id: true },
	});
	if (!event) throw new NotFoundError("Event not found.");
}

async function assertTaskOwnedByUser(userId: string, taskId: string) {
	const task = await prisma.task.findFirst({
		where: { id: taskId, userId },
		select: { id: true },
	});
	if (!task) throw new NotFoundError("Task not found.");
}

export async function getCalendarForUser(userId: string) {
	const [user, events, tasks] = await Promise.all([
		getUserOrThrow(userId),
		prisma.event.findMany({
			where: { userId },
			orderBy: { startAt: "asc" },
		}),
		prisma.task.findMany({
			where: { userId, status: "active" },
			include: taskInclude,
			orderBy: { dueAt: "asc" },
		}),
	]);
	const persistenceUser = prismaUserToPersistenceUser(user);

	return {
		users: [toUiEventUser(persistenceUser)],
		events: events.map((event) => toUiEvent(event, persistenceUser)),
		tasks: tasks.map((task) => toUiTask(task, persistenceUser)),
	};
}

function toUiEventUser(user: PersistenceUser) {
	return {
		id: user.id,
		name: user.name ?? user.email ?? "Student",
		picturePath: user.image ?? null,
	};
}

async function buildScheduledTasksForUser({
	userId,
	nextTask,
	omitTaskId,
	nextEvents,
}: {
	userId: string;
	nextTask?: ITask;
	omitTaskId?: string;
	nextEvents?: IEvent[];
}) {
	const user = prismaUserToPersistenceUser(await getUserOrThrow(userId));
	const [eventRows, taskRows] = await Promise.all([
		prisma.event.findMany({ where: { userId } }),
		prisma.task.findMany({
			where: { userId, status: "active" },
			include: taskInclude,
		}),
	]);
	const events = nextEvents ?? eventRows.map((event) => toUiEvent(event, user));
	const tasks = taskRows
		.filter((task) => task.id !== omitTaskId)
		.map((task) => toUiTask(task, user));
	const earliestStart = new Date();
	const schedulableTasks = tasks.filter((task) =>
		isTaskSchedulable(task, earliestStart),
	);
	const inputTasks = nextTask
		? [...schedulableTasks, nextTask]
		: schedulableTasks;
	const result = scheduleTasksResult({
		tasks: inputTasks,
		busyIntervals: toBusyIntervals(events),
		earliestStart,
		timezone: user.timezone ?? undefined,
	});

	if (result.status === "failed") {
		throw new SchedulingError(result.message, result.reason);
	}

	return result.tasks;
}

async function buildScheduledTasksForEventWrite({
	userId,
	nextEvents,
	eventOccurrences,
	existingEvents,
}: {
	userId: string;
	nextEvents: IEvent[];
	eventOccurrences: IEvent[];
	existingEvents: IEvent[];
}): Promise<ITask[] | null> {
	try {
		return await buildScheduledTasksForUser({ userId, nextEvents });
	} catch (error) {
		if (
			error instanceof SchedulingError &&
			error.reason === "INSUFFICIENT_CAPACITY" &&
			eventOccurrences.some((occurrence) =>
				eventFitsWithinSchoolHours(occurrence, existingEvents),
			)
		) {
			// Persisting a user event inside school hours must not be blocked by a
			// best-effort re-plan. Existing homework blocks remain unchanged, and
			// school remains protected for all future task scheduling.
			return null;
		}
		throw error;
	}
}

export async function createEventForUser(userId: string, event: IEvent) {
	const eventId = randomUUID();
	const eventSeries = event.recurrence
		? expandRecurringEvent({ ...event, id: eventId }, () => randomUUID())
		: [{ ...event, id: eventId }];
	const user = prismaUserToPersistenceUser(await getUserOrThrow(userId));
	const existingEvents = (
		await prisma.event.findMany({ where: { userId } })
	).map((row) => toUiEvent(row, user));
	const nextEvents = [...existingEvents, ...eventSeries];
	const scheduledTasks = await buildScheduledTasksForEventWrite({
		userId,
		nextEvents,
		eventOccurrences: eventSeries,
		existingEvents,
	});

	await prisma.$transaction(async (tx) => {
		await tx.event.createMany({
			data: eventSeries.map((occurrence) => {
				const input = toPersistedEventInput(occurrence);
				return {
					id: occurrence.id,
					userId,
					title: input.title,
					description: input.description,
					location: input.location,
					color: input.color,
					startAt: input.startAt,
					endAt: input.endAt,
				};
			}),
		});
		if (scheduledTasks) await replaceTaskBlocks(tx, userId, scheduledTasks);
	});

	return eventSeries;
}

export async function updateEventForUser(
	userId: string,
	eventId: string,
	event: IEvent,
) {
	await assertEventOwnedByUser(userId, eventId);
	const eventInput = toPersistedEventInput({ ...event, id: eventId });
	const user = prismaUserToPersistenceUser(await getUserOrThrow(userId));
	const existingEvents = (
		await prisma.event.findMany({ where: { userId } })
	).map((row) => toUiEvent(row, user));
	const nextEvents = existingEvents.map((existing) =>
		existing.id === eventId ? { ...event, id: eventId } : existing,
	);
	const scheduledTasks = await buildScheduledTasksForEventWrite({
		userId,
		nextEvents,
		eventOccurrences: [{ ...event, id: eventId }],
		existingEvents: existingEvents.filter((existing) => existing.id !== eventId),
	});

	await prisma.$transaction(async (tx) => {
		const result = await tx.event.updateMany({
			where: { id: eventId, userId },
			data: {
				title: eventInput.title,
				description: eventInput.description,
				location: eventInput.location,
				color: eventInput.color,
				startAt: eventInput.startAt,
				endAt: eventInput.endAt,
				recurrenceRule: eventInput.recurrenceRule as Prisma.InputJsonValue,
			},
		});
		if (result.count !== 1) throw new NotFoundError("Event not found.");
		if (scheduledTasks) await replaceTaskBlocks(tx, userId, scheduledTasks);
	});

	return {
		...event,
		id: eventId,
		startDate: eventInput.startAt.toISOString(),
		endDate: eventInput.endAt.toISOString(),
	};
}

export async function deleteEventForUser(userId: string, eventId: string) {
	await assertEventOwnedByUser(userId, eventId);
	const user = prismaUserToPersistenceUser(await getUserOrThrow(userId));
	const existingEvents = (
		await prisma.event.findMany({ where: { userId } })
	).map((row) => toUiEvent(row, user));
	const nextEvents = existingEvents.filter((event) => event.id !== eventId);
	const scheduledTasks = await buildScheduledTasksForUser({
		userId,
		nextEvents,
	});

	await prisma.$transaction(async (tx) => {
		const result = await tx.event.deleteMany({
			where: { id: eventId, userId },
		});
		if (result.count !== 1) throw new NotFoundError("Event not found.");
		await replaceTaskBlocks(tx, userId, scheduledTasks);
	});
}

export async function createTaskForUser(
	userId: string,
	task: ITask,
	external?: {
		provider?: "google_classroom";
		externalId?: string;
		externalCourseId?: string | null;
		externalUrl?: string | null;
		estimateSource?: "gemini" | "openai" | "ollama" | "local" | "manual";
		estimateModel?: string | null;
		estimateReason?: string | null;
	},
) {
	const existingExternalTask =
		external?.provider && external.externalId
			? await prisma.task.findFirst({
					where: {
						userId,
						externalProvider: external.provider,
						externalId: external.externalId,
					},
					select: { id: true },
				})
			: null;
	const taskId = existingExternalTask?.id ?? randomUUID();
	const nextTask = { ...task, id: taskId };
	const scheduledTasks = await buildScheduledTasksForUser({
		userId,
		nextTask,
		omitTaskId: taskId,
	});
	const scheduledTask = scheduledTasks.find((item) => item.id === taskId);
	if (!scheduledTask) throw new Error("Task was not scheduled.");
	const taskInput = toPersistedTaskInput(scheduledTask);

	await prisma.$transaction(async (tx) => {
		const data = {
			title: taskInput.title,
			description: taskInput.description,
			color: taskInput.color,
			dueAt: taskInput.dueAt,
			estimatedMinutes: taskInput.estimatedMinutes,
			estimateSource: external?.estimateSource ?? "manual",
			estimateModel: external?.estimateModel,
			estimateReason: external?.estimateReason,
			externalProvider: external?.provider,
			externalId: external?.externalId,
			externalUrl: external?.externalUrl,
		};
		if (existingExternalTask) {
			const result = await tx.task.updateMany({
				where: { id: taskId, userId },
				data,
			});
			if (result.count !== 1) throw new NotFoundError("Task not found.");
		} else {
			await tx.task.create({
				data: {
					id: taskId,
					userId,
					...data,
				},
			});
		}
		await replaceTaskBlocks(tx, userId, scheduledTasks);
		if (external?.provider && external.externalId) {
			await tx.externalItemMapping.upsert({
				where: {
					userId_provider_externalCourseId_externalItemId: {
						userId,
						provider: external.provider,
						externalCourseId: external.externalCourseId ?? "",
						externalItemId: external.externalId,
					},
				},
				create: {
					userId,
					provider: external.provider,
					externalCourseId: external.externalCourseId ?? "",
					externalItemId: external.externalId,
					taskId,
				},
				update: {
					taskId,
					lastSeenAt: new Date(),
				},
			});
		}
	});

	return scheduledTask;
}

export async function updateTaskForUser(
	userId: string,
	taskId: string,
	task: ITask,
) {
	await assertTaskOwnedByUser(userId, taskId);
	const scheduledTasks = await buildScheduledTasksForUser({
		userId,
		nextTask: { ...task, id: taskId },
		omitTaskId: taskId,
	});
	const scheduledTask = scheduledTasks.find((item) => item.id === taskId);
	if (!scheduledTask) throw new SchedulingError();
	const taskInput = toPersistedTaskInput(scheduledTask);

	await prisma.$transaction(async (tx) => {
		const result = await tx.task.updateMany({
			where: { id: taskId, userId },
			data: {
				title: taskInput.title,
				description: taskInput.description,
				color: taskInput.color,
				dueAt: taskInput.dueAt,
				estimatedMinutes: taskInput.estimatedMinutes,
				estimateSource: "manual",
				estimateModel: null,
				estimateReason: null,
			},
		});
		if (result.count !== 1) throw new NotFoundError("Task not found.");
		await replaceTaskBlocks(tx, userId, scheduledTasks);
	});

	return scheduledTask;
}

export async function deleteTaskForUser(userId: string, taskId: string) {
	await assertTaskOwnedByUser(userId, taskId);
	const result = await prisma.task.deleteMany({
		where: { id: taskId, userId },
	});
	if (result.count !== 1) throw new NotFoundError("Task not found.");
}

async function replaceTaskBlocks(
	tx: Prisma.TransactionClient,
	userId: string,
	tasks: ITask[],
) {
	await tx.taskBlock.deleteMany({ where: { userId } });
	for (const task of tasks) {
		const rows = taskBlocksForCreate(userId, task);
		if (rows.length > 0) {
			await tx.taskBlock.createMany({ data: rows });
		}
	}
}
