import { COLORS } from "@/modules/components/calendar/constants";
import type { IEvent, ITask, IUser } from "@/modules/components/calendar/interfaces";

export const USERS_MOCK: IUser[] = [
	{
		id: "f3b035ac-49f7-4e92-a715-35680bf63175",
		name: "Michael Doe",
		picturePath: null,
	},
	{
		id: "3e36ea6e-78f3-40dd-ab8c-a6c737c3c422",
		name: "Alice Johnson",
		picturePath: null,
	},
	{
		id: "a7aff6bd-a50a-4d6a-ab57-76f76bb27cf5",
		name: "Robert Smith",
		picturePath: null,
	},
	{
		id: "dd503cf9-6c38-43cf-94cc-0d4032e2f77a",
		name: "Emily Davis",
		picturePath: null,
	},
];

// ================================== //

const events = [
	"Doctor's appointment",
	"Dental cleaning",
	"Eye exam",
	"Therapy session",
	"Business meeting",
	"Team stand-up",
	"Project deadline",
	"Weekly report submission",
	"Client presentation",
	"Marketing strategy review",
	"Networking event",
	"Sales call",
	"Investor pitch",
	"Board meeting",
	"Employee training",
	"Performance review",
	"One-on-one meeting",
	"Lunch with a colleague",
	"HR interview",
	"Conference call",
	"Web development sprint planning",
	"Software deployment",
	"Code review",
	"QA testing session",
	"Cybersecurity audit",
	"Server maintenance",
	"API integration update",
	"Data backup",
	"Cloud migration",
	"System upgrade",
	"Content planning session",
	"Product launch",
	"Customer support review",
	"Team building activity",
	"Legal consultation",
	"Budget review",
	"Financial planning session",
	"Tax filing deadline",
	"Investor relations update",
	"Partnership negotiation",
	"Medical check-up",
	"Vaccination appointment",
	"Blood donation",
	"Gym workout",
	"Yoga class",
	"Physical therapy session",
	"Nutrition consultation",
	"Personal trainer session",
	"Parent-teacher meeting",
	"School open house",
	"College application deadline",
	"Final exam",
	"Graduation ceremony",
	"Job interview",
	"Internship orientation",
	"Office relocation",
	"Business trip",
	"Flight departure",
	"Hotel check-in",
	"Vacation planning",
	"Birthday party",
	"Wedding anniversary",
	"Family reunion",
	"Housewarming party",
	"Community volunteer work",
	"Charity fundraiser",
	"Religious service",
	"Concert attendance",
	"Theater play",
	"Movie night",
	"Sporting event",
	"Football match",
	"Basketball game",
	"Tennis practice",
	"Marathon training",
	"Cycling event",
	"Fishing trip",
	"Camping weekend",
	"Hiking expedition",
	"Photography session",
	"Art workshop",
	"Cooking class",
	"Book club meeting",
	"Grocery shopping",
	"Car maintenance",
	"Home renovation meeting",
];

const mockGenerator = (numberOfEvents: number): IEvent[] => {
	const result: IEvent[] = [];
	let currentId = 1;

	const randomUser = USERS_MOCK[Math.floor(Math.random() * USERS_MOCK.length)];

	// Date range: 30 days before and after now
	const now = new Date();
	const startRange = new Date(now);
	startRange.setDate(now.getDate() - 30);
	const endRange = new Date(now);
	endRange.setDate(now.getDate() + 30);

	// Create an event happening now
	const currentEvent = {
		id: `mock-event-${currentId++}`,
		startDate: new Date(now.getTime() - 30 * 60000).toISOString(),
		endDate: new Date(now.getTime() + 30 * 60000).toISOString(),
		title: events[Math.floor(Math.random() * events.length)],
		color: COLORS[Math.floor(Math.random() * COLORS.length)],
		description:
			"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
		user: randomUser,
	};

	result.push(currentEvent);

	// Generate the remaining events
	for (let i = 0; i < numberOfEvents - 1; i++) {
		// Determine if this is a multi-day event (10% chance)
		const isMultiDay = Math.random() < 0.1;

		const startDate = new Date(
			startRange.getTime() +
				Math.random() * (endRange.getTime() - startRange.getTime()),
		);

		// Set time between 8 AM and 8 PM
		startDate.setHours(
			8 + Math.floor(Math.random() * 12),
			Math.floor(Math.random() * 60),
			0,
			0,
		);

		const endDate = new Date(startDate);

		if (isMultiDay) {
			// Multi-day event: Add 1-4 days
			const additionalDays = Math.floor(Math.random() * 4) + 1;
			endDate.setDate(startDate.getDate() + additionalDays);
			endDate.setHours(
				8 + Math.floor(Math.random() * 12),
				Math.floor(Math.random() * 60),
				0,
				0,
			);
		} else {
			// Same-day event: Add 1-3 hours
			endDate.setHours(endDate.getHours() + Math.floor(Math.random() * 3) + 1);
		}

		result.push({
			id: `mock-event-${currentId++}`,
			startDate: startDate.toISOString(),
			endDate: endDate.toISOString(),
			title: events[Math.floor(Math.random() * events.length)],
			color: COLORS[Math.floor(Math.random() * COLORS.length)],
			description:
				"Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
			user: USERS_MOCK[Math.floor(Math.random() * USERS_MOCK.length)],
		});
	}

	return result;
};

const createEvent = (
	id: string,
	date: Date,
	startHour: number,
	startMinute: number,
	endHour: number,
	endMinute: number,
	title: string,
	location: string,
	color: IEvent["color"],
	description: string,
): IEvent => {
	const eventStart = new Date(date);
	eventStart.setHours(startHour, startMinute, 0, 0);

	const eventEnd = new Date(date);
	eventEnd.setHours(endHour, endMinute, 0, 0);

	return {
		id,
		startDate: eventStart.toISOString(),
		endDate: eventEnd.toISOString(),
		title,
		location,
		color,
		description,
		user: USERS_MOCK[0],
	};
};

const hashDate = (date: Date): number => {
	const y = date.getFullYear();
	const m = date.getMonth() + 1;
	const d = date.getDate();
	return y * 10000 + m * 100 + d;
};

const pickByDate = <T,>(date: Date, items: T[]): T => {
	return items[hashDate(date) % items.length];
};

const generateSchoolAndActivities = (
	pastWeeks = 26,
	futureWeeks = 26,
): IEvent[] => {
	const result: IEvent[] = [];
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const startDate = new Date(today);
	startDate.setDate(today.getDate() - pastWeeks * 7);
	const endDate = new Date(today);
	endDate.setDate(today.getDate() + futureWeeks * 7);
	let currentId = 1;

	for (let date = new Date(startDate); date <= endDate; date.setDate(date.getDate() + 1)) {
		const currentDate = new Date(date);
		const dayOfWeek = date.getDay();
		const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;

		if (isWeekday) {
			result.push(
				createEvent(
					`mock-school-${currentId++}`,
					currentDate,
					7,
					40,
					14,
					30,
					"School",
					"School",
					"School",
					"Weekday school schedule.",
				),
			);
		}

		// Sports games on Friday evenings
		if (dayOfWeek === 5) {
			const gameTitle = pickByDate(currentDate, [
				"Travel Game",
				"At Home Game",
				"Homecoming Game",
				"Rivalry Game",
			]);
			const gameTime = pickByDate(currentDate, [
				{ startHour: 18, startMinute: 0, endHour: 20, endMinute: 0 },
				{ startHour: 18, startMinute: 30, endHour: 20, endMinute: 30 },
				{ startHour: 19, startMinute: 0, endHour: 21, endMinute: 0 },
			]);

			result.push(
				createEvent(
					`mock-game-${currentId++}`,
					currentDate,
					gameTime.startHour,
					gameTime.startMinute,
					gameTime.endHour,
					gameTime.endMinute,
					gameTitle,
					"School Field",
					"Extracurriculars",
					"Evening game with the team.",
				),
			);
		}

		// Sports practice on some weekday afternoons (Tue/Thu)
		if (dayOfWeek === 2 || dayOfWeek === 4) {
			const practiceTitle = pickByDate(currentDate, [
				"Skills & Drills",
				"Conditioning Practice",
				"Strategy Session",
				"Team Practice",
			]);
			const practiceTime = pickByDate(currentDate, [
				{ startHour: 15, startMinute: 30, endHour: 17, endMinute: 0 },
				{ startHour: 15, startMinute: 45, endHour: 17, endMinute: 15 },
				{ startHour: 16, startMinute: 0, endHour: 17, endMinute: 30 },
			]);

			result.push(
				createEvent(
					`mock-practice-${currentId++}`,
					currentDate,
					practiceTime.startHour,
					practiceTime.startMinute,
					practiceTime.endHour,
					practiceTime.endMinute,
					practiceTitle,
					"Gym",
					"Extracurriculars",
					"Afternoon training block.",
				),
			);
		}

		// Weekend get-togethers (occasional, not every week)
		if (dayOfWeek === 6 || dayOfWeek === 0) {
			const weekendSeed = hashDate(currentDate);
			const includeGetTogether = weekendSeed % 3 === 0;
			if (!includeGetTogether) continue;

			const socialTitle = pickByDate(currentDate, [
				"Crew Hangout",
				"Weekend Meetup",
				"Pizza & Game Night",
				"Park Catch-Up",
			]);
			const socialLocation = pickByDate(currentDate, [
				"Community Center",
				"Downtown Park",
				"Friend's House",
				"City Rec Hall",
			]);
			const socialTime = pickByDate(currentDate, [
				{ startHour: 14, startMinute: 30, endHour: 16, endMinute: 0 },
				{ startHour: 16, startMinute: 0, endHour: 18, endMinute: 0 },
				{ startHour: 17, startMinute: 30, endHour: 19, endMinute: 30 },
			]);

			result.push(
				createEvent(
					`mock-social-${currentId++}`,
					currentDate,
					socialTime.startHour,
					socialTime.startMinute,
					socialTime.endHour,
					socialTime.endMinute,
					socialTitle,
					socialLocation,
					"Other",
					"Casual weekend social plan.",
				),
			);
		}
	}

	return result;
};

export const CALENDAR_ITEMS_MOCK: IEvent[] = generateSchoolAndActivities();

const TASK_TEMPLATES: Array<{
	title: string;
	description: string;
	color: ITask["color"];
	estimatedHours: number;
}> = [
	{
		title: "Finish algebra problem set",
		description: "Complete odd-numbered questions and check steps.",
		color: "Homework",
		estimatedHours: 1.5,
	},
	{
		title: "Study biology chapter quiz",
		description: "Review flashcards and practice 20 questions.",
		color: "Studying",
		estimatedHours: 2,
	},
	{
		title: "Draft English essay body paragraph",
		description: "Write one solid paragraph with quotes and citations.",
		color: "Homework",
		estimatedHours: 1.5,
	},
	{
		title: "Review history notes for unit test",
		description: "Summarize key dates and causes/effects.",
		color: "Studying",
		estimatedHours: 1.5,
	},
	{
		title: "Prepare debate club argument points",
		description: "Collect sources and build opening statement.",
		color: "Extracurriculars",
		estimatedHours: 1.5,
	},
	{
		title: "Practice SAT math timed section",
		description: "Do one timed module and review mistakes.",
		color: "Studying",
		estimatedHours: 2.5,
	},
	{
		title: "Complete chemistry lab report edits",
		description: "Revise conclusion and clean up data table formatting.",
		color: "Homework",
		estimatedHours: 1,
	},
	{
		title: "Part-time shift checklist",
		description: "Confirm shift tasks and prep for tomorrow.",
		color: "Work",
		estimatedHours: 1,
	},
	{
		title: "Organize planner and missing assignments",
		description: "Check portals and list priorities for the week.",
		color: "Other",
		estimatedHours: 0.5,
	},
	{
		title: "Community service log update",
		description: "Submit volunteer hours and write brief reflection.",
		color: "Other",
		estimatedHours: 1,
	},
];

const overlapsRange = (
	start: Date,
	end: Date,
	existingStart: Date,
	existingEnd: Date,
): boolean => start < existingEnd && existingStart < end;

const hasConflict = (start: Date, end: Date, existingTasks: ITask[]): boolean => {
	for (const event of CALENDAR_ITEMS_MOCK) {
		const eventStart = new Date(event.startDate);
		const eventEnd = new Date(event.endDate);
		if (overlapsRange(start, end, eventStart, eventEnd)) return true;
	}

	for (const task of existingTasks) {
		const taskStart = new Date(task.dueDate);
		const durationMs = (task.estimatedHours ?? 1) * 60 * 60 * 1000;
		const taskEnd = new Date(taskStart.getTime() + durationMs);
		if (overlapsRange(start, end, taskStart, taskEnd)) return true;
	}

	return false;
};

const findAvailableTaskStart = (
	day: Date,
	durationHours: number,
	isWeekend: boolean,
	existingTasks: ITask[],
): Date | null => {
	const durationMs = durationHours * 60 * 60 * 1000;
	const preferredHours = isWeekend ? [10, 13, 16, 19] : [16, 18, 20, 21];
	const fallbackHours = Array.from({ length: 17 }, (_, i) => i + 6).filter(
		(h) => !preferredHours.includes(h),
	);
	const candidateHours = [...preferredHours, ...fallbackHours];

	for (const hour of candidateHours) {
		const start = new Date(day);
		start.setHours(hour, 0, 0, 0);
		const end = new Date(start.getTime() + durationMs);
		if (end.getDate() !== start.getDate()) continue;
		if (!hasConflict(start, end, existingTasks)) return start;
	}

	return null;
};

const generateMonthlyTasks = (): ITask[] => {
	const tasks: ITask[] = [];
	const now = new Date();
	const start = new Date(now.getFullYear(), now.getMonth(), 1);
	const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
	let id = 100000;

	for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
		const day = new Date(date);
		const dayOfWeek = day.getDay();
		const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

		// Reduced density: weekdays get one task, weekends get a task only on alternating days.
		const tasksPerDay = isWeekend ? (hashDate(day) % 2 === 0 ? 1 : 0) : 1;
		for (let slot = 0; slot < tasksPerDay; slot++) {
			const templateIndex = (hashDate(day) + slot) % TASK_TEMPLATES.length;
			const template = TASK_TEMPLATES[templateIndex];
			const dueDate = findAvailableTaskStart(
				day,
				template.estimatedHours,
				isWeekend,
				tasks,
			);
			if (!dueDate) continue;

			tasks.push({
				id: `mock-task-${id++}`,
				dueDate: dueDate.toISOString(),
				estimatedHours: template.estimatedHours,
				title: template.title,
				description: template.description,
				color: template.color,
				user: USERS_MOCK[(hashDate(day) + slot) % USERS_MOCK.length],
			});
		}
	}

	return tasks;
};

export const TASK_ITEMS_MOCK: ITask[] = generateMonthlyTasks();
