"use client";

import { format, parseISO } from "date-fns";
import { Calendar, Clock, Tag, Text } from "lucide-react";
import type { ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCalendar } from "@/modules/components/calendar/contexts/calendar-context";
import {
	AddEditEventDialog,
	AddEditTaskDialog,
} from "@/modules/components/calendar/dialogs/add-edit-event-dialog";
import { formatTime } from "@/modules/components/calendar/helpers";
import type { IEvent } from "@/modules/components/calendar/interfaces";

interface IProps {
	event: IEvent;
	children: ReactNode;
}

export function EventDetailsDialog({ event, children }: IProps) {
	const startDate = parseISO(event.startDate);
	const endDate = parseISO(event.endDate);
	const { use24HourFormat, removeEvent, removeTask, tasks } = useCalendar();
	const taskId = event.taskId ?? event.id;
	const relatedTask = tasks.find((task) => task.id === taskId);
	const isTask = !!relatedTask;

	const deleteEvent = (eventId: number) => {
		try {
			if (isTask) {
				removeTask(taskId);
				toast.success("Task deleted successfully.");
			} else {
				removeEvent(eventId);
				toast.success("Event deleted successfully.");
			}
		} catch {
			toast.error("Error deleting event.");
		}
	};

	return (
		<Dialog>
			<DialogTrigger asChild>{children}</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{event.title}</DialogTitle>
				</DialogHeader>

				<ScrollArea className="max-h-[80vh]">
					<div className="space-y-4 p-4">
						<div className="flex items-start gap-2">
							<Calendar className="mt-1 size-4 shrink-0 text-muted-foreground" />
							<div>
								<p className="text-sm font-medium">Start Date</p>
								<p className="text-sm text-muted-foreground">
									{format(startDate, "EEEE dd MMMM")}
									<span className="mx-1">at</span>
									{formatTime(parseISO(event.startDate), use24HourFormat)}
								</p>
							</div>
						</div>

						<div className="flex items-start gap-2">
							<Clock className="mt-1 size-4 shrink-0 text-muted-foreground" />
							<div>
								<p className="text-sm font-medium">End Date</p>
								<p className="text-sm text-muted-foreground">
									{format(endDate, "EEEE dd MMMM")}
									<span className="mx-1">at</span>
									{formatTime(parseISO(event.endDate), use24HourFormat)}
								</p>
							</div>
						</div>

						<div className="flex items-start gap-2">
							<Text className="mt-1 size-4 shrink-0 text-muted-foreground" />
							<div>
								<p className="text-sm font-medium">Description</p>
								<p className="text-sm text-muted-foreground">
									{event.description}
								</p>
							</div>
						</div>

						<div className="flex items-start gap-2">
							<Tag className="mt-1 size-4 shrink-0 text-muted-foreground" />
							<div>
								<p className="text-sm font-medium">Category</p>
								<p className="text-sm text-muted-foreground">{event.color}</p>
							</div>
						</div>
					</div>
				</ScrollArea>
				<div className="flex justify-end gap-2">
					{isTask ? (
						<AddEditTaskDialog task={relatedTask}>
							<Button variant="outline">Edit</Button>
						</AddEditTaskDialog>
					) : (
						<AddEditEventDialog event={event}>
							<Button variant="outline">Edit</Button>
						</AddEditEventDialog>
					)}
					<Button
						variant="destructive"
						onClick={() => {
							deleteEvent(event.id);
						}}
					>
						Delete
					</Button>
				</div>
				<DialogClose />
			</DialogContent>
		</Dialog>
	);
}
