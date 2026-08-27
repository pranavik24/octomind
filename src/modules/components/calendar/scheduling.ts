export interface ScheduledBlock {
	startDate: string;
	endDate: string;
}

export type TaskSchedulingFailureReason =
	| "INVALID_DUE_DATE"
	| "INVALID_BUSY_INTERVAL"
	| "INSUFFICIENT_CAPACITY"
	| "SCHEDULING_BLOCKED";

export type TaskScheduleStatus =
	| { state: "scheduled" }
	| {
			state: "failed";
			reason: TaskSchedulingFailureReason;
			message: string;
	  };

export interface SchedulingTask {
	id: string;
	dueDate: string;
	estimatedHours?: number;
	scheduledBlocks?: ScheduledBlock[];
	scheduleStatus?: TaskScheduleStatus;
}

export interface BusyInterval {
	startDate: string;
	endDate: string;
}

export interface CalendarEventInterval {
	startDate: string | Date;
	endDate: string | Date;
	color?: string;
}

/**
 * School is a protected scheduling interval, but students can still record
 * an event that takes place inside it (for example, a class or a school club).
 * This helper keeps that exception scoped to events fully contained by an
 * existing School event; events that spill into free time still participate in
 * normal scheduling conflict checks.
 */
export function eventFitsWithinSchoolHours(
	event: CalendarEventInterval,
	existingEvents: readonly CalendarEventInterval[],
): boolean {
	const eventStart = parseValidDate(event.startDate);
	const eventEnd = parseValidDate(event.endDate);
	if (!eventStart || !eventEnd || eventStart >= eventEnd) return false;

	return existingEvents.some((existingEvent) => {
		if (existingEvent.color !== "School") return false;
		const schoolStart = parseValidDate(existingEvent.startDate);
		const schoolEnd = parseValidDate(existingEvent.endDate);
		return (
			!!schoolStart &&
			!!schoolEnd &&
			schoolStart < schoolEnd &&
			eventStart >= schoolStart &&
			eventEnd <= schoolEnd
		);
	});
}

export interface ScheduleTasksOptions<TTask extends SchedulingTask> {
	tasks: TTask[];
	busy?: BusyInterval[];
	busyIntervals?: BusyInterval[];
	earliestStart?: string | Date;
	timezone?: string;
	scheduleWindowDays?: number;
	slotMinutes?: number;
	dayStartHour?: number;
	dayEndHour?: number;
	maxChunkMinutes?: number;
}

/**
 * Returns whether a task still has time available from the supplied scheduling
 * start. Invalid dates are not schedulable either, so a malformed existing
 * task cannot prevent valid work from being planned.
 */
export function isTaskSchedulable(
	task: SchedulingTask,
	earliestStart: string | Date,
): boolean {
	const dueDate = parseValidDate(task.dueDate);
	const startDate = parseValidDate(earliestStart);
	return dueDate !== null && startDate !== null && dueDate > startDate;
}

interface Interval {
	start: Date;
	end: Date;
}

export type ScheduledTask<TTask extends SchedulingTask> = TTask & {
	dueDate: string;
	estimatedHours: number;
	scheduledBlocks: ScheduledBlock[];
	scheduleStatus: { state: "scheduled" };
};

export type TaskSchedulingSuccess<TTask extends SchedulingTask> = {
	status: "scheduled";
	tasks: ScheduledTask<TTask>[];
};

export type TaskSchedulingFailure<TTask extends SchedulingTask> = {
	status: "failed";
	reason: TaskSchedulingFailureReason;
	message: string;
	taskId?: string;
	scheduledTasks: ScheduledTask<TTask>[];
};

export type TaskSchedulingResult<TTask extends SchedulingTask> =
	| TaskSchedulingSuccess<TTask>
	| TaskSchedulingFailure<TTask>;

export class TaskSchedulingError extends Error {
	reason: TaskSchedulingFailureReason;
	taskId?: string;

	constructor(
		failure: Pick<
			TaskSchedulingFailure<SchedulingTask>,
			"message" | "reason" | "taskId"
		>,
	) {
		super(failure.message);
		this.name = "TaskSchedulingError";
		this.reason = failure.reason;
		this.taskId = failure.taskId;
	}
}

const DEFAULT_SLOT_MINUTES = 30;
const DEFAULT_SCHEDULING_HORIZON_DAYS = 14;
const DEFAULT_DAY_START_HOUR = 6;
const DEFAULT_DAY_END_HOUR = 23;
const DEFAULT_MAX_CHUNK_MINUTES = 60;
const QUICK_WIN_MAX_MINUTES = 45;
const SPREAD_OUT_MIN_MINUTES = 120;
const SPREAD_OUT_MIN_DAYS = 3;
const LARGE_TASK_BUFFER_DAYS = 1;
const STEADY_TASK_BUFFER_HOURS = 6;
const DEFAULT_TIMEZONE =
	Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export function normalizeTaskDurationHours(hours?: number): number {
	if (typeof hours !== "number" || Number.isNaN(hours)) return 1;
	const rounded = Math.round(hours * 2) / 2;
	return Math.min(8, Math.max(0.5, rounded));
}

function toDate(value: string | Date): Date {
	const date = value instanceof Date ? new Date(value) : new Date(value);
	if (Number.isNaN(date.getTime())) {
		throw new Error(`Invalid date: ${String(value)}`);
	}
	return date;
}

interface ZonedDateParts {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	second: number;
	millisecond: number;
}

function zonedDateParts(date: Date, timezone: string): ZonedDateParts {
	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
		hourCycle: "h23",
	}).formatToParts(date);
	const values = new Map(
		parts
			.filter((part) => part.type !== "literal")
			.map((part) => [part.type, Number(part.value)]),
	);

	return {
		year: values.get("year") ?? date.getUTCFullYear(),
		month: values.get("month") ?? date.getUTCMonth() + 1,
		day: values.get("day") ?? date.getUTCDate(),
		hour: values.get("hour") ?? date.getUTCHours(),
		minute: values.get("minute") ?? date.getUTCMinutes(),
		second: values.get("second") ?? date.getUTCSeconds(),
		millisecond: date.getUTCMilliseconds(),
	};
}

function timezoneOffsetMs(date: Date, timezone: string): number {
	const parts = zonedDateParts(date, timezone);
	return (
		Date.UTC(
			parts.year,
			parts.month - 1,
			parts.day,
			parts.hour,
			parts.minute,
			parts.second,
			parts.millisecond,
		) - date.getTime()
	);
}

function zonedDateTime(parts: ZonedDateParts, timezone: string): Date {
	const localAsUtc = Date.UTC(
		parts.year,
		parts.month - 1,
		parts.day,
		parts.hour,
		parts.minute,
		parts.second,
		parts.millisecond,
	);
	let candidate = new Date(localAsUtc);

	for (let attempt = 0; attempt < 3; attempt += 1) {
		const next = new Date(localAsUtc - timezoneOffsetMs(candidate, timezone));
		if (next.getTime() === candidate.getTime()) return next;
		candidate = next;
	}

	return candidate;
}

function startOfLocalDay(date: Date, timezone: string): Date {
	const parts = zonedDateParts(date, timezone);
	return zonedDateTime(
		{ ...parts, hour: 0, minute: 0, second: 0, millisecond: 0 },
		timezone,
	);
}

function addDays(date: Date, days: number, timezone: string): Date {
	const parts = zonedDateParts(date, timezone);
	const shifted = new Date(
		Date.UTC(
			parts.year,
			parts.month - 1,
			parts.day + days,
			parts.hour,
			parts.minute,
			parts.second,
			parts.millisecond,
		),
	);

	return zonedDateTime(
		{
			year: shifted.getUTCFullYear(),
			month: shifted.getUTCMonth() + 1,
			day: shifted.getUTCDate(),
			hour: shifted.getUTCHours(),
			minute: shifted.getUTCMinutes(),
			second: shifted.getUTCSeconds(),
			millisecond: shifted.getUTCMilliseconds(),
		},
		timezone,
	);
}

function maxDate(a: Date, b: Date): Date {
	return a > b ? a : b;
}

function intervalsOverlap(a: Interval, b: Interval): boolean {
	return a.start < b.end && b.start < a.end;
}

function isIntervalFree(interval: Interval, busy: Interval[]): boolean {
	return !busy.some((busyInterval) => intervalsOverlap(interval, busyInterval));
}

function roundUpToSlot(date: Date, slotMinutes: number, timezone: string): Date {
	const parts = zonedDateParts(date, timezone);
	const millisecondsInDay =
		((parts.hour * 60 + parts.minute) * 60 + parts.second) * 1000 +
			parts.millisecond;
	const slotMs = slotMinutes * 60 * 1000;
	const roundedMinutes = Math.ceil(millisecondsInDay / slotMs) * slotMinutes;

	if (roundedMinutes >= 24 * 60) {
		return startOfLocalDay(addDays(date, 1, timezone), timezone);
	}

	return zonedDateTime(
		{
			...parts,
			hour: Math.floor(roundedMinutes / 60),
			minute: roundedMinutes % 60,
			second: 0,
			millisecond: 0,
		},
		timezone,
	);
}

function hoursBefore(date: Date, hours: number): Date {
	return new Date(date.getTime() - hours * 60 * 60 * 1000);
}

function isInsideWorkWindow(
	interval: Interval,
	dayStartHour: number,
	dayEndHour: number,
	timezone: string,
): boolean {
	const start = zonedDateParts(interval.start, timezone);
	const end = zonedDateParts(interval.end, timezone);
	if (start.year !== end.year || start.month !== end.month || start.day !== end.day) {
		return false;
	}

	const startMinutes = start.hour * 60 + start.minute;
	const endMinutes = end.hour * 60 + end.minute;

	return startMinutes >= dayStartHour * 60 && endMinutes <= dayEndHour * 60;
}

function splitIntoChunks(
	totalMinutes: number,
	maxChunkMinutes: number,
	slotMinutes: number,
): number[] {
	const chunks: number[] = [];
	let remaining = Math.ceil(totalMinutes / slotMinutes) * slotMinutes;

	while (remaining > 0) {
		const chunk = Math.min(maxChunkMinutes, remaining);
		chunks.push(chunk);
		remaining -= chunk;
	}

	return chunks;
}

function normalizeBusyIntervals(intervals: BusyInterval[]): Interval[] {
	return intervals.map((interval) => {
		const start = toDate(interval.startDate);
		const end = toDate(interval.endDate);

		if (start >= end) {
			throw new Error("A busy interval has an invalid start or end date.");
		}

		return { start, end };
	});
}

function getCandidateIntervalsBeforeDeadline({
	deadline,
	durationMinutes,
	busy,
	earliestStart,
	scheduleWindowDays,
	slotMinutes,
	dayStartHour,
	dayEndHour,
	timezone,
}: {
	deadline: Date;
	durationMinutes: number;
	busy: Interval[];
	earliestStart?: Date;
	scheduleWindowDays: number;
	slotMinutes: number;
	dayStartHour: number;
	dayEndHour: number;
	timezone: string;
}): Interval[] {
	const durationMs = durationMinutes * 60 * 1000;
	const windowStart = startOfLocalDay(
		addDays(deadline, -scheduleWindowDays, timezone),
		timezone,
	);
	const searchStart = roundUpToSlot(
		earliestStart ? maxDate(windowStart, earliestStart) : windowStart,
		slotMinutes,
		timezone,
	);
	const latestStart = new Date(deadline.getTime() - durationMs);
	const stepMs = slotMinutes * 60 * 1000;
	const candidates: Interval[] = [];

	for (
		let cursor = new Date(searchStart);
		cursor <= latestStart;
		cursor = new Date(cursor.getTime() + stepMs)
	) {
		const interval = {
			start: new Date(cursor),
			end: new Date(cursor.getTime() + durationMs),
		};

		if (
			isInsideWorkWindow(interval, dayStartHour, dayEndHour, timezone) &&
			isIntervalFree(interval, busy)
		) {
			candidates.push(interval);
		}
	}

	return candidates;
}

function daysBetween(start: Date, end: Date, timezone: string): number {
	const startParts = zonedDateParts(start, timezone);
	const endParts = zonedDateParts(end, timezone);
	const startDay = Date.UTC(startParts.year, startParts.month - 1, startParts.day);
	const endDay = Date.UTC(endParts.year, endParts.month - 1, endParts.day);
	return (endDay - startDay) / (24 * 60 * 60 * 1000);
}

function taskSchedulingStrategy(
	totalMinutes: number,
	searchStart: Date,
	deadline: Date,
	timezone: string,
): "quick-win" | "spread-out" | "steady-progress" {
	const daysUntilDue = daysBetween(searchStart, deadline, timezone);

	if (totalMinutes <= QUICK_WIN_MAX_MINUTES) return "quick-win";
	if (
		totalMinutes > SPREAD_OUT_MIN_MINUTES &&
		daysUntilDue >= SPREAD_OUT_MIN_DAYS
	) {
		return "spread-out";
	}

	return "steady-progress";
}

function targetForChunk({
	chunkIndex,
	deadline,
	searchStart,
	strategy,
	totalChunks,
	timezone,
}: {
	chunkIndex: number;
	deadline: Date;
	searchStart: Date;
	strategy: ReturnType<typeof taskSchedulingStrategy>;
	totalChunks: number;
	timezone: string;
}): Date {
	if (strategy === "quick-win") return searchStart;

	if (strategy === "spread-out") {
		const preferredFinish = maxDate(
			searchStart,
			addDays(deadline, -LARGE_TASK_BUFFER_DAYS, timezone),
		);
		if (totalChunks <= 1) return preferredFinish;
		const progress = chunkIndex / (totalChunks - 1);
		return new Date(
			searchStart.getTime() +
				(preferredFinish.getTime() - searchStart.getTime()) * progress,
		);
	}

	return maxDate(searchStart, hoursBefore(deadline, STEADY_TASK_BUFFER_HOURS));
}

function chooseBestInterval(
	candidates: Interval[],
	target: Date,
	strategy: ReturnType<typeof taskSchedulingStrategy>,
): Interval | null {
	if (candidates.length === 0) return null;
	if (strategy === "quick-win") return candidates[0];

	return candidates.reduce((best, candidate) => {
		const bestDistance = Math.abs(best.start.getTime() - target.getTime());
		const candidateDistance = Math.abs(
			candidate.start.getTime() - target.getTime(),
		);

		if (candidateDistance < bestDistance) return candidate;
		if (candidateDistance > bestDistance) return best;

		return candidate.start < best.start ? candidate : best;
	});
}

function scheduleOneTask<TTask extends SchedulingTask>(
	task: TTask,
	busy: Interval[],
	options: Required<
		Pick<
			ScheduleTasksOptions<TTask>,
			| "scheduleWindowDays"
			| "slotMinutes"
			| "dayStartHour"
			| "dayEndHour"
			| "maxChunkMinutes"
		>
		> & { earliestStart?: Date; timezone: string },
): ScheduledTask<TTask> {
	const deadline = toDate(task.dueDate);
	const estimatedHours = normalizeTaskDurationHours(task.estimatedHours);
	const totalMinutes = estimatedHours * 60;
	const chunks = splitIntoChunks(
		totalMinutes,
		options.maxChunkMinutes,
		options.slotMinutes,
	);
	const scheduledBlocks: ScheduledBlock[] = [];
	const searchStart = roundUpToSlot(
		options.earliestStart
			? maxDate(
					startOfLocalDay(
						addDays(deadline, -options.scheduleWindowDays, options.timezone),
						options.timezone,
					),
					options.earliestStart,
				)
			: startOfLocalDay(
					addDays(deadline, -options.scheduleWindowDays, options.timezone),
					options.timezone,
				),
		options.slotMinutes,
		options.timezone,
	);
	const strategy = taskSchedulingStrategy(
		totalMinutes,
		searchStart,
		deadline,
		options.timezone,
	);

	for (const [chunkIndex, durationMinutes] of chunks.entries()) {
		const candidates = getCandidateIntervalsBeforeDeadline({
			deadline,
			durationMinutes,
			busy,
			earliestStart: options.earliestStart,
			scheduleWindowDays: options.scheduleWindowDays,
			slotMinutes: options.slotMinutes,
			dayStartHour: options.dayStartHour,
			dayEndHour: options.dayEndHour,
			timezone: options.timezone,
		});
		const interval = chooseBestInterval(
			candidates,
			targetForChunk({
				chunkIndex,
				deadline,
				searchStart,
				strategy,
				totalChunks: chunks.length,
				timezone: options.timezone,
			}),
			strategy,
		);

		if (!interval) {
			throw new Error(
				`Unable to schedule task ${task.id} before its due date with available free time.`,
			);
		}

		busy.push(interval);
		scheduledBlocks.push({
			startDate: interval.start.toISOString(),
			endDate: interval.end.toISOString(),
		});
	}

	return {
		...task,
		dueDate: deadline.toISOString(),
		estimatedHours,
		scheduledBlocks: scheduledBlocks.sort(
			(a, b) =>
				new Date(a.startDate).getTime() - new Date(b.startDate).getTime(),
		),
		scheduleStatus: { state: "scheduled" },
	};
}

export function scheduleTasks<TTask extends SchedulingTask>({
	tasks,
	busy,
	busyIntervals,
	earliestStart,
	scheduleWindowDays = DEFAULT_SCHEDULING_HORIZON_DAYS,
	slotMinutes = DEFAULT_SLOT_MINUTES,
	dayStartHour = DEFAULT_DAY_START_HOUR,
	dayEndHour = DEFAULT_DAY_END_HOUR,
	maxChunkMinutes = DEFAULT_MAX_CHUNK_MINUTES,
	timezone = DEFAULT_TIMEZONE,
}: ScheduleTasksOptions<TTask>): ScheduledTask<TTask>[] {
	const busyInputs = busy ?? busyIntervals ?? [];
	const busyIntervalsToScheduleAround = normalizeBusyIntervals(busyInputs);
	const sortedTasks = [...tasks].sort(
		(a, b) =>
			toDate(a.dueDate).getTime() - toDate(b.dueDate).getTime() ||
			a.id.localeCompare(b.id),
	);
	const scheduledTasks: ScheduledTask<TTask>[] = [];

	for (const task of sortedTasks) {
		scheduledTasks.push(
			scheduleOneTask(task, busyIntervalsToScheduleAround, {
				earliestStart: earliestStart ? toDate(earliestStart) : undefined,
				scheduleWindowDays,
				slotMinutes,
				dayStartHour,
				dayEndHour,
				maxChunkMinutes,
				timezone,
			}),
		);
	}

	return scheduledTasks;
}

export function scheduleTasksResult<TTask extends SchedulingTask>(
	options: ScheduleTasksOptions<TTask>,
): TaskSchedulingResult<TTask> {
	const busyInputs = options.busy ?? options.busyIntervals ?? [];
	const hasInvalidBusyInterval = busyInputs.some((interval) => {
		const start = parseValidDate(interval.startDate);
		const end = parseValidDate(interval.endDate);
		return !start || !end || start >= end;
	});

	if (hasInvalidBusyInterval) {
		return {
			status: "failed",
			reason: "INVALID_BUSY_INTERVAL",
			message: "A busy interval has an invalid start or end date.",
			scheduledTasks: [],
		};
	}

	const invalidTask = options.tasks.find(
		(task) => !parseValidDate(task.dueDate),
	);
	if (invalidTask) {
		return {
			status: "failed",
			reason: "INVALID_DUE_DATE",
			taskId: invalidTask.id,
			message: `Task ${invalidTask.id} has an invalid due date.`,
			scheduledTasks: [],
		};
	}

	try {
		const scheduledTasks = scheduleTasks(options).map((task) => ({
			...task,
			scheduleStatus: { state: "scheduled" as const },
		}));

		return {
			status: "scheduled",
			tasks: scheduledTasks,
		};
	} catch (error) {
		const message =
			error instanceof Error
				? error.message
				: "Unable to schedule one or more tasks before their due dates.";

		return {
			status: "failed",
			reason: "INSUFFICIENT_CAPACITY",
			taskId: extractTaskIdFromSchedulingMessage(message),
			message,
			scheduledTasks: [],
		};
	}
}

function parseValidDate(value: string | Date): Date | null {
	const date = value instanceof Date ? new Date(value) : new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return date;
}

function extractTaskIdFromSchedulingMessage(message: string): string | undefined {
	const match = message.match(/task\s+([^\s]+)/i);
	if (!match) return undefined;
	return match[1];
}
