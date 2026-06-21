export interface OnboardingScheduleInput {
	timezone: string;
	sleepTime: string;
	wakeTime: string;
	schoolDays: number[];
	schoolStartTime: string;
	schoolEndTime: string;
	startDate?: Date;
	days?: number;
}

export interface OnboardingEventSeed {
	title: "Sleep" | "School";
	description: string;
	location: string | null;
	color: "Other" | "School";
	startAt: Date;
	endAt: Date;
	localWeekday: number;
}

interface LocalDate {
	year: number;
	month: number;
	day: number;
}

function timeParts(value: string) {
	const [hour, minute] = value.split(":").map(Number);
	return { hour, minute, totalMinutes: hour * 60 + minute };
}

function localDateAt(date: Date, timezone: string): LocalDate {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: timezone,
		year: "numeric",
		month: "numeric",
		day: "numeric",
	}).formatToParts(date);
	const values = Object.fromEntries(
		parts.map((part) => [part.type, part.value]),
	);
	return {
		year: Number(values.year),
		month: Number(values.month),
		day: Number(values.day),
	};
}

function addLocalDays(date: LocalDate, days: number): LocalDate {
	const shifted = new Date(
		Date.UTC(date.year, date.month - 1, date.day + days),
	);
	return {
		year: shifted.getUTCFullYear(),
		month: shifted.getUTCMonth() + 1,
		day: shifted.getUTCDate(),
	};
}

function timezoneOffsetMs(date: Date, timezone: string) {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: timezone,
		year: "numeric",
		month: "numeric",
		day: "numeric",
		hour: "numeric",
		minute: "numeric",
		second: "numeric",
		hourCycle: "h23",
	}).formatToParts(date);
	const values = Object.fromEntries(
		parts.map((part) => [part.type, part.value]),
	);
	const representedAsUtc = Date.UTC(
		Number(values.year),
		Number(values.month) - 1,
		Number(values.day),
		Number(values.hour),
		Number(values.minute),
		Number(values.second),
	);
	return representedAsUtc - date.getTime();
}

function zonedDateTime(
	date: LocalDate,
	time: { hour: number; minute: number },
	timezone: string,
) {
	const localAsUtc = Date.UTC(
		date.year,
		date.month - 1,
		date.day,
		time.hour,
		time.minute,
	);
	let instant = localAsUtc;
	for (let iteration = 0; iteration < 3; iteration += 1) {
		instant = localAsUtc - timezoneOffsetMs(new Date(instant), timezone);
	}
	return new Date(instant);
}

export function buildOnboardingEvents(
	input: OnboardingScheduleInput,
): OnboardingEventSeed[] {
	const horizonDays = input.days ?? 365;
	const firstDate = localDateAt(input.startDate ?? new Date(), input.timezone);
	const sleep = timeParts(input.sleepTime);
	const wake = timeParts(input.wakeTime);
	const schoolStart = timeParts(input.schoolStartTime);
	const schoolEnd = timeParts(input.schoolEndTime);
	const schoolDays = new Set(input.schoolDays);
	const events: OnboardingEventSeed[] = [];

	for (let index = 0; index < horizonDays; index += 1) {
		const date = addLocalDays(firstDate, index);
		const localWeekday = new Date(
			Date.UTC(date.year, date.month - 1, date.day),
		).getUTCDay();
		const wakeDate =
			wake.totalMinutes <= sleep.totalMinutes ? addLocalDays(date, 1) : date;

		events.push({
			title: "Sleep",
			description: "Protected sleep time",
			location: null,
			color: "Other",
			startAt: zonedDateTime(date, sleep, input.timezone),
			endAt: zonedDateTime(wakeDate, wake, input.timezone),
			localWeekday,
		});

		if (schoolDays.has(localWeekday)) {
			events.push({
				title: "School",
				description: "Regular school hours",
				location: "School",
				color: "School",
				startAt: zonedDateTime(date, schoolStart, input.timezone),
				endAt: zonedDateTime(date, schoolEnd, input.timezone),
				localWeekday,
			});
		}
	}

	return events;
}
