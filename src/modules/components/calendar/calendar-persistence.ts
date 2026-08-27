import type { IEvent, ITask } from "@/modules/components/calendar/interfaces";

type Fetcher = (
	input: string | URL | Request,
	init?: RequestInit,
) => Promise<Response>;

async function requestJson<T>(
	url: string,
	init: RequestInit,
	fetcher: Fetcher = fetch,
): Promise<T> {
	const response = await fetcher(url, {
		...init,
		headers: {
			...(init.body ? { "Content-Type": "application/json" } : {}),
			...(init.headers ?? {}),
		},
	});
	const data = await response.json().catch(() => null);

	if (!response.ok) {
		const message =
			typeof data?.error === "string"
				? data.error
				: typeof data?.error?.message === "string"
					? data.error.message
					: `Calendar persistence failed (HTTP ${response.status}).`;
		throw new Error(message);
	}

	return data as T;
}

export async function createPersistedEvent(
	event: IEvent,
	fetcher: Fetcher = fetch,
): Promise<IEvent[]> {
	const data = await requestJson<{ events?: IEvent[] }>(
		"/api/events",
		{ method: "POST", body: JSON.stringify(event) },
		fetcher,
	);
	if (!Array.isArray(data.events) || data.events.length === 0) {
		throw new Error("Event creation returned an invalid response.");
	}
	return data.events;
}

export async function updatePersistedEvent(
	event: IEvent,
	fetcher: Fetcher = fetch,
): Promise<IEvent> {
	const data = await requestJson<{ event?: IEvent }>(
		`/api/events/${event.id}`,
		{ method: "PATCH", body: JSON.stringify(event) },
		fetcher,
	);
	if (!data.event || typeof data.event.id !== "string") {
		throw new Error("Event update returned an invalid response.");
	}
	return data.event;
}

export async function deletePersistedEvent(
	eventId: string,
	fetcher: Fetcher = fetch,
): Promise<void> {
	await requestJson(`/api/events/${eventId}`, { method: "DELETE" }, fetcher);
}

export async function createPersistedTask(
	task: ITask,
	fetcher: Fetcher = fetch,
): Promise<ITask> {
	const data = await requestJson<{ task?: ITask }>(
		"/api/tasks",
		{ method: "POST", body: JSON.stringify(task) },
		fetcher,
	);
	if (!data.task || typeof data.task.id !== "string") {
		throw new Error("Task creation returned an invalid response.");
	}
	return data.task;
}

export async function updatePersistedTask(
	task: ITask,
	fetcher: Fetcher = fetch,
): Promise<ITask> {
	const data = await requestJson<{ task?: ITask }>(
		`/api/tasks/${task.id}`,
		{ method: "PATCH", body: JSON.stringify(task) },
		fetcher,
	);
	if (!data.task || typeof data.task.id !== "string") {
		throw new Error("Task update returned an invalid response.");
	}
	return data.task;
}

export async function deletePersistedTask(
	taskId: string,
	fetcher: Fetcher = fetch,
): Promise<void> {
	await requestJson(`/api/tasks/${taskId}`, { method: "DELETE" }, fetcher);
}
