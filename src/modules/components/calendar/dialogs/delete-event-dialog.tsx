import { TrashIcon } from "lucide-react";
import { toast } from "sonner";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useCalendar } from "@/modules/components/calendar/contexts/calendar-context";

interface DeleteEventDialogProps {
	eventId: string;
}

export default function DeleteEventDialog({ eventId }: DeleteEventDialogProps) {
	const { removeEvent, removeTask, tasks } = useCalendar();

	const handleDelete = async () => {
		// Treat only null/undefined as missing — allow id 0 to be valid
		if (eventId == null) return;

		// Prefer deleting a task if the id exists in tasks, otherwise delete an event.
		const isTask = tasks.some((t) => t.id === eventId);
		try {
			if (isTask) {
				await removeTask(eventId);
				toast.success("Task deleted successfully.");
			} else {
				await removeEvent(eventId);
				toast.success("Event deleted successfully.");
			}
		} catch (err) {
			console.error("Error deleting item:", err);
			toast.error("Error deleting item.");
		}
	};

	// Allow id=0 — only bail out when eventId is null or undefined
	if (eventId == null) {
		return null;
	}

	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>
				<Button variant="destructive">
					<TrashIcon />
					Delete
				</Button>
			</AlertDialogTrigger>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
					<AlertDialogDescription>
						This action cannot be undone. This will permanently delete your
						event and remove event data from our servers.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel>Cancel</AlertDialogCancel>
					<AlertDialogAction onClick={() => void handleDelete()}>
						Continue
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
