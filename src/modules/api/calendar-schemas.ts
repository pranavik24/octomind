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

export const eventPayloadSchema = z.object({
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

export const eventCreatePayloadSchema = eventPayloadSchema.omit({
	id: true,
	taskId: true,
});

export const taskPayloadSchema = z.object({
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

export const taskCreatePayloadSchema = taskPayloadSchema.omit({ id: true });

export const routeIdSchema = z.string().uuid("Invalid route ID.");
