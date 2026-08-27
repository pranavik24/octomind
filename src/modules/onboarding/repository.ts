import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { buildOnboardingEvents } from "./schedule";
import type { OnboardingPayload } from "./schema";

export async function onboardingCompletedForUser(userId: string) {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { onboardingCompletedAt: true },
	});
	return user?.onboardingCompletedAt !== null && user !== null;
}

export async function completeOnboardingForUser(
	userId: string,
	input: OnboardingPayload,
) {
	const events = buildOnboardingEvents(input);
	const [sleepHour, sleepMinute] = input.sleepTime.split(":").map(Number);
	const [wakeHour, wakeMinute] = input.wakeTime.split(":").map(Number);

	return prisma.$transaction(
		async (tx) => {
			const claimed = await tx.user.updateMany({
				where: { id: userId, onboardingCompletedAt: null },
				data: {
					timezone: input.timezone,
					sleepTimeMinutes: sleepHour * 60 + sleepMinute,
					wakeTimeMinutes: wakeHour * 60 + wakeMinute,
					onboardingCompletedAt: new Date(),
				},
			});

			if (claimed.count === 0) return { created: false };

			await tx.event.createMany({
				data: events.map((event) => ({
					id: randomUUID(),
					userId,
					title: event.title,
					description: event.description,
					location: event.location,
					color: event.color,
					startAt: event.startAt,
					endAt: event.endAt,
				})),
			});

			return { created: true };
		},
		{ isolationLevel: "Serializable" },
	);
}
