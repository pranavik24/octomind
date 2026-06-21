import { randomUUID } from "node:crypto";
import { createTasksPostHandler } from "@/app/api/tasks/handlers";
import { requireUserId } from "@/modules/api/auth";
import { createTaskForUser } from "@/modules/persistence/calendar-repository";

export const POST = createTasksPostHandler({
	requireUserId,
	createTaskForUser,
	createId: randomUUID,
});
