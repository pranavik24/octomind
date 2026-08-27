"use client";

import type React from "react";
import { createContext, useContext, useMemo, useState } from "react";
import {
	createPersistedEvent,
	createPersistedTask,
	deletePersistedEvent,
	deletePersistedTask,
	updatePersistedEvent,
	updatePersistedTask,
} from "@/modules/components/calendar/calendar-persistence";
import { useLocalStorage } from "@/modules/components/calendar/hooks";
import type {
	IEvent,
	ITask,
	IUser,
} from "@/modules/components/calendar/interfaces";
import { expandRecurringEvent } from "@/modules/components/calendar/recurrence";
import {
	type BusyInterval,
	isTaskSchedulable,
	normalizeTaskDurationHours,
	type ScheduledBlock,
	scheduleTasksResult,
	TaskSchedulingError,
	type TaskSchedulingFailure,
	eventFitsWithinSchoolHours,
} from "@/modules/components/calendar/scheduling";
import type {
	TCalendarView,
	TEventColor,
} from "@/modules/components/calendar/types";

interface ICalendarContext {
	selectedDate: Date;
	view: TCalendarView;
	setView: (view: TCalendarView) => void;
	use24HourFormat: boolean;
	toggleTimeFormat: () => void;
	setSelectedDate: (date: Date | undefined) => void;
	selectedUserId: IUser["id"] | "all";
	setSelectedUserId: (userId: IUser["id"] | "all") => void;
	badgeVariant: "dot" | "colored";
	setBadgeVariant: (variant: "dot" | "colored") => void;
	selectedColors: TEventColor[];
	filterEventsBySelectedColors: (colors: TEventColor) => void;
	filterEventsBySelectedUser: (userId: IUser["id"] | "all") => void;
	users: IUser[];
	events: IEvent[];
	tasks: ITask[];
	persistenceEnabled: boolean;
	addEvent: (event: IEvent) => Promise<void>;
	updateEvent: (event: IEvent) => Promise<void>;
	removeEvent: (eventId: string) => Promise<void>;
	clearFilter: () => void;
	addTask: (task: ITask) => Promise<void>;
	updateTask: (task: ITask) => Promise<void>;
	removeTask: (taskId: string) => Promise<void>;
}

interface CalendarSettings {
	badgeVariant: "dot" | "colored";
	view: TCalendarView | "agenda";
	use24HourFormat: boolean;
}

const DEFAULT_SETTINGS: CalendarSettings = {
	badgeVariant: "colored",
	view: "day",
	use24HourFormat: false,
};

const CalendarContext = createContext({} as ICalendarContext);

const buildBusyIntervals = (events: IEvent[]): BusyInterval[] =>
	events.map((event) => ({
		startDate: event.startDate,
		endDate: event.endDate,
	}));

const currentSchedulingStart = () => new Date();

const deferredTaskMessage =
	"This task is past due or has an invalid due date. Update the deadline to schedule it.";

const coalesceTouchingBlocks = (blocks: ScheduledBlock[]): ScheduledBlock[] => {
	const sortedBlocks = [...blocks].sort(
		(a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
	);
	const coalesced: ScheduledBlock[] = [];

	for (const block of sortedBlocks) {
		const previous = coalesced.at(-1);

		if (
			previous &&
			new Date(previous.endDate).getTime() >=
				new Date(block.startDate).getTime()
		) {
			coalesced[coalesced.length - 1] = {
				startDate: previous.startDate,
				endDate:
					new Date(block.endDate) > new Date(previous.endDate)
						? block.endDate
						: previous.endDate,
			};
			continue;
		}

		coalesced.push(block);
	}

	return coalesced;
};

const applySchedulingFailure = (
	tasks: ITask[],
	failure: TaskSchedulingFailure<ITask>,
): ITask[] => {
	const scheduledById = new Map(
		failure.scheduledTasks.map((task) => [task.id, task]),
	);

	return tasks.map((task) => {
		const scheduledTask = scheduledById.get(task.id);
		if (scheduledTask) return scheduledTask;

		const isDirectFailure =
			failure.taskId === undefined || failure.taskId === task.id;
		const reason = isDirectFailure ? failure.reason : "SCHEDULING_BLOCKED";
		const message = isDirectFailure
			? failure.message
			: "Task was not scheduled because another task failed scheduling.";

		return {
			...task,
			estimatedHours: normalizeTaskDurationHours(task.estimatedHours),
			scheduledBlocks: [],
			scheduleStatus: {
				state: "failed",
				reason,
				message,
			},
		};
	});
};

const scheduleCalendarTasks = (tasks: ITask[], events: IEvent[]): ITask[] => {
	const earliestStart = currentSchedulingStart();
	const schedulableTasks = tasks.filter((task) =>
		isTaskSchedulable(task, earliestStart),
	);
	const result = scheduleTasksResult({
		tasks: schedulableTasks,
		busyIntervals: buildBusyIntervals(events),
		earliestStart,
	});

	if (result.status === "scheduled") {
		const scheduledById = new Map(result.tasks.map((task) => [task.id, task]));
		return tasks.map(
			(task) =>
				scheduledById.get(task.id) ?? {
					...task,
					estimatedHours: normalizeTaskDurationHours(task.estimatedHours),
					scheduledBlocks: [],
					scheduleStatus: {
						state: "failed" as const,
						reason: "SCHEDULING_BLOCKED" as const,
						message: deferredTaskMessage,
					},
				},
		);
	}
	return applySchedulingFailure(tasks, result);
};

const requireScheduledCalendarTasks = (
	tasks: ITask[],
	events: IEvent[],
	requiredTaskId?: string,
): ITask[] => {
	const earliestStart = currentSchedulingStart();
	const schedulableTasks = tasks.filter(
		(task) =>
			task.id === requiredTaskId || isTaskSchedulable(task, earliestStart),
	);
	const result = scheduleTasksResult({
		tasks: schedulableTasks,
		busyIntervals: buildBusyIntervals(events),
		earliestStart,
	});

	if (result.status === "scheduled") {
		const scheduledById = new Map(result.tasks.map((task) => [task.id, task]));
		return tasks.map(
			(task) =>
				scheduledById.get(task.id) ?? {
					...task,
					estimatedHours: normalizeTaskDurationHours(task.estimatedHours),
					scheduledBlocks: [],
					scheduleStatus: {
						state: "failed" as const,
						reason: "SCHEDULING_BLOCKED" as const,
						message: deferredTaskMessage,
					},
				},
		);
	}
	throw new TaskSchedulingError(result);
};

const scheduleTasksForEventWrite = ({
	tasks,
	nextEvents,
	eventOccurrences,
	existingEvents,
}: {
	tasks: ITask[];
	nextEvents: IEvent[];
	eventOccurrences: IEvent[];
	existingEvents: IEvent[];
}): ITask[] => {
	try {
		return requireScheduledCalendarTasks(tasks, nextEvents);
	} catch (error) {
		if (
			error instanceof TaskSchedulingError &&
			error.reason === "INSUFFICIENT_CAPACITY" &&
			eventOccurrences.some((occurrence) =>
				eventFitsWithinSchoolHours(occurrence, existingEvents),
			)
		) {
			// A user event inside protected school hours does not consume any
			// homework time that was already available. Keep the current blocks
			// when re-planning cannot find an equivalent schedule.
			return tasks;
		}
		throw error;
	}
};

export function CalendarProvider({
	children,
	users,
	events,
	tasks = [],
	badge = "colored",
	view = "day",
	persistenceEnabled = false,
}: {
	children: React.ReactNode;
	users: IUser[];
	events: IEvent[];
	tasks?: ITask[];
	view?: TCalendarView;
	badge?: "dot" | "colored";
	persistenceEnabled?: boolean;
}) {
	const [settings, setSettings] = useLocalStorage<CalendarSettings>(
		"calendar-settings",
		{
			...DEFAULT_SETTINGS,
			badgeVariant: badge,
			view: view,
		},
	);

	const [badgeVariant, setBadgeVariantState] = useState<"dot" | "colored">(
		settings.badgeVariant,
	);
	const initialView: TCalendarView =
		settings.view === "day" ||
		settings.view === "week" ||
		settings.view === "month" ||
		settings.view === "year"
			? settings.view
			: view;
	const [currentView, setCurrentViewState] =
		useState<TCalendarView>(initialView);
	const [use24HourFormat, setUse24HourFormatState] = useState<boolean>(
		settings.use24HourFormat,
	);

	const [selectedDate, setSelectedDate] = useState(new Date());
	const [selectedUserId, setSelectedUserId] = useState<IUser["id"] | "all">(
		"all",
	);
	const [selectedColors, setSelectedColors] = useState<TEventColor[]>([]);

	const [allEvents, setAllEvents] = useState<IEvent[]>(events || []);
	const [filteredEvents, setFilteredEvents] = useState<IEvent[]>(events || []);

	const initialScheduledTasks = useMemo(
		() => scheduleCalendarTasks(tasks || [], events || []),
		[tasks, events],
	);
	const [allTasks, setAllTasks] = useState<ITask[]>(initialScheduledTasks);
	const [filteredTasks, setFilteredTasks] = useState<ITask[]>(
		initialScheduledTasks,
	);

	const updateSettings = (newPartialSettings: Partial<CalendarSettings>) => {
		setSettings({
			...settings,
			...newPartialSettings,
		});
	};

	const setBadgeVariant = (variant: "dot" | "colored") => {
		setBadgeVariantState(variant);
		updateSettings({ badgeVariant: variant });
	};

	const setView = (newView: TCalendarView) => {
		setCurrentViewState(newView);
		updateSettings({ view: newView });
	};

	const toggleTimeFormat = () => {
		const newValue = !use24HourFormat;
		setUse24HourFormatState(newValue);
		updateSettings({ use24HourFormat: newValue });
	};

	const filterEventsBySelectedColors = (color: TEventColor) => {
		const isColorSelected = selectedColors.includes(color);
		const newColors = isColorSelected
			? selectedColors.filter((c) => c !== color)
			: [...selectedColors, color];

		if (newColors.length > 0) {
			const filtered = allEvents.filter((event) => {
				const eventColor = event.color || "Other";
				return newColors.includes(eventColor);
			});
			setFilteredEvents(filtered);
		} else {
			setFilteredEvents(allEvents);
		}

		setSelectedColors(newColors);
	};

	const filterEventsBySelectedUser = (userId: IUser["id"] | "all") => {
		setSelectedUserId(userId);
		if (userId === "all") {
			setFilteredEvents(allEvents);
		} else {
			const filtered = allEvents.filter((event) => event.user.id === userId);
			setFilteredEvents(filtered);
		}
	};

	const handleSelectDate = (date: Date | undefined) => {
		if (!date) return;
		setSelectedDate(date);
	};

	const addEvent = async (event: IEvent) => {
		const localOccurrences = event.recurrence
			? expandRecurringEvent(event)
			: [event];
		const scheduledTasks = scheduleTasksForEventWrite({
			tasks: allTasks,
			nextEvents: [...allEvents, ...localOccurrences],
			eventOccurrences: localOccurrences,
			existingEvents: allEvents,
		});
		const persistedEvents = persistenceEnabled
			? await createPersistedEvent(event)
			: localOccurrences;
		const nextEvents = [...allEvents, ...persistedEvents];

		setAllEvents(nextEvents);
		setFilteredEvents((prev) => [...prev, ...persistedEvents]);
		setAllTasks(scheduledTasks);
		setFilteredTasks(scheduledTasks);
	};

	const updateEvent = async (event: IEvent) => {
		const updated = {
			...event,
			startDate: new Date(event.startDate).toISOString(),
			endDate: new Date(event.endDate).toISOString(),
		};

		const nextEvents = allEvents.map((e) => (e.id === event.id ? updated : e));
		const scheduledTasks = scheduleTasksForEventWrite({
			tasks: allTasks,
			nextEvents,
			eventOccurrences: [updated],
			existingEvents: allEvents.filter((item) => item.id !== event.id),
		});
		const persistedEvent = persistenceEnabled
			? await updatePersistedEvent(updated)
			: updated;

		setAllEvents((prev) =>
			prev.map((item) => (item.id === event.id ? persistedEvent : item)),
		);
		setFilteredEvents((prev) =>
			prev.map((item) => (item.id === event.id ? persistedEvent : item)),
		);
		setAllTasks(scheduledTasks);
		setFilteredTasks(scheduledTasks);
	};

	const removeEvent = async (eventId: string) => {
		const nextEvents = allEvents.filter((e) => e.id !== eventId);
		const scheduledTasks = rescheduleAllTasks(allTasks, nextEvents);
		if (persistenceEnabled) await deletePersistedEvent(eventId);

		setAllEvents(nextEvents);
		setFilteredEvents((prev) => prev.filter((e) => e.id !== eventId));
		setAllTasks(scheduledTasks);
		setFilteredTasks(scheduledTasks);
	};

	const rescheduleAllTasks = (
		inputTasks: ITask[],
		inputEvents = allEvents,
		requiredTaskId?: string,
	): ITask[] => {
		return requireScheduledCalendarTasks(
			inputTasks,
			inputEvents,
			requiredTaskId,
		);
	};

	const addTask = async (task: ITask) => {
		const taskToAdd: ITask = {
			...task,
			dueDate: new Date(task.dueDate).toISOString(),
			estimatedHours: normalizeTaskDurationHours(task.estimatedHours),
		};
		const scheduled = rescheduleAllTasks(
			[...allTasks, taskToAdd],
			allEvents,
			taskToAdd.id,
		);
		const persistedTask = persistenceEnabled
			? await createPersistedTask(taskToAdd)
			: scheduled.find((item) => item.id === taskToAdd.id);
		if (!persistedTask) throw new Error("Task creation did not return a task.");
		const finalTasks = scheduled.map((item) =>
			item.id === taskToAdd.id ? persistedTask : item,
		);

		setAllTasks(finalTasks);
		setFilteredTasks(finalTasks);
	};

	const updateTask = async (task: ITask) => {
		const updatedTask: ITask = {
			...task,
			dueDate: new Date(task.dueDate).toISOString(),
			estimatedHours: normalizeTaskDurationHours(task.estimatedHours),
		};
		const nextTasks = allTasks.map((t) => (t.id === task.id ? updatedTask : t));
		const scheduled = rescheduleAllTasks(nextTasks, allEvents, task.id);
		const persistedTask = persistenceEnabled
			? await updatePersistedTask(updatedTask)
			: scheduled.find((item) => item.id === task.id);
		if (!persistedTask) throw new Error("Task update did not return a task.");
		const finalTasks = scheduled.map((item) =>
			item.id === task.id ? persistedTask : item,
		);

		setAllTasks(finalTasks);
		setFilteredTasks(finalTasks);
	};

	const removeTask = async (taskId: string) => {
		if (persistenceEnabled) await deletePersistedTask(taskId);
		setAllTasks((prev) => prev.filter((t) => t.id !== taskId));
		setFilteredTasks((prev) => prev.filter((t) => t.id !== taskId));
	};

	const clearFilter = () => {
		setFilteredEvents(allEvents);
		setSelectedColors([]);
		setSelectedUserId("all");
	};

	// Merge scheduled task chunks into the events list so the calendar UI can render
	// them without inventing fallback blocks after the task deadline.
	const mergedEvents = useMemo(() => {
		const taskAsEvents: IEvent[] = filteredTasks.flatMap((t) => {
			const blocks = coalesceTouchingBlocks(t.scheduledBlocks ?? []);

			return blocks.map((block, index) => ({
				id: `${t.id}:block:${index}`,
				taskId: t.id,
				startDate: block.startDate,
				endDate: block.endDate,
				title: t.title,
				color: t.color,
				description: t.description,
				user: t.user,
			}));
		});

		return [...filteredEvents, ...taskAsEvents];
	}, [filteredEvents, filteredTasks]);

	const value = {
		selectedDate,
		setSelectedDate: handleSelectDate,
		selectedUserId,
		setSelectedUserId,
		badgeVariant,
		setBadgeVariant,
		users,
		persistenceEnabled,
		selectedColors,
		filterEventsBySelectedColors,
		filterEventsBySelectedUser,
		events: mergedEvents,
		tasks: filteredTasks,
		addTask,
		updateTask,
		removeTask,
		view: currentView,
		use24HourFormat,
		toggleTimeFormat,
		setView,
		addEvent,
		updateEvent,
		removeEvent,
		clearFilter,
	};

	return (
		<CalendarContext.Provider value={value}>
			{children}
		</CalendarContext.Provider>
	);
}

export function useCalendar(): ICalendarContext {
	const context = useContext(CalendarContext);
	if (!context)
		throw new Error("useCalendar must be used within a CalendarProvider.");
	return context;
}
