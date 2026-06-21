import { CalendarBody } from "@/modules/components/calendar/calendar-body";
import { CalendarProvider } from "@/modules/components/calendar/contexts/calendar-context";
import { DndProvider } from "@/modules/components/calendar/contexts/dnd-context";
import { CalendarHeader } from "@/modules/components/calendar/header/calendar-header";
import { getCalendarForUser } from "@/modules/persistence/calendar-repository";

export async function Calendar({ userId }: { userId: string }) {
	const { events, tasks, users } = await getCalendarForUser(userId);

	return (
		<CalendarProvider
			events={events}
			tasks={tasks}
			users={users}
			view="month"
			persistenceEnabled
		>
			<DndProvider showConfirmation={false}>
				<div className="w-full rounded-lg border bg-white shadow-sm">
					<CalendarHeader />
					<CalendarBody />
				</div>
			</DndProvider>
		</CalendarProvider>
	);
}
