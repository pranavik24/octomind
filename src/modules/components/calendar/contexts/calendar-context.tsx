"use client";

import type React from "react";
import { createContext, useContext, useState, useMemo } from "react";
import {
	addDays,
	addWeeks,
	addMonths,
	addYears,
	differenceInDays,
} from "date-fns";
import { useLocalStorage } from "@/modules/components/calendar/hooks";
import type {
	IEvent,
	IUser,
	ITask,
} from "@/modules/components/calendar/interfaces";
import {
	normalizeTaskDurationHours,
	scheduleTasksResult,
	TaskSchedulingError,
	type BusyInterval,
	type ScheduledBlock,
	type TaskSchedulingFailure,
} from "@/modules/components/calendar/scheduling";
import type {
	TCalendarView,
	TEventColor,
} from "@/modules/components/calendar/types";

interface ICalendarContext {
	selectedDate: Date;
	view: TCalendarView;
	setView: (view: TCalendarView) => void;
	agendaModeGroupBy: "date" | "color";
	setAgendaModeGroupBy: (groupBy: "date" | "color") => void;
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
	addEvent: (event: IEvent) => void;
	updateEvent: (event: IEvent) => void;
	removeEvent: (eventId: number) => void;
	clearFilter: () => void;
	addTask: (task: ITask) => void;
	updateTask: (task: ITask) => void;
	removeTask: (taskId: number) => void;

}

interface CalendarSettings {
	badgeVariant: "dot" | "colored";
	view: TCalendarView;
	use24HourFormat: boolean;
	agendaModeGroupBy: "date" | "color";
}

const DEFAULT_SETTINGS: CalendarSettings = {
	badgeVariant: "colored",
	view: "day",
	use24HourFormat: true,
	agendaModeGroupBy: "date",
};

const CalendarContext = createContext({} as ICalendarContext);

const buildBusyIntervals = (events: IEvent[]): BusyInterval[] =>
	events.map((event) => ({
		startDate: event.startDate,
		endDate: event.endDate,
	}));

const currentSchedulingStart = () => new Date();

const coalesceTouchingBlocks = (blocks: ScheduledBlock[]): ScheduledBlock[] => {
	const sortedBlocks = [...blocks].sort(
		(a, b) =>
			new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
	);
	const coalesced: ScheduledBlock[] = [];

	for (const block of sortedBlocks) {
		const previous = coalesced.at(-1);

		if (
			previous &&
			new Date(previous.endDate).getTime() >= new Date(block.startDate).getTime()
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
	const result = scheduleTasksResult({
		tasks,
		busyIntervals: buildBusyIntervals(events),
		earliestStart: currentSchedulingStart(),
	});

	if (result.status === "scheduled") return result.tasks;
	return applySchedulingFailure(tasks, result);
};

const requireScheduledCalendarTasks = (
	tasks: ITask[],
	events: IEvent[],
): ITask[] => {
	const result = scheduleTasksResult({
		tasks,
		busyIntervals: buildBusyIntervals(events),
		earliestStart: currentSchedulingStart(),
	});

	if (result.status === "scheduled") return result.tasks;
	throw new TaskSchedulingError(result);
};

export function CalendarProvider({
	children,
	users,
	events,
	tasks = [],
	badge = "colored",
	view = "day",
}: {
	children: React.ReactNode;
	users: IUser[];
	events: IEvent[];
	tasks?: ITask[];
	view?: TCalendarView;
	badge?: "dot" | "colored";
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
	const [currentView, setCurrentViewState] = useState<TCalendarView>(
		settings.view,
	);
	const [use24HourFormat, setUse24HourFormatState] = useState<boolean>(
		settings.use24HourFormat,
	);
	const [agendaModeGroupBy, setAgendaModeGroupByState] = useState<
		"date" | "color"
	>(settings.agendaModeGroupBy);

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
	const [filteredTasks, setFilteredTasks] =
		useState<ITask[]>(initialScheduledTasks);

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

	const setAgendaModeGroupBy = (groupBy: "date" | "color") => {
		setAgendaModeGroupByState(groupBy);
		updateSettings({ agendaModeGroupBy: groupBy });
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

	const addEvent = (event: IEvent) => {
		// If the event contains recurrence info, expand into multiple occurrences
		if (event.recurrence && (event.recurrence.count && event.recurrence.count > 1)) {
			const freq = event.recurrence.freq;
			const interval = event.recurrence.interval || 1;
			const count = event.recurrence.count || 1;
			const baseStart = new Date(event.startDate);
			const baseEnd = new Date(event.endDate);
			const occurrences: IEvent[] = [];

			// If weekly and byweekday provided, generate by scanning days forward and honoring interval
			if (event.recurrence && event.recurrence.freq === "weekly" && event.recurrence.byweekday && event.recurrence.byweekday.length > 0) {
				const weekdays = (event.recurrence.byweekday || []) as number[]; // 0..6
				let cursor = new Date(baseStart);
				let created = 0;
				while (created < count) {
					const weekIndex = Math.floor(differenceInDays(cursor, baseStart) / 7);
					const inIntervalWeek = weekIndex % interval === 0;
					if (inIntervalWeek && weekdays.includes(cursor.getDay()) && cursor >= baseStart) {
						const s = new Date(cursor);
						const duration = baseEnd.getTime() - baseStart.getTime();
						const e = new Date(s.getTime() + duration);
						occurrences.push({
							...event,
							id: Math.floor(Math.random() * 1000000000),
							startDate: s.toISOString(),
							endDate: e.toISOString(),
						});
						created += 1;
					}
					cursor = addDays(cursor, 1);
				}
			} else {
				for (let i = 0; i < count; i++) {
					let s = new Date(baseStart);
					let e = new Date(baseEnd);
					const step = i * interval;
					switch (freq) {
						case "daily":
							s = addDays(baseStart, step);
							e = addDays(baseEnd, step);
							break;
						case "weekly":
							s = addWeeks(baseStart, step);
							e = addWeeks(baseEnd, step);
							break;
						case "monthly":
							s = addMonths(baseStart, step);
							e = addMonths(baseEnd, step);
							break;
						case "yearly":
							s = addYears(baseStart, step);
							e = addYears(baseEnd, step);
							break;
						default:
							s = addDays(baseStart, step);
							e = addDays(baseEnd, step);
					}

					occurrences.push({
						...event,
						id: Math.floor(Math.random() * 1000000000),
						startDate: s.toISOString(),
						endDate: e.toISOString(),
					});
				}
			}

			const nextEvents = [...allEvents, ...occurrences];
			const scheduledTasks = rescheduleAllTasks(allTasks, nextEvents);

			setAllEvents(nextEvents);
			setFilteredEvents((prev) => [...prev, ...occurrences]);
			setAllTasks(scheduledTasks);
			setFilteredTasks(scheduledTasks);
			return;
		}

		// Non-recurring event
		const nextEvents = [...allEvents, event];
		const scheduledTasks = rescheduleAllTasks(allTasks, nextEvents);

		setAllEvents(nextEvents);
		setFilteredEvents((prev) => [...prev, event]);
		setAllTasks(scheduledTasks);
		setFilteredTasks(scheduledTasks);
	};

	const updateEvent = (event: IEvent) => {
		const updated = {
			...event,
			startDate: new Date(event.startDate).toISOString(),
			endDate: new Date(event.endDate).toISOString(),
		};

		const nextEvents = allEvents.map((e) => (e.id === event.id ? updated : e));
		const scheduledTasks = rescheduleAllTasks(allTasks, nextEvents);

		setAllEvents(nextEvents);
		setFilteredEvents((prev) => prev.map((e) => (e.id === event.id ? updated : e)));
		setAllTasks(scheduledTasks);
		setFilteredTasks(scheduledTasks);
	};

	const removeEvent = (eventId: number) => {
		const nextEvents = allEvents.filter((e) => e.id !== eventId);
		const scheduledTasks = rescheduleAllTasks(allTasks, nextEvents);

		setAllEvents(nextEvents);
		setFilteredEvents((prev) => prev.filter((e) => e.id !== eventId));
		setAllTasks(scheduledTasks);
		setFilteredTasks(scheduledTasks);
	};

	const rescheduleAllTasks = (
		inputTasks: ITask[],
		inputEvents = allEvents,
	): ITask[] => {
		return requireScheduledCalendarTasks(inputTasks, inputEvents);
	};

	const addTask = (task: ITask) => {
		const taskToAdd: ITask = {
			...task,
			dueDate: new Date(task.dueDate).toISOString(),
			estimatedHours: normalizeTaskDurationHours(task.estimatedHours),
		};
		const scheduled = rescheduleAllTasks([...allTasks, taskToAdd]);

		setAllTasks(scheduled);
		setFilteredTasks(scheduled);
	};

	const updateTask = (task: ITask) => {
		const updatedTask: ITask = {
			...task,
			dueDate: new Date(task.dueDate).toISOString(),
			estimatedHours: normalizeTaskDurationHours(task.estimatedHours),
		};
		const nextTasks = allTasks.map((t) => (t.id === task.id ? updatedTask : t));
		const scheduled = rescheduleAllTasks(nextTasks);

		setAllTasks(scheduled);
		setFilteredTasks(scheduled);
	};

	const removeTask = (taskId: number) => {
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
				id: t.id * 100 + index,
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
		agendaModeGroupBy,
		setAgendaModeGroupBy,
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
