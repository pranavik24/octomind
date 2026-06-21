"use client";

import { motion } from "framer-motion";
import { Plug, Plus } from "lucide-react";
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
		<div className="flex flex-col gap-4 border-b p-4 lg:flex-row lg:items-center lg:justify-between">
			<motion.div
				className="flex items-center gap-3"
				variants={slideFromLeft}
				initial="initial"
				animate="animate"
				transition={transition}
			>
				<TodayButton />
				<DateNavigator view={view} events={events} />
			</motion.div>

			<motion.div
				className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-1.5"
				variants={slideFromRight}
				initial="initial"
				animate="animate"
				transition={transition}
			>
				<div className="options flex-wrap flex items-center gap-4 md:gap-2">
					<FilterEvents />
					<Views />
				</div>

				<div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-1.5">
					{persistenceEnabled ? (
						<Button variant="outline" asChild>
							<Link href="/settings/integrations">
								<Plug className="size-4" />
								Integrations
							</Link>
						</Button>
					) : null}
					<AddEditEventDialog>
						<Button>
							<Plus className="h-4 w-4" />
							Add Event
						</Button>
					</AddEditEventDialog>

					<AddEditTaskDialog>
						<Button>
							<Plus className="h-4 w-4" />
							Add Task
						</Button>
					</AddEditTaskDialog>
				</div>
				<Settings />
			</motion.div>
		</div>
	);
}
