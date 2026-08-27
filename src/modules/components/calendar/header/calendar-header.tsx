"use client";

import { motion } from "framer-motion";
import { CalendarPlus, Plug, Plus } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
	slideFromLeft,
	slideFromRight,
	transition,
} from "@/modules/components/calendar/animations";
import { useCalendar } from "@/modules/components/calendar/contexts/calendar-context";
import {
	AddEditEventDialog,
	AddEditTaskDialog,
} from "@/modules/components/calendar/dialogs/add-edit-event-dialog";
import { DateNavigator } from "@/modules/components/calendar/header/date-navigator";
import FilterEvents from "@/modules/components/calendar/header/filter";
import { TodayButton } from "@/modules/components/calendar/header/today-button";
import { Settings } from "@/modules/components/calendar/settings/settings";
import Views from "./view-tabs";

export function CalendarHeader() {
	const { view, events, persistenceEnabled } = useCalendar();

	return (
		<div className="tide-panel flex shrink-0 flex-col gap-2 border-b p-3">
			<motion.div
				className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between"
				variants={slideFromLeft}
				initial="initial"
				animate="animate"
				transition={transition}
			>
				<div className="flex flex-wrap items-center gap-2">
					<TodayButton />
					<DateNavigator view={view} events={events} />
				</div>

				<div className="flex flex-wrap items-center gap-2">
					{persistenceEnabled ? (
						<Button variant="outline" asChild>
							<Link href="/settings/integrations">
								<Plug className="size-4" />
								Integrations
							</Link>
						</Button>
					) : null}
					<AddEditTaskDialog>
						<Button>
							<Plus className="h-4 w-4" />
							Add Homework
						</Button>
					</AddEditTaskDialog>
					<AddEditEventDialog>
						<Button variant="outline">
							<CalendarPlus className="h-4 w-4" />
							Add Event
						</Button>
					</AddEditEventDialog>
					<FilterEvents />
					<Settings />
				</div>
			</motion.div>

			<motion.div
				className="flex min-w-0"
				variants={slideFromRight}
				initial="initial"
				animate="animate"
				transition={transition}
			>
				<Views />
			</motion.div>
		</div>
	);
}
