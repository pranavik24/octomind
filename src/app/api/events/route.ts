import { randomUUID } from "node:crypto";
import { createEventsPostHandler } from "@/app/api/events/handlers";
import { requireUserId } from "@/modules/api/auth";
import { createEventForUser } from "@/modules/persistence/calendar-repository";

export const POST = createEventsPostHandler({
	requireUserId,
	createEventForUser,
	createId: randomUUID,
});
