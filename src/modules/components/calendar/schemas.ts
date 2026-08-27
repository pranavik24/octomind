import { z } from "zod";

const colorSchema = z.enum([
	"School",
	"Homework",
	"Studying",
	"Extracurriculars",
	"Work",
	"Other",
]);

const eventFieldsSchema = z.object({
	title: z.string().trim().min(1, "Please enter a title"),
	location: z.string().max(240).optional(),
	description: z.string().max(4000).optional(),
	startDate: z.date({
		required_error: "Please choose a start date and time",
	}),
	endDate: z.date({
		required_error: "Please choose an end date and time",
	}),
	color: colorSchema,
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

const validateEventInterval = (
	value: { startDate: Date; endDate: Date },
	context: z.RefinementCtx,
) => {
	if (value.endDate <= value.startDate) {
		context.addIssue({
			code: z.ZodIssueCode.custom,
			path: ["endDate"],
			message: "End date and time must be after the start date and time.",
		});
	}
};

export const eventSchema = eventFieldsSchema.superRefine(validateEventInterval);

export const taskSchema = z.object({
	title: z.string().trim().min(1, "Please enter a task name"),
	description: z.string().max(4000).default(""),
	dueDate: z.date({ required_error: "Please choose a due date and time" }),
	estimatedHours: z.number().min(0.5).max(8).optional(),
	color: colorSchema,
});

export type TEventFormData = z.infer<typeof eventSchema>;
export type TTaskFormData = z.infer<typeof taskSchema>;
