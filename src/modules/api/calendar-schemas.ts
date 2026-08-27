import { z } from "zod";
import { COLORS } from "@/modules/components/calendar/constants";
import type { TEventColor } from "@/modules/components/calendar/types";

const colorSchema = z.custom<TEventColor>(
	(value) => COLORS.includes(value as TEventColor),
	"Invalid color.",
);

const userSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	picturePath: z.string().nullable(),
});

const dateStringSchema = z
	.string()
	.refine((value) => !Number.isNaN(new Date(value).getTime()), {
		message: "Invalid date.",
	});

const eventFieldsSchema = z.object({
	id: z.string().optional(),
	taskId: z.string().optional(),
	startDate: dateStringSchema,
	endDate: dateStringSchema,
	title: z.string().min(1).max(160),
	location: z.string().max(240).optional(),
	color: colorSchema,
	description: z.string().max(4000).default(""),
	user: userSchema.optional(),
	recurrence: z
		.object({
			freq: z.enum(["daily", "weekly", "monthly", "yearly"]),
			interval: z.number().int().min(1).max(100).optional(),
			count: z.number().int().min(1).max(730).optional(),
			until: dateStringSchema.optional(),
			byweekday: z.array(z.number().int().min(0).max(6)).optional(),
			bysetpos: z.number().int().min(1).max(5).optional(),
		})
		.optional(),
});

const validateEventInterval = (
	value: { startDate: string; endDate: string },
	context: z.RefinementCtx,
) => {
	if (new Date(value.endDate) <= new Date(value.startDate)) {
		context.addIssue({
			code: z.ZodIssueCode.custom,
			path: ["endDate"],
			message: "End date and time must be after the start date and time.",
		});
	}
};

export const eventPayloadSchema = eventFieldsSchema.superRefine(validateEventInterval);
export const eventSchema = eventPayloadSchema;

export const eventCreatePayloadSchema = eventFieldsSchema
	.omit({ id: true, taskId: true })
	.superRefine(validateEventInterval);

const taskFieldsSchema = z.object({
	id: z.string().optional(),
	dueDate: dateStringSchema,
	estimatedHours: z.number().min(0.5).max(12).optional(),
	scheduledBlocks: z
		.array(
			z.object({
				startDate: dateStringSchema,
				endDate: dateStringSchema,
			}),
		)
		.optional(),
	title: z.string().min(1).max(160),
	color: colorSchema,
	description: z.string().max(4000).default(""),
	user: userSchema.optional(),
});

const validateTaskBlocks = (
	value: { scheduledBlocks?: Array<{ startDate: string; endDate: string }> },
	context: z.RefinementCtx,
) => {
	for (const [index, block] of (value.scheduledBlocks ?? []).entries()) {
		if (new Date(block.endDate) <= new Date(block.startDate)) {
			context.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["scheduledBlocks", index, "endDate"],
				message: "Block end must be after block start.",
			});
		}
	}
};

export const taskPayloadSchema = taskFieldsSchema.superRefine(validateTaskBlocks);
export const taskCreatePayloadSchema = taskFieldsSchema
	.omit({ id: true })
	.superRefine(validateTaskBlocks);

export const taskSchema = z.object({
	title: z.string().trim().min(1, "Please enter a task name"),
	description: z.string().max(4000).default(""),
	dueDate: z.date({ required_error: "Please choose a due date and time" }),
	estimatedHours: z.number().min(0.5).max(8).optional(),
	color: z.enum(
		["School", "Homework", "Studying", "Extracurriculars", "Work", "Other"],
		{ required_error: "Please choose a category" },
	),
});

export type TEventFormData = z.infer<typeof eventSchema>;
export type TTaskFormData = z.infer<typeof taskSchema>;

export const routeIdSchema = z.string().uuid("Invalid route ID.");
