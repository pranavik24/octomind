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
	id: number;
	dueDate: string;
	estimatedHours?: number;
	scheduledBlocks?: ScheduledBlock[];
	scheduleStatus?: TaskScheduleStatus;
}

export interface BusyInterval {
	startDate: string;
	endDate: string;
}

export interface ScheduleTasksOptions<TTask extends SchedulingTask> {
	tasks: TTask[];
	busy?: BusyInterval[];
	busyIntervals?: BusyInterval[];
	earliestStart?: string | Date;
	scheduleWindowDays?: number;
	slotMinutes?: number;
	dayStartHour?: number;
	dayEndHour?: number;
	maxChunkMinutes?: number;
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
	taskId?: number;
	scheduledTasks: ScheduledTask<TTask>[];
};

export type TaskSchedulingResult<TTask extends SchedulingTask> =
	| TaskSchedulingSuccess<TTask>
	| TaskSchedulingFailure<TTask>;

export class TaskSchedulingError extends Error {
	reason: TaskSchedulingFailureReason;
	taskId?: number;

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

function startOfLocalDay(date: Date): Date {
	const result = new Date(date);
	result.setHours(0, 0, 0, 0);
	return result;
}

function addDays(date: Date, days: number): Date {
	const result = new Date(date);
	result.setDate(result.getDate() + days);
	return result;
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

function roundUpToSlot(date: Date, slotMinutes: number): Date {
	const slotMs = slotMinutes * 60 * 1000;
	return new Date(Math.ceil(date.getTime() / slotMs) * slotMs);
}

function hoursBefore(date: Date, hours: number): Date {
	return new Date(date.getTime() - hours * 60 * 60 * 1000);
}

function isInsideWorkWindow(
	interval: Interval,
	dayStartHour: number,
	dayEndHour: number,
): boolean {
	if (
		startOfLocalDay(interval.start).getTime() !==
		startOfLocalDay(interval.end).getTime()
	) {
		return false;
	}

	const startMinutes = interval.start.getHours() * 60 + interval.start.getMinutes();
	const endMinutes = interval.end.getHours() * 60 + interval.end.getMinutes();

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
}: {
	deadline: Date;
	durationMinutes: number;
	busy: Interval[];
	earliestStart?: Date;
	scheduleWindowDays: number;
	slotMinutes: number;
	dayStartHour: number;
	dayEndHour: number;
}): Interval[] {
	const durationMs = durationMinutes * 60 * 1000;
	const windowStart = startOfLocalDay(addDays(deadline, -scheduleWindowDays));
	const searchStart = roundUpToSlot(
		earliestStart ? maxDate(windowStart, earliestStart) : windowStart,
		slotMinutes,
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
			isInsideWorkWindow(interval, dayStartHour, dayEndHour) &&
			isIntervalFree(interval, busy)
		) {
			candidates.push(interval);
		}
	}

	return candidates;
}

function daysBetween(start: Date, end: Date): number {
	return (startOfLocalDay(end).getTime() - startOfLocalDay(start).getTime()) /
		(24 * 60 * 60 * 1000);
}

function taskSchedulingStrategy(
	totalMinutes: number,
	searchStart: Date,
	deadline: Date,
): "quick-win" | "spread-out" | "steady-progress" {
	const daysUntilDue = daysBetween(searchStart, deadline);

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
}: {
	chunkIndex: number;
	deadline: Date;
	searchStart: Date;
	strategy: ReturnType<typeof taskSchedulingStrategy>;
	totalChunks: number;
}): Date {
	if (strategy === "quick-win") return searchStart;

	if (strategy === "spread-out") {
		const preferredFinish = maxDate(
			searchStart,
			addDays(deadline, -LARGE_TASK_BUFFER_DAYS),
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
	> & { earliestStart?: Date },
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
					startOfLocalDay(addDays(deadline, -options.scheduleWindowDays)),
					options.earliestStart,
				)
			: startOfLocalDay(addDays(deadline, -options.scheduleWindowDays)),
		options.slotMinutes,
	);
	const strategy = taskSchedulingStrategy(totalMinutes, searchStart, deadline);

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
		});
		const interval = chooseBestInterval(
			candidates,
			targetForChunk({
				chunkIndex,
				deadline,
				searchStart,
				strategy,
				totalChunks: chunks.length,
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
}: ScheduleTasksOptions<TTask>): ScheduledTask<TTask>[] {
	const busyInputs = busy ?? busyIntervals ?? [];
	const busyIntervalsToScheduleAround = normalizeBusyIntervals(busyInputs);
	const sortedTasks = [...tasks].sort(
		(a, b) =>
			toDate(a.dueDate).getTime() - toDate(b.dueDate).getTime() || a.id - b.id,
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

function extractTaskIdFromSchedulingMessage(message: string): number | undefined {
	const match = message.match(/task\s+(\d+)/i);
	if (!match) return undefined;
	return Number(match[1]);
}
