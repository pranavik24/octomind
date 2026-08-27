import { apiError } from "@/modules/api/auth";
import {
	routeIdSchema,
	taskCreatePayloadSchema,
	taskPayloadSchema,
} from "@/modules/api/calendar-schemas";
import type { ITask } from "@/modules/components/calendar/interfaces";

type TaskRouteContext = { params: Promise<{ taskId: string }> };

export type TaskPostDependencies = {
	requireUserId: () => Promise<string>;
	createTaskForUser: (userId: string, task: ITask) => Promise<unknown>;
	createId: () => string;
};

export type TaskWriteDependencies = {
	requireUserId: () => Promise<string>;
	updateTaskForUser: (
		userId: string,
		taskId: string,
		task: ITask,
	) => Promise<unknown>;
	deleteTaskForUser: (userId: string, taskId: string) => Promise<unknown>;
};

export function createTasksPostHandler(dependencies: TaskPostDependencies) {
	return async function post(request: Request) {
		try {
			const userId = await dependencies.requireUserId();
			const body = taskCreatePayloadSchema.parse(await request.json());
			const task = await dependencies.createTaskForUser(userId, {
				...body,
				id: dependencies.createId(),
				description: body.description ?? "",
				user: body.user ?? { id: userId, name: "Student", picturePath: null },
			});

			return Response.json({ task });
		} catch (error) {
			return apiError(error);
		}
	};
}

export function createTaskPatchHandler(dependencies: TaskWriteDependencies) {
	return async function patch(request: Request, { params }: TaskRouteContext) {
		try {
			const userId = await dependencies.requireUserId();
			const taskId = routeIdSchema.parse((await params).taskId);
			const body = taskPayloadSchema.parse(await request.json());
			const task = await dependencies.updateTaskForUser(userId, taskId, {
				...body,
				id: taskId,
				description: body.description ?? "",
				user: body.user ?? { id: userId, name: "Student", picturePath: null },
			});

			return Response.json({ task });
		} catch (error) {
			return apiError(error);
		}
	};
}

export function createTaskDeleteHandler(dependencies: TaskWriteDependencies) {
	return async function remove(
		_request: Request,
		{ params }: TaskRouteContext,
	) {
		try {
			const userId = await dependencies.requireUserId();
			const taskId = routeIdSchema.parse((await params).taskId);
			await dependencies.deleteTaskForUser(userId, taskId);
			return Response.json({ ok: true });
		} catch (error) {
			return apiError(error);
		}
	};
}
