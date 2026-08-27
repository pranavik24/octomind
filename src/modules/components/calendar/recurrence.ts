import {
	addDays,
	addMonths,
	addWeeks,
	addYears,
	differenceInCalendarDays,
	format,
	setDate,
	startOfMonth,
} from "date-fns";
import type { IEvent } from "./interfaces";

export type RecurrencePreset =
	| "none"
	| "daily"
	| "weekly"
	| "monthly"
	| "yearly"
	| "weekdays"
	| "custom";

export interface RecurrenceOption {
	value: RecurrencePreset;
	label: string;
}

const weekdayNames = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
] as const;

function ordinalForDate(date: Date) {
	const occurrence = Math.ceil(date.getDate() / 7);
	if (occurrence >= 5) return "last";
	return ["", "first", "second", "third", "fourth"][occurrence];
}

export function recurrenceOptionsForDate(date: Date): RecurrenceOption[] {
	const weekday = weekdayNames[date.getDay()];
	return [
		{ value: "none", label: "Does not repeat" },
		{ value: "daily", label: "Daily" },
		{ value: "weekly", label: `Weekly on ${weekday}` },
		{
			value: "monthly",
			label: `Monthly on the ${ordinalForDate(date)} ${weekday}`,
		},
		{ value: "yearly", label: `Annually on ${format(date, "MMMM d")}` },
		{
			value: "weekdays",
			label: "Every weekday (Monday to Friday)",
		},
		{ value: "custom", label: "Custom..." },
	];
}

export function defaultRecurrenceCount(
	freq: NonNullable<IEvent["recurrence"]>["freq"],
) {
	switch (freq) {
		case "daily":
			return 365;
		case "weekly":
			return 52;
		case "monthly":
			return 12;
		case "yearly":
			return 10;
	}
}

export function recurrenceForPreset(
	preset: RecurrencePreset,
	date: Date,
): IEvent["recurrence"] | undefined {
	switch (preset) {
		case "daily":
			return { freq: "daily", interval: 1, count: 365 };
		case "weekly":
			return {
				freq: "weekly",
				interval: 1,
				count: 52,
				byweekday: [date.getDay()],
			};
		case "monthly":
			return {
				freq: "monthly",
				interval: 1,
				count: 12,
				byweekday: [date.getDay()],
				bysetpos: Math.ceil(date.getDate() / 7),
			};
		case "yearly":
			return { freq: "yearly", interval: 1, count: 10 };
		case "weekdays":
			return {
				freq: "weekly",
				interval: 1,
				count: 260,
				byweekday: [1, 2, 3, 4, 5],
			};
		default:
			return undefined;
	}
}

function nthWeekdayOfMonth(month: Date, weekday: number, position: number) {
	const first = startOfMonth(month);
	const offset = (weekday - first.getDay() + 7) % 7;
	const candidate = setDate(first, 1 + offset + (position - 1) * 7);
	if (candidate.getMonth() !== first.getMonth()) {
		return addDays(candidate, -7);
	}
	return candidate;
}

export function expandRecurringEvent(
	event: IEvent,
	idFactory: (index: number) => string = () => crypto.randomUUID(),
): IEvent[] {
	const rule = event.recurrence;
	if (!rule) return [event];
	const baseStart = new Date(event.startDate);
	const baseEnd = new Date(event.endDate);
	const duration = baseEnd.getTime() - baseStart.getTime();
	const count = Math.min(rule.count ?? defaultRecurrenceCount(rule.freq), 730);
	const until = rule.until ? new Date(rule.until) : null;
	const starts: Date[] = [];

	if (rule.freq === "weekly" && rule.byweekday?.length) {
		let cursor = new Date(baseStart);
		while (starts.length < count) {
			if (until && cursor > until) break;
			const week = Math.floor(differenceInCalendarDays(cursor, baseStart) / 7);
			if (
				week % (rule.interval ?? 1) === 0 &&
				rule.byweekday.includes(cursor.getDay()) &&
				cursor >= baseStart
			) {
				starts.push(new Date(cursor));
			}
			cursor = addDays(cursor, 1);
		}
	} else if (
		rule.freq === "monthly" &&
		rule.byweekday?.length === 1 &&
		rule.bysetpos
	) {
		let monthIndex = 0;
		while (starts.length < count) {
			const month = addMonths(baseStart, monthIndex * (rule.interval ?? 1));
			const day = nthWeekdayOfMonth(month, rule.byweekday[0], rule.bysetpos);
			day.setHours(
				baseStart.getHours(),
				baseStart.getMinutes(),
				baseStart.getSeconds(),
				baseStart.getMilliseconds(),
			);
			if (until && day > until) break;
			if (day >= baseStart) starts.push(day);
			monthIndex += 1;
		}
	} else {
		for (let index = 0; index < count; index += 1) {
			const step = index * (rule.interval ?? 1);
			const start =
				rule.freq === "daily"
					? addDays(baseStart, step)
					: rule.freq === "weekly"
						? addWeeks(baseStart, step)
						: rule.freq === "monthly"
							? addMonths(baseStart, step)
							: addYears(baseStart, step);
			if (until && start > until) break;
			starts.push(start);
		}
	}

	return starts.map((start, index) => {
		return {
			id: index === 0 ? event.id : idFactory(index),
			startDate: start.toISOString(),
			endDate: new Date(start.getTime() + duration).toISOString(),
			title: event.title,
			location: event.location,
			color: event.color,
			description: event.description,
			user: event.user,
		};
	});
}
