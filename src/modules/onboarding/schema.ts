import { z } from "zod";

const timeSchema = z
	.string()
	.regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid time.");

function minutes(value: string) {
	const [hour, minute] = value.split(":").map(Number);
	return hour * 60 + minute;
}

export const onboardingPayloadSchema = z
	.object({
		timezone: z
			.string()
			.min(1)
			.max(100)
			.refine((timezone) => {
				try {
					new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format();
					return true;
				} catch {
					return false;
				}
			}, "Invalid timezone."),
		sleepTime: timeSchema,
		wakeTime: timeSchema,
		schoolDays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
		schoolStartTime: timeSchema,
		schoolEndTime: timeSchema,
	})
	.refine(
		(input) => minutes(input.schoolEndTime) > minutes(input.schoolStartTime),
		{
			message: "School must end after it starts.",
			path: ["schoolEndTime"],
		},
	);

export type OnboardingPayload = z.infer<typeof onboardingPayloadSchema>;
