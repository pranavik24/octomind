import type { TEventColor } from "@/modules/components/calendar/types";
import type { TaskEstimateSource } from "@/modules/persistence/data-model";

export interface ClassroomDate {
	year: number;
	month: number;
	day: number;
}

export interface ClassroomTimeOfDay {
	hours?: number;
	minutes?: number;
	seconds?: number;
	nanos?: number;
}

export interface ClassroomCourseWork {
	id: string;
	title?: string;
	description?: string;
	state?: string;
	alternateLink?: string;
	dueDate?: ClassroomDate;
	dueTime?: ClassroomTimeOfDay;
}

export interface ClassroomTaskInput {
	title: string;
	description: string;
	color: TEventColor;
	dueDate: string;
	estimatedHours: number;
	externalProvider: "google_classroom";
	externalId: string;
	externalCourseId: string;
	externalUrl: string | null;
	estimateSource: TaskEstimateSource;
	estimateModel: string | null;
	estimateReason: string | null;
}

export function classroomDueAt(
	dueDate: ClassroomDate,
	dueTime?: ClassroomTimeOfDay,
): Date {
	const hours = dueTime?.hours ?? 23;
	const minutes = dueTime?.minutes ?? 59;
	const seconds = dueTime?.seconds ?? 0;

	return new Date(
		Date.UTC(dueDate.year, dueDate.month - 1, dueDate.day, hours, minutes, seconds),
	);
}

export function classroomExternalId(courseId: string, courseWorkId: string): string {
	return `${courseId}:${courseWorkId}`;
}

export function buildClassroomTaskInput({
	courseId,
	courseName,
	courseWork,
	estimatedMinutes,
	estimateModel = null,
	estimateReason = null,
}: {
	courseId: string;
	courseName: string;
	courseWork: ClassroomCourseWork;
	estimatedMinutes: number;
	estimateModel?: string | null;
	estimateReason?: string | null;
}): ClassroomTaskInput | null {
	if (!courseWork.dueDate) return null;

	const title = (courseWork.title ?? "Untitled assignment").trim();
	const rawDescription = (courseWork.description ?? "").trim();
	const description = rawDescription ? `${courseName}: ${rawDescription}` : courseName;

	return {
		title,
		description,
		color: "Homework",
		dueDate: classroomDueAt(courseWork.dueDate, courseWork.dueTime).toISOString(),
		estimatedHours: estimatedMinutes / 60,
		externalProvider: "google_classroom",
		externalId: classroomExternalId(courseId, courseWork.id),
		externalCourseId: courseId,
		externalUrl: courseWork.alternateLink ?? null,
		estimateSource: "gemini",
		estimateModel,
		estimateReason,
	};
}
