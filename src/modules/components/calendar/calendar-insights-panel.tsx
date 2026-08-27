"use client";

import {
	addDays,
	format,
	isSameDay,
	isWithinInterval,
	parseISO,
} from "date-fns";
import {
	AlertTriangle,
	CalendarCheck2,
	CheckCircle2,
	Clock3,
	ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useCalendar } from "@/modules/components/calendar/contexts/calendar-context";
import type { IEvent, ITask } from "@/modules/components/calendar/interfaces";
import { EventBullet } from "@/modules/components/calendar/views/month-view/event-bullet";

function todayEvents(events: IEvent[]) {
	const now = new Date();
	return events
		.filter((event) => isSameDay(parseISO(event.startDate), now))
		.sort(
			(left, right) =>
				parseISO(left.startDate).getTime() -
				parseISO(right.startDate).getTime(),
		)
		.slice(0, 4);
}

function upcomingTasks(tasks: ITask[]) {
	const now = new Date();
	const dueWindow = { start: now, end: addDays(now, 7) };

	return [...tasks]
		.filter((task) => isWithinInterval(parseISO(task.dueDate), dueWindow))
		.sort(
			(left, right) =>
				parseISO(left.dueDate).getTime() - parseISO(right.dueDate).getTime(),
		)
		.slice(0, 4);
}

function taskScheduleLabel(task: ITask) {
	if (task.scheduleStatus?.state === "failed") {
		return "Needs attention";
	}

	const nextBlock = task.scheduledBlocks?.[0];
	if (nextBlock) {
		return `Planned ${format(parseISO(nextBlock.startDate), "EEE h:mm a")}`;
	}

	return `Due ${format(parseISO(task.dueDate), "MMM d")}`;
}

export function CalendarInsightsPanel() {
	const { events, tasks } = useCalendar();
	const actualEvents = events.filter((event) => !event.taskId);
	const visibleEvents = todayEvents(actualEvents);
	const todayAgenda = todayEvents(events);
	const visibleTasks = upcomingTasks(tasks);
	const scheduledTaskCount = tasks.filter(
		(task) => task.scheduleStatus?.state === "scheduled",
	).length;
	const attentionTaskCount = tasks.filter(
		(task) => task.scheduleStatus?.state === "failed",
	).length;

	return (
		<aside className="tide-panel hidden min-w-0 flex-col gap-4 overflow-hidden rounded-xl border p-3 xl:flex xl:w-72 xl:shrink-0">
			<div className="flex items-start justify-between gap-3">
				<div>
					<h2 className="text-base font-semibold text-foreground">
						Today&apos;s agenda
					</h2>
					<p className="mt-1 text-sm text-muted-foreground">
						Homework, events, and deadline checks for the next few days.
					</p>
				</div>
				<div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
					<CalendarCheck2 className="size-4" />
				</div>
			</div>

			<div className="grid grid-cols-3 gap-2">
				<div className="rounded-lg border border-border bg-card p-3">
					<p className="text-xs font-medium text-muted-foreground">Events</p>
					<p className="mt-1 text-2xl font-semibold text-foreground">
						{visibleEvents.length}
					</p>
				</div>
				<div className="rounded-lg border border-border bg-card p-3">
					<p className="text-xs font-medium text-muted-foreground">Planned</p>
					<p className="mt-1 text-2xl font-semibold text-foreground">
						{scheduledTaskCount}
					</p>
				</div>
				<div className="rounded-lg border border-border bg-card p-3">
					<p className="text-xs font-medium text-muted-foreground">Check</p>
					<p className="mt-1 text-2xl font-semibold text-foreground">
						{attentionTaskCount}
					</p>
				</div>
			</div>

			<section>
				<div className="mb-2 flex items-center justify-between gap-2">
					<h3 className="text-sm font-semibold text-foreground">Due soon</h3>
					<Badge variant="secondary">Due soon</Badge>
				</div>
				{visibleTasks.length > 0 ? (
					<div className="space-y-2">
						{visibleTasks.map((task) => (
							<div
								key={task.id}
								className={cn(
									"reef-chip flex items-start gap-2 rounded-lg border p-2.5",
									{
										"reef-school": task.color === "School",
										"reef-homework": task.color === "Homework",
										"reef-studying": task.color === "Studying",
										"reef-extracurriculars": task.color === "Extracurriculars",
										"reef-work": task.color === "Work",
										"reef-other": task.color === "Other",
									},
								)}
							>
								<EventBullet color={task.color} className="mt-1.5 shrink-0" />
								<div className="min-w-0 flex-1">
									<div className="flex items-start justify-between gap-2">
										<p className="truncate text-sm font-semibold">
											{task.title}
										</p>
										{task.scheduleStatus?.state === "failed" ? (
											<AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
										) : (
											<CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
										)}
									</div>
									<p className="mt-0.5 text-xs opacity-80">
										{taskScheduleLabel(task)}
									</p>
								</div>
							</div>
						))}
					</div>
				) : (
					<p className="rounded-lg border border-dashed border-border bg-card p-3 text-sm text-muted-foreground">
						No homework is due soon. Add homework when a new deadline comes in.
					</p>
				)}
			</section>

			<section>
				<h3 className="mb-2 text-sm font-semibold text-foreground">
					Today&apos;s agenda
				</h3>
				{todayAgenda.length > 0 ? (
					<div className="space-y-2">
						{todayAgenda.map((event) => (
							<div
								key={event.id}
								className="flex items-start gap-2 rounded-lg border border-border bg-card p-2.5"
							>
								<EventBullet color={event.color} className="mt-1.5 shrink-0" />
								<div className="min-w-0">
									<p className="truncate text-sm font-medium text-foreground">
										{event.title}
									</p>
									<p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
										<Clock3 className="size-3" />
										{format(parseISO(event.startDate), "h:mm a")}
									</p>
								</div>
							</div>
						))}
					</div>
				) : (
					<p className="rounded-lg border border-dashed border-border bg-card p-3 text-sm text-muted-foreground">
						No events today. Homework can use open time around school and sleep.
					</p>
				)}
			</section>

			<div className="mt-auto flex items-start gap-2 rounded-lg bg-accent p-3 text-sm text-accent-foreground">
				<ShieldCheck className="mt-0.5 size-4 shrink-0" />
				<p>
					Homework is checked against classes, events, and protected sleep
					before it appears on the calendar.
				</p>
			</div>
		</aside>
	);
}
