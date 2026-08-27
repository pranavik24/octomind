import { getServerSession } from "next-auth";
import { ZodError } from "zod";
import { authOptions } from "@/modules/auth/auth-options";

export type ApiErrorCode =
	| "unauthorized"
	| "not_found"
	| "validation_error"
	| "scheduling_conflict"
	| "service_unavailable"
	| "internal_error";

export class ApiError extends Error {
	readonly code: ApiErrorCode;
	readonly status: 400 | 401 | 404 | 409 | 500 | 503;
	readonly publicMessage: string;

	constructor(
		code: ApiErrorCode,
		status: 400 | 401 | 404 | 409 | 500 | 503,
		publicMessage: string,
		options?: ErrorOptions,
	) {
		super(publicMessage, options);
		this.name = "ApiError";
		this.code = code;
		this.status = status;
		this.publicMessage = publicMessage;
	}
}

export class NotFoundError extends ApiError {
	constructor(publicMessage = "Record not found.") {
		super("not_found", 404, publicMessage);
		this.name = "NotFoundError";
	}
}

export class SchedulingError extends ApiError {
	readonly reason?: string;

	constructor(publicMessage = "Task cannot be scheduled.", reason?: string) {
		super("scheduling_conflict", 409, publicMessage);
		this.name = "SchedulingError";
		this.reason = reason;
	}
}

function isDatabaseUnavailable(error: unknown): boolean {
	if (!error || typeof error !== "object") return false;

	const candidate = error as { code?: unknown; name?: unknown };
	return (
		candidate.name === "PrismaClientInitializationError" ||
		candidate.code === "P1001" ||
		candidate.code === "P1002"
	);
}

export async function requireUserId(): Promise<string> {
	const session = await getServerSession(authOptions);
	const userId = session?.user?.id;
	if (!userId) {
		throw new ApiError("unauthorized", 401, "Authentication required.");
	}
	return userId;
}

export function apiError(error: unknown) {
	if (error instanceof ApiError) {
		return Response.json(
			{ error: { code: error.code, message: error.publicMessage } },
			{ status: error.status },
		);
	}
	if (error instanceof ZodError || error instanceof SyntaxError) {
		return Response.json(
			{ error: { code: "validation_error", message: "Invalid request." } },
			{ status: 400 },
		);
	}
	if (isDatabaseUnavailable(error)) {
		return Response.json(
			{
				error: {
					code: "service_unavailable",
					message:
						"Calendar storage is unavailable. Check the Supabase database connection.",
				},
			},
			{ status: 503 },
		);
	}

	console.error("Unexpected API error", error);
	return Response.json(
		{ error: { code: "internal_error", message: "Something went wrong." } },
		{ status: 500 },
	);
}
