import type { VariantProps } from "class-variance-authority";
import { cva } from "class-variance-authority";
import { endOfDay, isSameDay, parseISO, startOfDay } from "date-fns";
import { cn } from "@/lib/utils";
import { useCalendar } from "@/modules/components/calendar/contexts/calendar-context";
import { EventDetailsDialog } from "@/modules/components/calendar/dialogs/event-details-dialog";
import { DraggableEvent } from "@/modules/components/calendar/dnd/draggable-event";
import { formatTime } from "@/modules/components/calendar/helpers";
import type { IEvent } from "@/modules/components/calendar/interfaces";
import { EventBullet } from "@/modules/components/calendar/views/month-view/event-bullet";

const eventBadgeVariants = cva(
	"reef-chip mx-1 flex size-auto h-5 select-none items-center justify-between gap-1 truncate whitespace-nowrap rounded-md border px-1.5 text-xs shadow-[0_1px_0_var(--coast-shadow)]",
	{
		variants: {
			color: {
				School: "reef-school",
				Extracurriculars: "reef-extracurriculars",
				Other: "reef-other",
				Homework: "reef-homework",
				Studying: "reef-studying",
				Work: "reef-work",
				"School-dot": "border-border bg-card text-foreground [&_svg]:fill-[var(--reef-school-border)]",
				"Extracurriculars-dot":
					"border-border bg-card text-foreground [&_svg]:fill-[var(--reef-extracurriculars-border)]",
				"Other-dot": "border-border bg-card text-foreground [&_svg]:fill-[var(--reef-other-border)]",
				"Work-dot": "border-border bg-card text-foreground [&_svg]:fill-[var(--reef-work-border)]",
				"Studying-dot": "border-border bg-card text-foreground [&_svg]:fill-[var(--reef-studying-border)]",
				"Homework-dot": "border-border bg-card text-foreground [&_svg]:fill-[var(--reef-homework-border)]",
			},
			multiDayPosition: {
				first:
					"relative z-10 mr-0 rounded-r-none border-r-0 [&>span]:mr-2.5",
				middle:
					"relative z-10 mx-0 w-[calc(100%_+_1px)] rounded-none border-x-0",
				last: "ml-0 rounded-l-none border-l-0",
				none: "",
			},
		},
		defaultVariants: {
			color: "Other-dot",
		},
	},
);

interface IProps
	extends Omit<
		VariantProps<typeof eventBadgeVariants>,
		"color" | "multiDayPosition"
	> {
	event: IEvent;
	cellDate: Date;
	eventCurrentDay?: number;
	eventTotalDays?: number;
	className?: string;
	position?: "first" | "middle" | "last" | "none";
}

export function MonthEventBadge({
	event,
	cellDate,
	eventCurrentDay,
	eventTotalDays,
	className,
	position: propPosition,
}: IProps) {
	const { badgeVariant, use24HourFormat } = useCalendar();

	const itemStart = startOfDay(parseISO(event.startDate));
	const itemEnd = endOfDay(parseISO(event.endDate));

	if (cellDate < itemStart || cellDate > itemEnd) return null;

	let position: "first" | "middle" | "last" | "none" | undefined;

	if (propPosition) {
		position = propPosition;
	} else if (eventCurrentDay && eventTotalDays) {
		position = "none";
	} else if (isSameDay(itemStart, itemEnd)) {
		position = "none";
	} else if (isSameDay(cellDate, itemStart)) {
		position = "first";
	} else if (isSameDay(cellDate, itemEnd)) {
		position = "last";
	} else {
		position = "middle";
	}

	const renderBadgeText = ["first", "none"].includes(position) ;
	const renderBadgeTime =  ["last", "none"].includes(position);

	const color = (
		badgeVariant === "dot" ? `${event.color}-dot` : event.color
	) as VariantProps<typeof eventBadgeVariants>["color"];

	const eventBadgeClasses = cn(
		eventBadgeVariants({ color, multiDayPosition: position, className }),
	);

	return (
		<DraggableEvent event={event}>
			<EventDetailsDialog event={event}>
				<div role="button" tabIndex={0} className={eventBadgeClasses}>
					<div className="flex items-center gap-1.5 truncate">
						{!["middle", "last"].includes(position) &&
							badgeVariant === "dot" && (
								<EventBullet color={event.color} />
							)}

						{renderBadgeText && (
							<p className="flex-1 truncate font-semibold">
								{eventCurrentDay && (
									<span className="text-xs">
										Day {eventCurrentDay} of {eventTotalDays} •{" "}
									</span>
								)}
								{event.title}
							</p>
						)}
					</div>

					<div className="hidden sm:block">
						{renderBadgeTime && (
							<span>
							{formatTime(new Date(event.startDate), use24HourFormat)}
						</span>
						)}
					</div>
				</div>
			</EventDetailsDialog>
		</DraggableEvent>
	);
}
