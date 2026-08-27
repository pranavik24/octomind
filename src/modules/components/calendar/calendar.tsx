import { CalendarBody } from "@/modules/components/calendar/calendar-body";
import { CalendarInsightsPanel } from "@/modules/components/calendar/calendar-insights-panel";
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
				<div className="flex min-h-0 w-full flex-1 flex-col gap-3 xl:flex-row">
					<div className="ocean-shell flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border">
						<CalendarHeader />
						<CalendarBody />
					</div>
					<CalendarInsightsPanel />
				</div>
			</DndProvider>
		</CalendarProvider>
	);
}
