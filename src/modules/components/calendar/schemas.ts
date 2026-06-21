import { z } from "zod";

export const eventSchema = z.object({
	title: z.string().min(1, "Title is required"),
	description: z.string().min(1, "Description is required"),
	startDate: z.date({
		required_error: "Start date is required",
	}),
	endDate: z.date({
		required_error: "End date is required",
	}),
	color: z.enum(
		["School", "Homework", "Studying", "Extracurriculars", "Work", "Other"],
		{
			required_error: "Variant is required",
		},
	),
	// Simple recurrence fields for the UI: optional frequency and count
	recurrenceFreq: z
		.string()
		.optional()
		.refine(
			(v) => !v || ["none", "daily", "weekly", "monthly", "yearly"].includes(v),
			{
				message: "Invalid recurrence frequency",
			},
		),
	recurrenceCount: z.number().int().min(1).max(730).optional(),
	recurrencePreset: z
		.enum([
			"none",
			"daily",
			"weekly",
			"monthly",
			"yearly",
			"weekdays",
			"custom",
		])
		.optional(),
	recurrenceInterval: z.number().int().min(1).max(100).optional(),
	recurrenceWeekdays: z.array(z.number().int().min(0).max(6)).optional(),
	recurrenceEndType: z.enum(["never", "on", "after"]).optional(),
	recurrenceUntil: z.string().optional(),
	recurrenceBySetPos: z.number().int().min(1).max(5).optional(),
});

const taskSchema = eventSchema.extend({
	dueDate: z.date({
		required_error: "Due date is required",
	}),
});

export type TEventFormData = z.infer<typeof eventSchema>;
export type TTaskFormData = z.infer<typeof taskSchema>;
