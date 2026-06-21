import {
	createTaskDeleteHandler,
	createTaskPatchHandler,
} from "@/app/api/tasks/handlers";
import { requireUserId } from "@/modules/api/auth";
import {
	deleteTaskForUser,
	updateTaskForUser,
} from "@/modules/persistence/calendar-repository";

const dependencies = { requireUserId, updateTaskForUser, deleteTaskForUser };
export const PATCH = createTaskPatchHandler(dependencies);
export const DELETE = createTaskDeleteHandler(dependencies);
