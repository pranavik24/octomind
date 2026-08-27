"use client";

import {
	CheckCircle2,
	Link2,
	Link2Off,
	RefreshCw,
	RotateCcw,
	TriangleAlert,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { callbackMessageFor, isSuccessfulCallback } from "./classroom-messages";

interface ConnectionState {
	connected: boolean;
	connection: {
		healthy: boolean;
		lastError: string | null;
		lastSyncedAt: string | null;
		connectedAt: string;
		revokedAt: string | null;
	} | null;
}

type Action = "connect" | "sync" | "disconnect" | null;

const disconnectedState: ConnectionState = {
	connected: false,
	connection: null,
};

function errorMessage(data: unknown, fallback: string) {
	if (!data || typeof data !== "object") return fallback;
	const error = "error" in data ? data.error : null;
	if (typeof error === "string") return error;
	if (error && typeof error === "object" && "message" in error) {
		return typeof error.message === "string" ? error.message : fallback;
	}
	return fallback;
}

async function jsonResponse(response: Response) {
	const data = (await response.json().catch(() => null)) as unknown;
	if (!response.ok) throw new Error(errorMessage(data, "The request failed."));
	return data;
}

function formatTimestamp(value: string | null | undefined) {
	if (!value) return "Never";
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

export function ClassroomIntegrationCard() {
	const searchParams = useSearchParams();
	const [state, setState] = useState<ConnectionState | null>(null);
	const [action, setAction] = useState<Action>(null);
	const [error, setError] = useState<string | null>(null);

	const callbackCode = useMemo(
		() =>
			searchParams.get("error") ??
			searchParams.get("code") ??
			searchParams.get("status") ??
			searchParams.get("classroom"),
		[searchParams],
	);
	const callbackMessage = callbackMessageFor(callbackCode);

	const loadState = useCallback(async () => {
		try {
			const response = await fetch("/api/integrations/google-classroom/sync", {
				cache: "no-store",
			});
			const data = (await jsonResponse(response)) as ConnectionState;
			setState(data);
			setError(null);
		} catch (cause) {
			setState(disconnectedState);
			setError(
				cause instanceof Error
					? cause.message
					: "Could not load the Classroom connection.",
			);
		}
	}, []);

	useEffect(() => {
		void loadState();
	}, [loadState]);

	const connect = async () => {
		setAction("connect");
		setError(null);
		try {
			const response = await fetch(
				"/api/integrations/google-classroom/connect",
				{ method: "POST" },
			);
			const data = (await jsonResponse(response)) as {
				authorizationUrl?: unknown;
			};
			if (typeof data.authorizationUrl !== "string") {
				throw new Error("Google Classroom authorization could not start.");
			}
			window.location.assign(data.authorizationUrl);
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not connect.");
			setAction(null);
		}
	};

	const sync = async () => {
		setAction("sync");
		setError(null);
		try {
			await jsonResponse(
				await fetch("/api/integrations/google-classroom/sync", {
					method: "POST",
				}),
			);
			await loadState();
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : "Could not sync.");
		} finally {
			setAction(null);
		}
	};

	const disconnect = async () => {
		setAction("disconnect");
		setError(null);
		try {
			const data = (await jsonResponse(
				await fetch("/api/integrations/google-classroom/disconnect", {
					method: "DELETE",
				}),
			)) as { ok?: unknown };
			if (data.ok !== true) throw new Error("Could not disconnect Classroom.");
			setState(disconnectedState);
		} catch (cause) {
			setError(
				cause instanceof Error ? cause.message : "Could not disconnect.",
			);
		} finally {
			setAction(null);
		}
	};

	const connected = state?.connected === true;
	const healthy = connected && state.connection?.healthy === true;
	const isLoading = state === null;

	return (
		<section className="ocean-shell rounded-xl border p-5">
			<div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<h2 className="text-lg font-semibold text-foreground">
							Google Classroom
						</h2>
						{isLoading ? (
							<Badge variant="outline">Loading</Badge>
						) : connected ? (
							<Badge variant={healthy ? "default" : "destructive"}>
								{healthy ? "Healthy" : "Needs attention"}
							</Badge>
						) : (
							<Badge variant="outline">Not connected</Badge>
						)}
					</div>
					<p className="mt-1 max-w-2xl text-sm text-muted-foreground">
						Import published coursework with due dates into your task schedule.
					</p>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					{connected ? (
						<>
							<Button onClick={sync} disabled={action !== null}>
								<RefreshCw
									className={action === "sync" ? "animate-spin" : ""}
								/>
								Sync now
							</Button>
							<Button
								variant="outline"
								onClick={connect}
								disabled={action !== null}
							>
								<RotateCcw
									className={action === "connect" ? "animate-spin" : ""}
								/>
								Reconnect
							</Button>
							<Button
								variant="outline"
								onClick={disconnect}
								disabled={action !== null}
							>
								<Link2Off />
								Disconnect
							</Button>
						</>
					) : (
						<Button onClick={connect} disabled={action !== null || isLoading}>
							<Link2 className={action === "connect" ? "animate-pulse" : ""} />
							Connect
						</Button>
					)}
				</div>
			</div>

			<div className="mt-5 grid gap-3 border-t border-border pt-4 text-sm sm:grid-cols-2">
				<div>
					<p className="font-medium text-foreground">Connection health</p>
					<p className="mt-1 flex items-center gap-2 text-muted-foreground">
						{healthy ? (
							<CheckCircle2 className="size-4 text-emerald-600" />
						) : (
							<TriangleAlert className="size-4 text-amber-600" />
						)}
						{isLoading
							? "Checking..."
							: healthy
								? "Ready to sync"
								: connected
									? "Reconnect required"
									: "Not connected"}
					</p>
				</div>
				<div>
					<p className="font-medium text-foreground">Last sync</p>
					<p className="mt-1 text-muted-foreground">
						{isLoading
							? "Checking..."
							: formatTimestamp(state?.connection?.lastSyncedAt)}
					</p>
				</div>
			</div>

			{callbackMessage ? (
				<output
					className={`mt-4 text-sm ${isSuccessfulCallback(callbackCode) ? "text-emerald-700" : "text-amber-800"}`}
				>
					{callbackMessage}
				</output>
			) : null}
			{state?.connection?.lastError || error ? (
				<p className="mt-4 text-sm text-red-700" role="alert">
					{error ?? state?.connection?.lastError}
				</p>
			) : null}
			<p className="mt-4 border-t border-border pt-4 text-sm text-muted-foreground">
				Google Classroom import is currently in beta. You can still use the
				scheduler by manually adding tasks.
			</p>
		</section>
	);
}
