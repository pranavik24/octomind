import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import { differenceInMinutes, parseISO } from "date-fns";
import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { useCalendar } from "@/modules/components/calendar/contexts/calendar-context";
import { EventDetailsDialog } from "@/modules/components/calendar/dialogs/event-details-dialog";
import { DraggableEvent } from "@/modules/components/calendar/dnd/draggable-event";
import { ResizableEvent } from "@/modules/components/calendar/dnd/resizable-event";
import { formatTime } from "@/modules/components/calendar/helpers";
import type { IEvent } from "@/modules/components/calendar/interfaces";

const calendarWeekEventCardVariants = cva(
	"reef-chip flex select-none flex-col gap-0.5 truncate whitespace-nowrap rounded-md border px-2 py-1.5 text-xs shadow-[0_1px_0_var(--coast-shadow)] focus-visible:outline-offset-2",
	{
		variants: {
			color: {
				School: "reef-school",
				Extracurriculars: "reef-extracurriculars",
				Other: "reef-other",
				Homework: "reef-homework",
				Studying: "reef-studying",
				Work: "reef-work",
				"School-dot": "border-border bg-card text-foreground hover:bg-accent [&_svg]:fill-[var(--reef-school-border)]",
				"Extracurriculars-dot":
					"border-border bg-card text-foreground hover:bg-accent [&_svg]:fill-[var(--reef-extracurriculars-border)]",
				"Other-dot": "border-border bg-card text-foreground hover:bg-accent [&_svg]:fill-[var(--reef-other-border)]",
				"Work-dot": "border-border bg-card text-foreground hover:bg-accent [&_svg]:fill-[var(--reef-work-border)]",
				"Studying-dot": "border-border bg-card text-foreground hover:bg-accent [&_svg]:fill-[var(--reef-studying-border)]",
				"Homework-dot": "border-border bg-card text-foreground hover:bg-accent [&_svg]:fill-[var(--reef-homework-border)]",
			},
		},
		defaultVariants: {
			color: "Other-dot",
		},
	},
);

interface IProps
	extends HTMLAttributes<HTMLDivElement>,
		Omit<VariantProps<typeof calendarWeekEventCardVariants>, "color"> {
	event: IEvent;
}

export function EventBlock({ event, className }: IProps) {
	const { badgeVariant, use24HourFormat } = useCalendar();

	const start = parseISO(event.startDate);
	const end = parseISO(event.endDate);
	const durationInMinutes = differenceInMinutes(end, start);
	const heightInPixels = (durationInMinutes / 60) * 96 - 8;

	const color = (
		badgeVariant === "dot" ? `${event.color}-dot` : event.color
	) as VariantProps<typeof calendarWeekEventCardVariants>["color"];

	const calendarWeekEventCardClasses = cn(
		calendarWeekEventCardVariants({ color, className }),
		durationInMinutes < 35 && "py-0 justify-center",
	);

	return (
		<ResizableEvent event={event}>
			<DraggableEvent event={event}>
				<EventDetailsDialog event={event}>
					<div
						role="button"
						tabIndex={0}
						className={calendarWeekEventCardClasses}
						style={{ height: `${heightInPixels}px` }}
					>
						<div className="flex items-center gap-1.5 truncate">
							{badgeVariant === "dot" && (
								<svg
									width="8"
									height="8"
									viewBox="0 0 8 8"
									className="shrink-0"
								>
									<circle cx="4" cy="4" r="4" />
								</svg>
							)}

							<p className="truncate font-semibold">{event.title}</p>
						</div>

						{durationInMinutes > 25 && (
							<p>
								{formatTime(start, use24HourFormat)} -{" "}
								{formatTime(end, use24HourFormat)}
							</p>
						)}
					</div>
				</EventDetailsDialog>
			</DraggableEvent>
		</ResizableEvent>
	);
}
