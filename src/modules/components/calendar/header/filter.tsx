import { CheckIcon, Filter, RefreshCcw } from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Toggle } from "@/components/ui/toggle";
import { COLORS } from "@/modules/components/calendar/constants";
import { useCalendar } from "@/modules/components/calendar/contexts/calendar-context";
import type { TEventColor } from "@/modules/components/calendar/types";
import { EventBullet } from "@/modules/components/calendar/views/month-view/event-bullet";

export default function FilterEvents() {
	const { selectedColors, filterEventsBySelectedColors, clearFilter } =
		useCalendar();

	const colors: TEventColor[] = COLORS;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Toggle
					variant="outline"
					className="w-fit cursor-pointer border-border bg-card hover:bg-accent"
					aria-label="Filter calendar by category"
					title="Filter calendar by category"
				>
					<Filter className="h-4 w-4" />
					<span>Filter</span>
				</Toggle>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-[180px]">
				{colors.map((color, index) => (
					<DropdownMenuItem
						key={index}
						className="flex items-center gap-2 cursor-pointer"
						onClick={(e) => {
							e.preventDefault();
							filterEventsBySelectedColors(color);
						}}
					>
						<EventBullet color={color} />
						<span className="flex justify-center items-center gap-2">
							{color}
							<span>
								{selectedColors.includes(color) && (
									<span className="text-primary">
										<CheckIcon className="size-4" />
									</span>
								)}
							</span>
						</span>
					</DropdownMenuItem>
				))}
				<Separator className="my-2" />
				<DropdownMenuItem
					disabled={selectedColors.length === 0}
					className="flex gap-2 cursor-pointer"
					onClick={(e) => {
						e.preventDefault();
						clearFilter();
					}}
				>
					<RefreshCcw className="size-3.5" />
					Clear Filter
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
