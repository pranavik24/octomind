import type { TEventColor } from "@/modules/components/calendar/types";
import type {
	ScheduledBlock,
	TaskScheduleStatus,
} from "@/modules/components/calendar/scheduling";

export interface IUser {
	id: string;
	name: string;
	picturePath: string | null;
}

export interface IEvent {
	id: number;
	taskId?: number;
	startDate: string;
	endDate: string;
	title: string;
	location?: string;
	color: TEventColor;
	description: string;
	user: IUser;
	// Optional recurrence information. Simple recurrence support:
	// freq: 'daily' | 'weekly' | 'monthly' | 'yearly'
	// interval: number of units between occurrences (defaults to 1)
	// count: number of occurrences (including the original event)
	recurrence?: {
		freq: "daily" | "weekly" | "monthly" | "yearly";
		interval?: number;
		count?: number;
		until?: string; // optional ISO date string
		// optional list of weekdays for weekly recurrences (0 = Sunday .. 6 = Saturday)
		byweekday?: number[];
	};
}

export interface ITask {
	id: number;
	dueDate: string;
	estimatedHours?: number;
	scheduledBlocks?: ScheduledBlock[];
	scheduleStatus?: TaskScheduleStatus;
	title: string;
	color: TEventColor;
	description: string;
	user: IUser;
}

export interface ICalendarCell {
	day: number;
	currentMonth: boolean;
	date: Date;
}
