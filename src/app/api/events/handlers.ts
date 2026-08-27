import { apiError } from "@/modules/api/auth";
import {
	eventCreatePayloadSchema,
	eventPayloadSchema,
	routeIdSchema,
} from "@/modules/api/calendar-schemas";
import type { IEvent } from "@/modules/components/calendar/interfaces";

type EventRouteContext = { params: Promise<{ eventId: string }> };

export type EventPostDependencies = {
	requireUserId: () => Promise<string>;
	createEventForUser: (userId: string, event: IEvent) => Promise<IEvent[]>;
	createId: () => string;
};

export type EventWriteDependencies = {
	requireUserId: () => Promise<string>;
	updateEventForUser: (
		userId: string,
		eventId: string,
		event: IEvent,
	) => Promise<IEvent>;
	deleteEventForUser: (userId: string, eventId: string) => Promise<unknown>;
};

export function createEventsPostHandler(dependencies: EventPostDependencies) {
	return async function post(request: Request) {
		try {
			const userId = await dependencies.requireUserId();
			const body = eventCreatePayloadSchema.parse(await request.json());
			const events = await dependencies.createEventForUser(userId, {
				...body,
				id: dependencies.createId(),
				description: body.description ?? "",
				user: body.user ?? { id: userId, name: "Student", picturePath: null },
			});

			return Response.json({ events });
		} catch (error) {
			return apiError(error);
		}
	};
}

export function createEventPatchHandler(dependencies: EventWriteDependencies) {
	return async function patch(request: Request, { params }: EventRouteContext) {
		try {
			const userId = await dependencies.requireUserId();
			const eventId = routeIdSchema.parse((await params).eventId);
			const body = eventPayloadSchema.parse(await request.json());
			const event = await dependencies.updateEventForUser(userId, eventId, {
				...body,
				id: eventId,
				description: body.description ?? "",
				user: body.user ?? { id: userId, name: "Student", picturePath: null },
			});

			return Response.json({ event });
		} catch (error) {
			return apiError(error);
		}
	};
}

export function createEventDeleteHandler(dependencies: EventWriteDependencies) {
	return async function remove(
		_request: Request,
		{ params }: EventRouteContext,
	) {
		try {
			const userId = await dependencies.requireUserId();
			const eventId = routeIdSchema.parse((await params).eventId);
			await dependencies.deleteEventForUser(userId, eventId);
			return Response.json({ ok: true });
		} catch (error) {
			return apiError(error);
		}
	};
}
