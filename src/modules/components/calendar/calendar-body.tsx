"use client";

import { isSameDay, parseISO } from "date-fns";
import { motion } from "framer-motion";
import { CalendarPlus, ClipboardList, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { fadeIn, transition } from "@/modules/components/calendar/animations";
import { useCalendar } from "@/modules/components/calendar/contexts/calendar-context";
import {
	AddEditEventDialog,
	AddEditTaskDialog,
} from "@/modules/components/calendar/dialogs/add-edit-event-dialog";
import { CalendarMonthView } from "@/modules/components/calendar/views/month-view/calendar-month-view";
import { CalendarDayView } from "@/modules/components/calendar/views/week-and-day-view/calendar-day-view";
import { CalendarWeekView } from "@/modules/components/calendar/views/week-and-day-view/calendar-week-view";
import { CalendarYearView } from "@/modules/components/calendar/views/year-view/calendar-year-view";

export function CalendarBody() {
	const { view, events, tasks } = useCalendar();

	const singleDayEvents = events.filter((event) => {
		const startDate = parseISO(event.startDate);
		const endDate = parseISO(event.endDate);
		return isSameDay(startDate, endDate);
	});

	const multiDayEvents = events.filter((event) => {
		const startDate = parseISO(event.startDate);
		const endDate = parseISO(event.endDate);
		return !isSameDay(startDate, endDate);
	});
	const isEmptyCalendar = events.length === 0 && tasks.length === 0;

	return (
		<div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
			{isEmptyCalendar ? (
				<div className="flex flex-col gap-3 border-b border-border bg-card px-4 py-4 md:flex-row md:items-center md:justify-between">
					<div className="flex items-start gap-3">
						<div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-accent-foreground">
							<ClipboardList className="size-4" />
						</div>
						<div className="min-w-0">
							<h2 className="text-sm font-semibold text-foreground">
								Start by adding homework
							</h2>
							<p className="mt-1 max-w-2xl text-sm text-muted-foreground">
								Add a task with a due date and time estimate. Octomind will plan
								work time around classes, events, and sleep.
							</p>
						</div>
					</div>
					<div className="flex flex-wrap gap-2">
						<AddEditTaskDialog>
							<Button>
								<Plus className="size-4" />
								Add Homework
							</Button>
						</AddEditTaskDialog>
						<AddEditEventDialog>
							<Button variant="outline">
								<CalendarPlus className="size-4" />
								Add Event
							</Button>
						</AddEditEventDialog>
					</div>
				</div>
			) : null}
			<motion.div
				key={view}
				className={cn(
					"min-h-0 flex-1",
					(view === "month" || view === "year") && "overflow-y-auto",
				)}
				initial="initial"
				animate="animate"
				exit="exit"
				variants={fadeIn}
				transition={transition}
			>
				{view === "month" && (
					<CalendarMonthView
						singleDayEvents={singleDayEvents}
						multiDayEvents={multiDayEvents}
					/>
				)}
				{view === "week" && (
					<CalendarWeekView
						singleDayEvents={singleDayEvents}
						multiDayEvents={multiDayEvents}
					/>
				)}
				{view === "day" && (
					<CalendarDayView
						singleDayEvents={singleDayEvents}
						multiDayEvents={multiDayEvents}
					/>
				)}
				{view === "year" && (
					<CalendarYearView
						singleDayEvents={singleDayEvents}
						multiDayEvents={multiDayEvents}
					/>
				)}
			</motion.div>
		</div>
	);
}
