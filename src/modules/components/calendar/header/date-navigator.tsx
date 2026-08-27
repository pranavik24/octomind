import { formatDate } from "date-fns";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	buttonHover,
	transition,
} from "@/modules/components/calendar/animations";
import { useCalendar } from "@/modules/components/calendar/contexts/calendar-context";

import {
	getEventsCount,
	navigateDate,
	rangeText,
} from "@/modules/components/calendar/helpers";

import type { IEvent } from "@/modules/components/calendar/interfaces";
import type { TCalendarView } from "@/modules/components/calendar/types";

interface IProps {
	view: TCalendarView;
	events: IEvent[];
}

const MotionButton = motion.create(Button);
const MotionBadge = motion.create(Badge);

export function DateNavigator({ view, events }: IProps) {
	const { selectedDate, setSelectedDate } = useCalendar();

	const month = formatDate(selectedDate, "MMMM");
	const year = selectedDate.getFullYear();

	const eventCount = useMemo(
		() => getEventsCount(events, selectedDate, view),
		[events, selectedDate, view],
	);

	const handlePrevious = () =>
		setSelectedDate(navigateDate(selectedDate, view, "previous"));
	const handleNext = () =>
		setSelectedDate(navigateDate(selectedDate, view, "next"));

	return (
		<div className="space-y-0.5">
			<div className="flex items-center gap-2">
				<motion.span
					className="text-lg font-semibold text-foreground"
					initial={{ x: -20, opacity: 0 }}
					animate={{ x: 0, opacity: 1 }}
					transition={transition}
				>
					{month} {year}
				</motion.span>
				<AnimatePresence mode="wait">
					<MotionBadge
						key={eventCount}
						variant="secondary"
						initial={{ scale: 0.8, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						exit={{ scale: 0.8, opacity: 0 }}
						transition={transition}
					>
						{eventCount} events
					</MotionBadge>
				</AnimatePresence>
			</div>

			<div className="flex items-center gap-2">
				<MotionButton
					variant="outline"
					size="icon"
					className="h-7 w-7 border-border bg-card text-foreground hover:bg-accent"
					onClick={handlePrevious}
					variants={buttonHover}
					whileHover="hover"
					whileTap="tap"
				>
					<ChevronLeft className="h-4 w-4" />
				</MotionButton>

				<motion.p
					className="text-sm text-muted-foreground"
					initial={{ opacity: 0 }}
					animate={{ opacity: 1 }}
					transition={transition}
				>
					{rangeText(view, selectedDate)}
				</motion.p>

				<MotionButton
					variant="outline"
					size="icon"
					className="h-7 w-7 border-border bg-card text-foreground hover:bg-accent"
					onClick={handleNext}
					variants={buttonHover}
					whileHover="hover"
					whileTap="tap"
				>
					<ChevronRight className="h-4 w-4" />
				</MotionButton>
			</div>
		</div>
	);
}
