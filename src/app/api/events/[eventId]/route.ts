import {
	createEventDeleteHandler,
	createEventPatchHandler,
} from "@/app/api/events/handlers";
import { requireUserId } from "@/modules/api/auth";
import {
	deleteEventForUser,
	updateEventForUser,
} from "@/modules/persistence/calendar-repository";

const dependencies = { requireUserId, updateEventForUser, deleteEventForUser };
export const PATCH = createEventPatchHandler(dependencies);
export const DELETE = createEventDeleteHandler(dependencies);
