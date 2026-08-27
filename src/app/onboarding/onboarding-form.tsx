"use client";

import { ArrowRight, GraduationCap, Moon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const weekdays = [
	{ value: 0, short: "Sun", label: "Sunday" },
	{ value: 1, short: "Mon", label: "Monday" },
	{ value: 2, short: "Tue", label: "Tuesday" },
	{ value: 3, short: "Wed", label: "Wednesday" },
	{ value: 4, short: "Thu", label: "Thursday" },
	{ value: 5, short: "Fri", label: "Friday" },
	{ value: 6, short: "Sat", label: "Saturday" },
] as const;

function responseError(data: unknown) {
	if (!data || typeof data !== "object" || !("error" in data)) return null;
	const error = data.error;
	if (typeof error === "string") return error;
	if (error && typeof error === "object" && "message" in error) {
		return typeof error.message === "string" ? error.message : null;
	}
	return null;
}

export function OnboardingForm() {
	const router = useRouter();
	const timezone = useMemo(
		() => Intl.DateTimeFormat().resolvedOptions().timeZone,
		[],
	);
	const [schoolDays, setSchoolDays] = useState([1, 2, 3, 4, 5]);
	const [schoolStartTime, setSchoolStartTime] = useState("08:00");
	const [schoolEndTime, setSchoolEndTime] = useState("15:00");
	const [sleepTime, setSleepTime] = useState("23:00");
	const [wakeTime, setWakeTime] = useState("07:00");
	const [error, setError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	const toggleSchoolDay = (day: number) => {
		setSchoolDays((current) =>
			current.includes(day)
				? current.filter((value) => value !== day)
				: [...current, day].sort((a, b) => a - b),
		);
	};

	const submit = async (event: React.FormEvent) => {
		event.preventDefault();
		if (schoolDays.length === 0) {
			setError("Select at least one school day.");
			return;
		}
		setSubmitting(true);
		setError(null);
		try {
			const response = await fetch("/api/onboarding", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					timezone,
					sleepTime,
					wakeTime,
					schoolDays,
					schoolStartTime,
					schoolEndTime,
				}),
			});
			const data = (await response.json().catch(() => null)) as unknown;
			if (!response.ok) {
				throw new Error(
					responseError(data) ?? "Your schedule could not be saved.",
				);
			}
			router.push("/calendar");
			router.refresh();
		} catch (cause) {
			setError(
				cause instanceof Error
					? cause.message
					: "Your schedule could not be saved.",
			);
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<form
			onSubmit={submit}
			className="ocean-shell overflow-hidden rounded-xl border"
		>
			<section className="border-b border-border p-5 md:p-6">
				<div className="mb-5 flex items-start gap-3">
					<div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
						<GraduationCap className="size-5" />
					</div>
					<div>
						<h2 className="font-semibold text-foreground">School schedule</h2>
						<p className="text-sm text-muted-foreground">
							Choose your regular class days and hours.
						</p>
					</div>
				</div>

				<fieldset className="grid grid-cols-4 gap-2 sm:grid-cols-7">
					<legend className="sr-only">School days</legend>
					{weekdays.map((day) => {
						const selected = schoolDays.includes(day.value);
						return (
							<button
								key={day.value}
								type="button"
								aria-label={day.label}
								aria-pressed={selected}
								onClick={() => toggleSchoolDay(day.value)}
								className={`h-10 rounded-md border text-sm font-medium transition-colors ${
									selected
										? "border-primary bg-primary text-primary-foreground"
										: "border-border bg-card text-foreground hover:bg-accent"
								}`}
							>
								{day.short}
							</button>
						);
					})}
				</fieldset>

				<div className="mt-5 grid gap-4 sm:grid-cols-2">
					<div className="grid gap-2">
						<Label htmlFor="school-start">School starts</Label>
						<Input
							id="school-start"
							type="time"
							value={schoolStartTime}
							onChange={(event) => setSchoolStartTime(event.target.value)}
							required
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="school-end">School ends</Label>
						<Input
							id="school-end"
							type="time"
							value={schoolEndTime}
							onChange={(event) => setSchoolEndTime(event.target.value)}
							required
						/>
					</div>
				</div>
			</section>

			<section className="p-5 md:p-6">
				<div className="mb-5 flex items-start gap-3">
					<div className="flex size-9 shrink-0 items-center justify-center rounded-md reef-studying">
						<Moon className="size-5" />
					</div>
					<div>
						<h2 className="font-semibold text-foreground">Sleep schedule</h2>
						<p className="text-sm text-muted-foreground">
							Tasks will stay outside these protected hours.
						</p>
					</div>
				</div>

				<div className="grid gap-4 sm:grid-cols-2">
					<div className="grid gap-2">
						<Label htmlFor="sleep-time">Go to sleep</Label>
						<Input
							id="sleep-time"
							type="time"
							value={sleepTime}
							onChange={(event) => setSleepTime(event.target.value)}
							required
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="wake-time">Wake up</Label>
						<Input
							id="wake-time"
							type="time"
							value={wakeTime}
							onChange={(event) => setWakeTime(event.target.value)}
							required
						/>
					</div>
				</div>
				<p className="mt-4 text-xs text-muted-foreground">Timezone: {timezone}</p>
			</section>

			<footer className="flex flex-col gap-3 border-t border-border bg-secondary p-4 sm:flex-row sm:items-center sm:justify-between">
				{error ? (
					<p className="text-sm text-red-700" role="alert">
						{error}
					</p>
				) : (
					<span />
				)}
				<Button type="submit" disabled={submitting} className="sm:min-w-40">
					{submitting ? "Creating schedule..." : "Create my schedule"}
					<ArrowRight />
				</Button>
			</footer>
		</form>
	);
}
