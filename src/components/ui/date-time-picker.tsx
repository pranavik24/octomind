import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type {
	ControllerRenderProps,
	FieldValues,
	UseFormReturn,
} from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	FormControl,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useCalendar } from "@/modules/components/calendar/contexts/calendar-context";
import { mergeDatePreservingTime } from "@/modules/components/calendar/date-time-utils";

interface DatePickerProps<TFieldValues extends FieldValues = FieldValues> {
	// accept a flexible form/field types to support both events (start/end) and tasks (dueDate)
	form: UseFormReturn<TFieldValues>;
	field: ControllerRenderProps<TFieldValues>;
}

export function DateTimePicker<TFieldValues extends FieldValues = FieldValues>({
	form,
	field,
}: DatePickerProps<TFieldValues>) {
	const { use24HourFormat } = useCalendar();
	const fieldValue = field.value as unknown;
	const selectedDate = fieldValue instanceof Date ? fieldValue : undefined;
	const selectedHour = selectedDate ? selectedDate.getHours() : undefined;
	const selectedAmPm = selectedHour !== undefined && selectedHour >= 12 ? "PM" : "AM";

	function handleDateSelect(date: Date | undefined) {
		if (date) {
			const currentValue = form.getValues(field.name) as unknown;
			form.setValue(
				field.name,
				mergeDatePreservingTime(
					date,
					currentValue instanceof Date ? currentValue : undefined,
				) as never,
			);
		}
	}

	function handleTimeChange(type: "hour" | "minute" | "ampm", value: string) {
		const currentValue = form.getValues(field.name) as unknown;
		const currentDate = currentValue instanceof Date ? currentValue : new Date();
		const newDate = new Date(currentDate);

		if (type === "hour") {
			const parsedHour = parseInt(value, 10);
			if (use24HourFormat) {
				newDate.setHours(parsedHour);
			} else {
				const currentHours = newDate.getHours();
				const isPM = currentHours >= 12;
				const normalizedHour = parsedHour % 12;
				newDate.setHours(normalizedHour + (isPM ? 12 : 0));
			}
		} else if (type === "minute") {
			newDate.setMinutes(parseInt(value, 10));
		} else if (type === "ampm") {
			const hours = newDate.getHours();
			if (value === "AM" && hours >= 12) {
				newDate.setHours(hours - 12);
			} else if (value === "PM" && hours < 12) {
				newDate.setHours(hours + 12);
			}
		}

		form.setValue(field.name, newDate as never);
	}

	return (
		<FormItem className="flex flex-col">
			<FormLabel>
				{field.name === "startDate" ? "Start Date" : (field.name === "dueDate" ? "Due Date" : "End Date")}
		</FormLabel>
			<Popover modal={true}>
				<PopoverTrigger asChild>
					<FormControl>
						<Button
							variant={"outline"}
							className={cn(
								"w-full pl-3 text-left font-normal",
								!selectedDate && "text-muted-foreground",
							)}
						>
							{selectedDate ? (
								format(
									selectedDate,
									use24HourFormat ? "MM/dd/yyyy HH:mm" : "MM/dd/yyyy hh:mm aa",
								)
							) : (
								<span>
									{use24HourFormat
										? "MM/DD/YYYY HH:mm"
										: "MM/DD/YYYY hh:mm aa"}
								</span>
							)}
							<CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
						</Button>
					</FormControl>
				</PopoverTrigger>
				<PopoverContent className="w-auto p-0">
					<div className="sm:flex">
						<Calendar
							mode="single"
							selected={selectedDate}
							onSelect={handleDateSelect}
							initialFocus
						/>
						<div className="flex flex-col sm:flex-row sm:h-[300px] divide-y sm:divide-y-0 sm:divide-x">
							<ScrollArea className="w-64 sm:w-auto">
								<div className="flex sm:flex-col p-2">
									{(use24HourFormat
										? Array.from({ length: 24 }, (_, i) => i)
										: [12, ...Array.from({ length: 11 }, (_, i) => i + 1)]
									).map((hour) => (
										<Button
											key={hour}
											size="icon"
											variant={
												selectedDate &&
												(use24HourFormat
													? selectedDate.getHours() === hour
													: ((selectedDate.getHours() % 12) || 12) === hour)
													? "default"
													: "ghost"
											}
											className="sm:w-full shrink-0 aspect-square"
											onClick={() => handleTimeChange("hour", hour.toString())}
										>
											{use24HourFormat
												? hour.toString().padStart(2, "0")
												: hour.toString()}
										</Button>
									))}
								</div>
								<ScrollBar orientation="horizontal" className="sm:hidden" />
							</ScrollArea>
							<ScrollArea className="w-64 sm:w-auto">
								<div className="flex sm:flex-col p-2">
									{Array.from({ length: 12 }, (_, i) => i * 5).map((minute) => (
										<Button
											key={minute}
											size="icon"
											variant={
												selectedDate && selectedDate.getMinutes() === minute
													? "default"
													: "ghost"
											}
											className="sm:w-full shrink-0 aspect-square"
											onClick={() =>
												handleTimeChange("minute", minute.toString())
											}
										>
											{minute.toString().padStart(2, "0")}
										</Button>
									))}
								</div>
								<ScrollBar orientation="horizontal" className="sm:hidden" />
							</ScrollArea>
							{!use24HourFormat ? (
								<ScrollArea className="w-64 sm:w-auto">
									<div className="flex sm:flex-col p-2">
										{["AM", "PM"].map((meridiem) => (
											<Button
												key={meridiem}
												size="icon"
												variant={
													selectedDate && selectedAmPm === meridiem
														? "default"
														: "ghost"
												}
												className="sm:w-full shrink-0 aspect-square"
												onClick={() => handleTimeChange("ampm", meridiem)}
											>
												{meridiem}
											</Button>
										))}
									</div>
									<ScrollBar orientation="horizontal" className="sm:hidden" />
								</ScrollArea>
							) : null}
						</div>
					</div>
				</PopoverContent>
			</Popover>
			<FormMessage />
		</FormItem>
	);
}
