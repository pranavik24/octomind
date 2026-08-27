import {
	addDays,
	addMonths,
	addWeeks,
	addYears,
	differenceInDays,
	differenceInMinutes,
	eachDayOfInterval,
	endOfMonth,
	endOfWeek,
	endOfYear,
	format,
	isSameDay,
	isSameMonth,
	isSameWeek,
	isSameYear,
	isValid,
	parseISO,
	startOfDay,
	startOfMonth,
	startOfWeek,
	startOfYear,
	subDays,
	subMonths,
	subWeeks,
	subYears,
	subHours,
} from "date-fns";
import { useCalendar } from "@/modules/components/calendar/contexts/calendar-context";
import type {
	ICalendarCell,
	IEvent,
} from "@/modules/components/calendar/interfaces";
import type {
	TCalendarView,
	TEventColor,
} from "@/modules/components/calendar/types";

const FORMAT_STRING = "MMM d, yyyy";

function roundToHalfHour(value: number): number {
	return Math.round(value * 2) / 2;
}

export function normalizeTaskDurationHours(hours?: number): number {
	if (typeof hours !== "number" || Number.isNaN(hours)) return 1;
	return Math.min(8, Math.max(0.5, roundToHalfHour(hours)));
}

export function estimateTaskDurationHours(
	title: string,
	description: string,
): number {
	const normalizedTitle = title.toLowerCase();
	const normalizedDescription = description.toLowerCase();
	const combined = `${normalizedTitle} ${normalizedDescription}`;
	const words = combined
		.split(/\s+/)
		.map((word) => word.trim())
		.filter(Boolean);
	const titleWords = normalizedTitle
		.split(/\s+/)
		.map((word) => word.trim())
		.filter(Boolean);
	const descriptionWords = normalizedDescription
		.split(/\s+/)
		.map((word) => word.trim())
		.filter(Boolean);

	// If the user wrote an explicit estimate in the text, prefer it.
	const explicitHours = combined.match(/(\d+(?:\.\d+)?)\s*(h|hr|hrs|hour|hours)\b/);
	if (explicitHours) {
		return normalizeTaskDurationHours(Number(explicitHours[1]));
	}

	const explicitMinutes = combined.match(/(\d+)\s*(m|min|mins|minute|minutes)\b/);
	if (explicitMinutes) {
		return normalizeTaskDurationHours(Number(explicitMinutes[1]) / 60);
	}

	let score = 1;

	// Base complexity from amount of detail.
	if (titleWords.length >= 4) score += 0.25;
	if (descriptionWords.length >= 10) score += 0.25;
	if (descriptionWords.length >= 24) score += 0.5;
	if (words.length >= 40) score += 0.25;
	if ((combined.match(/[,;]| and | then | after /g) || []).length >= 3) score += 0.25;

	// Small, quick actions.
	if (
		/\b(call|email|reply|review|read|check|follow up|ping|confirm|schedule)\b/.test(
			combined,
		)
	) {
		score -= 0.5;
	}

	// Very short/simple entries should bias lower.
	if (titleWords.length <= 2 && descriptionWords.length === 0) {
		score -= 0.25;
	}

	// Medium-complexity execution work.
		if (
			/\b(write|draft|plan|prepare|research|analyze|document|presentation)\b/.test(
				combined,
			)
		) {
			score += 0.75;
		}

	// Usually bigger delivery work.
		if (
			/\b(build|implement|develop|feature|integration|migrate|refactor|architecture|prototype|debug)\b/.test(
				combined,
			)
		) {
			score += 1.5;
		}

	// Extra complexity signals.
	if (/\bmultiple|complex|deep|detailed|end-to-end|full\b/.test(combined)) {
		score += 1;
	}

	// High-school coursework and deadlines.
	if (
		/\b(homework|assignment|worksheet|problem set|study guide|lab|lab report|essay|paper|project|presentation|slides|outline|annotate|annotation|reading log|chapter questions|dbq|frq|saq|mcq|poster|model|vocab|flashcards|notes|notecards|bibliography|citation|source analysis)\b/.test(
			combined,
		)
	) {
		score += 0.5;
	}

		if (
			/\b(quiz|test|exam|midterm|final|ap exam|sat|act|study|revision|review notes|practice test|retake|unit test|chapter test|benchmark|state test|regents|psat|practice questions|review packet|memorize)\b/.test(
				combined,
			)
		) {
			score += 1;
		}

	// Applications and longer-form writing are usually larger chunks.
		if (
			/\b(college application|common app|personal statement|scholarship|essay draft|portfolio|supplemental essay|activities list|resume|brag sheet|recommendation letter|letter of recommendation|fafsa)\b/.test(
				combined,
			)
		) {
			score += 1.5;
		}

	// Typical quick school admin tasks.
	if (
		/\b(check gradebook|submit form|permission slip|email teacher|turn in|print|attendance office|late pass|hall pass|sign form|parent signature|bring form|upload screenshot|google classroom post|canvas post)\b/.test(
			combined,
		)
	) {
		score -= 0.5;
	}

	// Group coordination adds overhead.
	if (/\b(group project|team project|with classmates|club meeting|student council|group chat|assign roles|peer review|partner work|meeting with team)\b/.test(combined)) {
		score += 0.75;
	}

	// Extracurricular practices/games tend to be fixed-time blocks.
		if (
			/\b(practice|rehearsal|tryout|game|match|tournament|meet|training|film study|weight room|conditioning|scrimmage|warm up|band practice|orchestra practice|choir rehearsal|drama rehearsal|debate prep|mock trial|robotics build|yearbook meeting)\b/.test(
				combined,
			)
		) {
			score += 0.75;
		}

	// School support/planning tasks.
	if (
		/\b(tutoring|office hours|study hall|advisory|counselor meeting|college counselor|teacher meeting|make up work|missing work)\b/.test(
			combined,
		)
	) {
		score += 0.75;
	}

	// Creative/tech assignments often need focused blocks.
		if (
			/\b(video edit|edit video|recording|podcast|coding project|science fair|lab setup|build prototype|art piece|music composition)\b/.test(
				combined,
			)
		) {
			score += 1;
		}

	return normalizeTaskDurationHours(score);
}

export function rangeText(view: TCalendarView, date: Date): string {
	let start: Date;
	let end: Date;

	switch (view) {
		case "month":
			start = startOfMonth(date);
			end = endOfMonth(date);
			break;
		case "week":
			start = startOfWeek(date);
			end = endOfWeek(date);
			break;
		case "day":
			return format(date, FORMAT_STRING);
		case "year":
			start = startOfYear(date);
			end = endOfYear(date);
			break;
		default:
			return "Error while formatting";
	}

	return `${format(start, FORMAT_STRING)} - ${format(end, FORMAT_STRING)}`;
}

export function navigateDate(
	date: Date,
	view: TCalendarView,
	direction: "previous" | "next",
): Date {
	const operations: Record<TCalendarView, (d: Date, n: number) => Date> = {
		month: direction === "next" ? addMonths : subMonths,
		week: direction === "next" ? addWeeks : subWeeks,
		day: direction === "next" ? addDays : subDays,
		year: direction === "next" ? addYears : subYears,
	};

	return operations[view](date, 1);
}

export function getEventsCount(
	events: IEvent[],
	date: Date,
	view: TCalendarView,
): number {
	const compareFns: Record<TCalendarView, (d1: Date, d2: Date) => boolean> = {
		day: isSameDay,
		week: isSameWeek,
		month: isSameMonth,
		year: isSameYear,
	};

	const compareFn = compareFns[view];
	return events.filter((event) => compareFn(parseISO(event.startDate), date))
		.length;
}

export function groupEvents(dayEvents: IEvent[]): IEvent[][] {
	const sortedEvents = dayEvents.sort(
		(a, b) => parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime(),
	);
	const groups: IEvent[][] = [];

	for (const event of sortedEvents) {
		const eventStart = parseISO(event.startDate);
		let placed = false;

		for (const group of groups) {
			const lastEventInGroup = group[group.length - 1];
			const lastEventEnd = parseISO(lastEventInGroup.endDate);

			if (eventStart >= lastEventEnd) {
				group.push(event);
				placed = true;
				break;
			}
		}

		if (!placed) groups.push([event]);
	}

	return groups;
}

export function getEventBlockStyle(
	event: IEvent,
	day: Date,
	groupIndex: number,
	groupSize: number,
) {
	const startDate = parseISO(event.startDate);
	const dayStart = startOfDay(day); // Use startOfDay instead of manual reset
	const eventStart = startDate < dayStart ? dayStart : startDate;
	const startMinutes = differenceInMinutes(eventStart, dayStart);

	const top = (startMinutes / 1440) * 100; // 1440 minutes in a day
	const width = 100 / groupSize;
	const left = groupIndex * width;

	return { top: `${top}%`, width: `${width}%`, left: `${left}%` };
}

export function getCalendarCells(selectedDate: Date): ICalendarCell[] {
	const year = selectedDate.getFullYear();
	const month = selectedDate.getMonth();

	const daysInMonth = endOfMonth(selectedDate).getDate(); // Faster than new Date(year, month + 1, 0)
	const firstDayOfMonth = startOfMonth(selectedDate).getDay();
	const daysInPrevMonth = endOfMonth(new Date(year, month - 1)).getDate();
	const totalDays = firstDayOfMonth + daysInMonth;

	const prevMonthCells = Array.from({ length: firstDayOfMonth }, (_, i) => ({
		day: daysInPrevMonth - firstDayOfMonth + i + 1,
		currentMonth: false,
		date: new Date(year, month - 1, daysInPrevMonth - firstDayOfMonth + i + 1),
	}));

	const currentMonthCells = Array.from({ length: daysInMonth }, (_, i) => ({
		day: i + 1,
		currentMonth: true,
		date: new Date(year, month, i + 1),
	}));

	const nextMonthCells = Array.from(
		{ length: (7 - (totalDays % 7)) % 7 },
		(_, i) => ({
			day: i + 1,
			currentMonth: false,
			date: new Date(year, month + 1, i + 1),
		}),
	);

	return [...prevMonthCells, ...currentMonthCells, ...nextMonthCells];
}

export function calculateMonthEventPositions(
	multiDayEvents: IEvent[],
	singleDayEvents: IEvent[],
	selectedDate: Date,
): Record<string, number> {
	const monthStart = startOfMonth(selectedDate);
	const monthEnd = endOfMonth(selectedDate);

	const eventPositions: Record<string, number> = {};
	const occupiedPositions: Record<string, boolean[]> = {};

	eachDayOfInterval({ start: monthStart, end: monthEnd }).forEach((day) => {
		occupiedPositions[day.toISOString()] = [false, false, false];
	});

	const sortedEvents = [
		...multiDayEvents.sort((a, b) => {
			const aDuration = differenceInDays(
				parseISO(a.endDate),
				parseISO(a.startDate),
			);
			const bDuration = differenceInDays(
				parseISO(b.endDate),
				parseISO(b.startDate),
			);
			return (
				bDuration - aDuration ||
				parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime()
			);
		}),
		...singleDayEvents.sort(
			(a, b) =>
				parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime(),
		),
	];

	sortedEvents.forEach((event) => {
		const eventStart = parseISO(event.startDate);
		const eventEnd = parseISO(event.endDate);
		const eventDays = eachDayOfInterval({
			start: eventStart < monthStart ? monthStart : eventStart,
			end: eventEnd > monthEnd ? monthEnd : eventEnd,
		});

		let position = -1;

		for (let i = 0; i < 3; i++) {
			if (
				eventDays.every((day) => {
					const dayPositions = occupiedPositions[startOfDay(day).toISOString()];
					return dayPositions && !dayPositions[i];
				})
			) {
				position = i;
				break;
			}
		}

		if (position !== -1) {
			eventDays.forEach((day) => {
				const dayKey = startOfDay(day).toISOString();
				occupiedPositions[dayKey][position] = true;
			});
			eventPositions[event.id] = position;
		}
	});

	return eventPositions;
}

export function getMonthCellEvents(
	date: Date,
	events: IEvent[],
	eventPositions: Record<string, number>,
) {
	const dayStart = startOfDay(date);
	const eventsForDate = events.filter((event) => {
		const eventStart = parseISO(event.startDate);
		const eventEnd = parseISO(event.endDate);

		// Avoid duplicate rendering of overnight short events (e.g., 10 PM to 6 AM)
		// in month cells by showing them only on their start date.
		const isOvernightShort =
			!isSameDay(eventStart, eventEnd) &&
			differenceInMinutes(eventEnd, eventStart) <= 12 * 60;
		if (isOvernightShort) {
			return isSameDay(dayStart, eventStart);
		}

		return (
			(dayStart >= eventStart && dayStart <= eventEnd) ||
			isSameDay(dayStart, eventStart) ||
			isSameDay(dayStart, eventEnd)
		);
	});

	return eventsForDate
		.map((event) => ({
			...event,
			position: eventPositions[event.id] ?? -1,
			isMultiDay: event.startDate !== event.endDate,
		}))
		.sort((a, b) => {
			if (a.isMultiDay && !b.isMultiDay) return -1;
			if (!a.isMultiDay && b.isMultiDay) return 1;
			return a.position - b.position;
		});
}

export function formatTime(
	date: Date | string,
	use24HourFormat: boolean,
): string {
	const parsedDate = typeof date === "string" ? parseISO(date) : date;
	if (!isValid(parsedDate)) return "";
	return format(parsedDate, use24HourFormat ? "HH:mm" : "h:mm a");
}

export const getFirstLetters = (str: string): string => {
	if (!str) return "";
	const words = str.split(" ");
	if (words.length === 1) return words[0].charAt(0).toUpperCase();
	return `${words[0].charAt(0).toUpperCase()}${words[1].charAt(0).toUpperCase()}`;
};

export const getEventsForDay = (
	events: IEvent[],
	date: Date,
	isWeek = false,
): IEvent[] => {
	const targetDate = startOfDay(date);
	return events
		.filter((event) => {
			const startOfDayForEventStart = startOfDay(parseISO(event.startDate));
			const startOfDayForEventEnd = startOfDay(parseISO(event.endDate));
			if (isWeek) {
				return (
					event.startDate !== event.endDate &&
					startOfDayForEventStart <= targetDate &&
					startOfDayForEventEnd >= targetDate
				);
			}
			return (
				startOfDayForEventStart <= targetDate &&
				startOfDayForEventEnd >= targetDate
			);
		})
		.map((event) => {
			const eventStart = startOfDay(parseISO(event.startDate));
			const eventEnd = startOfDay(parseISO(event.endDate));
			let point: "start" | "end" | "none" | undefined;

			if (isSameDay(eventStart, eventEnd)) {
				point = "none";
			} else if (isSameDay(eventStart, targetDate)) {
				point = "start";
			} else if (isSameDay(eventEnd, targetDate)) {
				point = "end";
			}

			return { ...event, point };
		});
};

export const getWeekDates = (date: Date): Date[] => {
	const startDate = startOfWeek(date, { weekStartsOn: 1 });
	return Array.from({ length: 7 }, (_, i) => addDays(startDate, i));
};

export const getEventsForWeek = (events: IEvent[], date: Date): IEvent[] => {
	const weekDates = getWeekDates(date);
	const startOfWeekDate = weekDates[0];
	const endOfWeekDate = weekDates[6];

	return events.filter((event) => {
		const eventStart = parseISO(event.startDate);
		const eventEnd = parseISO(event.endDate);
		return (
			isValid(eventStart) &&
			isValid(eventEnd) &&
			eventStart <= endOfWeekDate &&
			eventEnd >= startOfWeekDate
		);
	});
};

export const getEventsForMonth = (events: IEvent[], date: Date): IEvent[] => {
	const startOfMonthDate = startOfMonth(date);
	const endOfMonthDate = endOfMonth(date);

	return events.filter((event) => {
		const eventStart = parseISO(event.startDate);
		const eventEnd = parseISO(event.endDate);
		return (
			isValid(eventStart) &&
			isValid(eventEnd) &&
			eventStart <= endOfMonthDate &&
			eventEnd >= startOfMonthDate
		);
	});
};

export const getEventsForYear = (events: IEvent[], date: Date): IEvent[] => {
	if (!events || !Array.isArray(events) || !isValid(date)) return [];

	const startOfYearDate = startOfYear(date);
	const endOfYearDate = endOfYear(date);

	return events.filter((event) => {
		const eventStart = parseISO(event.startDate);
		const eventEnd = parseISO(event.endDate);
		return (
			isValid(eventStart) &&
			isValid(eventEnd) &&
			eventStart <= endOfYearDate &&
			eventEnd >= startOfYearDate
		);
	});
};

export const getColorClass = (color: string): string => {
	const colorClasses: Record<TEventColor, string> = {
		School: "reef-chip reef-school",
		Homework: "reef-chip reef-homework",
		Studying: "reef-chip reef-studying",
		Extracurriculars: "reef-chip reef-extracurriculars",
		Work: "reef-chip reef-work",
		Other: "reef-chip reef-other",
	};
	return colorClasses[color as TEventColor] || "";
};

export const getBgColor = (color: string): string => {
	const colorClasses: Record<TEventColor, string> = {
		School: "reef-avatar reef-school",
		Homework: "reef-avatar reef-homework",
		Studying: "reef-avatar reef-studying",
		Extracurriculars: "reef-avatar reef-extracurriculars",
		Work: "reef-avatar reef-work",
		Other: "reef-avatar reef-other",
	};
	return colorClasses[color as TEventColor] || "";
};

export const useGetEventsByMode = (events: IEvent[]) => {
	const { view, selectedDate } = useCalendar();

	switch (view) {
		case "day":
			return getEventsForDay(events, selectedDate);
		case "week":
			return getEventsForWeek(events, selectedDate);
		case "month":
			return getEventsForMonth(events, selectedDate);
		case "year":
			return getEventsForYear(events, selectedDate);
		default:
			return [];
	}
};

export const toCapitalize = (str: string): string => {
	if (!str) return "";
	return str.charAt(0).toUpperCase() + str.slice(1);
};

/**
 * Subtracts the given number of hours from a date and returns a new Date.
 * Centralized here so other modules import from the calendar helpers.
 */
export const subtractHours = (date: Date | string, hours: number): Date => {
 	const d = typeof date === "string" ? parseISO(date) : date;
 	return subHours(d, hours);
};
