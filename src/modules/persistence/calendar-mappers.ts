import type { IEvent, ITask, IUser } from "@/modules/components/calendar/interfaces";
import type { TEventColor } from "@/modules/components/calendar/types";

export interface PersistenceUser {
	id: string;
	email: string | null;
	name: string | null;
	image?: string | null;
	imageUrl?: string | null;
	timezone?: string | null;
}

export interface PersistedEventRow {
	id: string;
	title: string;
	description: string | null;
	location: string | null;
	color: TEventColor;
	startAt: Date;
	endAt: Date;
	recurrenceRule?: unknown;
}

export interface PersistedTaskBlockRow {
	id: string;
	startAt: Date;
	endAt: Date;
	position: number;
}

export interface PersistedTaskRow {
	id: string;
	title: string;
	description: string | null;
	color: TEventColor;
	dueAt: Date;
	estimatedMinutes: number;
	blocks?: PersistedTaskBlockRow[];
}

export interface PersistedEventInput {
	title: string;
	description: string;
	location?: string;
	color: TEventColor;
	startAt: Date;
	endAt: Date;
	recurrenceRule?: unknown;
}

export interface PersistedTaskInput {
	title: string;
	description: string;
	color: TEventColor;
	dueAt: Date;
	estimatedMinutes: number;
}

export function toUiUser(user: PersistenceUser): IUser {
	return {
		id: user.id,
		name: user.name ?? user.email ?? "Student",
		picturePath: user.image ?? user.imageUrl ?? null,
	};
}

export function toUiEvent(event: PersistedEventRow, user: PersistenceUser): IEvent {
	const uiEvent: IEvent = {
		id: event.id,
		startDate: event.startAt.toISOString(),
		endDate: event.endAt.toISOString(),
		title: event.title,
		location: event.location ?? undefined,
		color: event.color,
		description: event.description ?? "",
		user: toUiUser(user),
	};

	if (event.recurrenceRule) {
		uiEvent.recurrence = event.recurrenceRule as IEvent["recurrence"];
	}

	return uiEvent;
}

export function toPersistedEventInput(event: IEvent): PersistedEventInput {
	return {
		title: event.title,
		description: event.description,
		location: event.location,
		color: event.color,
		startAt: new Date(event.startDate),
		endAt: new Date(event.endDate),
		recurrenceRule: event.recurrence,
	};
}

export function toUiTask(task: PersistedTaskRow, user: PersistenceUser): ITask {
	return {
		id: task.id,
		dueDate: task.dueAt.toISOString(),
		estimatedHours: task.estimatedMinutes / 60,
		scheduledBlocks: (task.blocks ?? [])
			.toSorted((a, b) => a.position - b.position)
			.map((block) => ({
				startDate: block.startAt.toISOString(),
				endDate: block.endAt.toISOString(),
			})),
		scheduleStatus: { state: "scheduled" },
		title: task.title,
		color: task.color,
		description: task.description ?? "",
		user: toUiUser(user),
	};
}

export function toPersistedTaskInput(task: ITask): PersistedTaskInput {
	return {
		title: task.title,
		description: task.description,
		color: task.color,
		dueAt: new Date(task.dueDate),
		estimatedMinutes: Math.round((task.estimatedHours ?? 1) * 60),
	};
}
