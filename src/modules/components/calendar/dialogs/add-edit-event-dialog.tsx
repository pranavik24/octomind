import { zodResolver } from "@hookform/resolvers/zod";
import { addMinutes, format, set } from "date-fns";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { type UseFormReturn, useForm } from "react-hook-form";
import { toast } from "sonner";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Modal,
	ModalClose,
	ModalContent,
	ModalDescription,
	ModalFooter,
	ModalHeader,
	ModalTitle,
	ModalTrigger,
} from "@/components/ui/responsive-modal";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { COLORS } from "@/modules/components/calendar/constants";
import { useCalendar } from "@/modules/components/calendar/contexts/calendar-context";
import {
	estimateTaskDurationHours,
	normalizeTaskDurationHours,
} from "@/modules/components/calendar/helpers";
import { useDisclosure } from "@/modules/components/calendar/hooks";
import type { IEvent, ITask } from "@/modules/components/calendar/interfaces";
import {
	defaultRecurrenceCount,
	type RecurrencePreset,
	recurrenceForPreset,
	recurrenceOptionsForDate,
} from "@/modules/components/calendar/recurrence";
import { TaskSchedulingError } from "@/modules/components/calendar/scheduling";
import {
	eventSchema,
	type TEventFormData,
} from "@/modules/components/calendar/schemas";
import { EventBullet } from "@/modules/components/calendar/views/month-view/event-bullet";

interface IProps {
	children: ReactNode;
	startDate?: Date;
	startTime?: { hour: number; minute: number };
	event?: IEvent;
	task?: ITask;
}

interface TaskEstimateResponse {
	estimatedHours: number;
	estimatedMinutes: number;
	confidence: "low" | "medium" | "high";
	reason: string;
	source: "gemini" | "openai" | "ollama" | "local";
	model: string;
}

type EventFormValues = TEventFormData & { location: string };

type TaskFormValues = {
	title: string;
	description: string;
	dueDate: Date;
	estimatedHours?: number;
	color: ITask["color"];
};

interface PendingTaskConflict {
	error: TaskSchedulingError;
	task: ITask;
}

export function AddEditEventDialog({
	children,
	startDate,
	startTime,
	event,
}: IProps) {
	const { isOpen, onClose, onToggle } = useDisclosure();
	const { addEvent, updateEvent } = useCalendar();
	const isEditing = !!event;
	const initialPreset: RecurrencePreset = event?.recurrence
		? event.recurrence.freq === "weekly" &&
			event.recurrence.byweekday?.join(",") === "1,2,3,4,5"
			? "weekdays"
			: event.recurrence.freq
		: "none";

	const initialDates = useMemo(() => {
		if (!isEditing && !event) {
			if (!startDate) {
				const now = new Date();
				return { startDate: now, endDate: addMinutes(now, 30) };
			}
			const start = startTime
				? set(new Date(startDate), {
						hours: startTime.hour,
						minutes: startTime.minute,
						seconds: 0,
					})
				: new Date(startDate);
			const end = addMinutes(start, 30);
			return { startDate: start, endDate: end };
		}

		return {
			startDate: new Date(event.startDate),
			endDate: new Date(event.endDate),
		};
	}, [startDate, startTime, event, isEditing]);

	const form = useForm<EventFormValues>({
		resolver: zodResolver(eventSchema),
		defaultValues: {
			title: event?.title ?? "",
			location: event?.location ?? "",
			description: event?.description ?? "",
			startDate: initialDates.startDate,
			endDate: initialDates.endDate,
			color: event?.color ?? "Other",
			recurrencePreset: initialPreset,
			recurrenceFreq: event?.recurrence?.freq ?? "none",
			recurrenceCount: event?.recurrence?.count ?? undefined,
			recurrenceInterval: event?.recurrence?.interval ?? 1,
			recurrenceWeekdays: event?.recurrence?.byweekday,
			recurrenceUntil: event?.recurrence?.until,
			recurrenceBySetPos: event?.recurrence?.bysetpos,
		},
	});

	useEffect(() => {
		form.reset({
			title: event?.title ?? "",
			location: event?.location ?? "",
			description: event?.description ?? "",
			startDate: initialDates.startDate,
			endDate: initialDates.endDate,
			color: event?.color ?? "Other",
			recurrencePreset: initialPreset,
			recurrenceFreq: event?.recurrence?.freq ?? "none",
			recurrenceCount: event?.recurrence?.count ?? undefined,
			recurrenceInterval: event?.recurrence?.interval ?? 1,
			recurrenceWeekdays: event?.recurrence?.byweekday,
			recurrenceUntil: event?.recurrence?.until,
			recurrenceBySetPos: event?.recurrence?.bysetpos,
		});
	}, [event, initialDates, form, initialPreset]);

	// local UI state to open the custom recurrence modal without writing
	// an invalid sentinel value into the form (zod disallows "custom").
	const [openCustom, setOpenCustom] = useState(false);

	const onSubmit = async (values: EventFormValues) => {
		try {
			const formattedEvent: IEvent = {
				...values,
				startDate: format(values.startDate, "yyyy-MM-dd'T'HH:mm:ss"),
				endDate: format(values.endDate, "yyyy-MM-dd'T'HH:mm:ss"),
				id: isEditing ? event.id : crypto.randomUUID(),
				user: isEditing
					? event.user
					: {
							id: Math.floor(Math.random() * 1000000).toString(),
							name: "Jeraidi Yassir",
							picturePath: null,
						},
				color: values.color,
			};

			const presetRule = recurrenceForPreset(
				values.recurrencePreset ?? "none",
				values.startDate,
			);
			if (presetRule) {
				formattedEvent.recurrence = presetRule;
			} else if (
				values.recurrencePreset === "custom" &&
				values.recurrenceFreq &&
				values.recurrenceFreq !== "none"
			) {
				const endType = values.recurrenceEndType ?? "never";
				formattedEvent.recurrence = {
					freq: values.recurrenceFreq as
						| "daily"
						| "weekly"
						| "monthly"
						| "yearly",
					count:
						endType === "on"
							? undefined
							: endType === "after"
								? (values.recurrenceCount ?? 1)
								: defaultRecurrenceCount(
										values.recurrenceFreq as
											| "daily"
											| "weekly"
											| "monthly"
											| "yearly",
									),
					interval: values.recurrenceInterval ?? 1,
					byweekday: values.recurrenceWeekdays ?? undefined,
					bysetpos: values.recurrenceBySetPos,
					until: endType === "on" ? values.recurrenceUntil : undefined,
				};
			}

			if (isEditing) {
				await updateEvent(formattedEvent);
				toast.success("Event updated successfully");
			} else {
				await addEvent(formattedEvent);
				toast.success("Event created successfully");
			}

			onClose();
			form.reset();
		} catch (error) {
			console.error(`Error ${isEditing ? "editing" : "adding"} event:`, error);
			toast.error(`Failed to ${isEditing ? "edit" : "add"} event`);
		}
	};
	const selectedStartDate = form.watch("startDate");
	const recurrenceOptions = useMemo(
		() => recurrenceOptionsForDate(selectedStartDate),
		[selectedStartDate],
	);

	return (
		<Modal open={isOpen} onOpenChange={onToggle} modal={false}>
			<ModalTrigger asChild>{children}</ModalTrigger>
			<ModalContent>
				<ModalHeader>
					<ModalTitle>{isEditing ? "Edit Event" : "Add New Event"}</ModalTitle>
					<ModalDescription>
						{isEditing
							? "Modify your existing event."
							: "Create a new event for your calendar."}
					</ModalDescription>
				</ModalHeader>

				<Form {...form}>
					<form
						id="event-form"
						onSubmit={form.handleSubmit(onSubmit)}
						className="grid gap-4 py-4"
					>
						<FormField
							control={form.control}
							name="title"
							render={({ field, fieldState }) => (
								<FormItem>
									<FormLabel htmlFor="title" className="required">
										Title
									</FormLabel>
									<FormControl>
										<Input
											id="title"
											placeholder="Enter a title"
											{...field}
											className={fieldState.invalid ? "border-red-500" : ""}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="location"
							render={({ field, fieldState }) => (
								<FormItem>
									<FormLabel className="required" htmlFor="location">
										Location
									</FormLabel>
									<FormControl>
										<Input
											id="location"
											placeholder="Enter a location"
											{...field}
											className={fieldState.invalid ? "border-red-500" : ""}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name="startDate"
							render={({ field }) => (
								<DateTimePicker form={form} field={field} />
							)}
						/>
						<FormField
							control={form.control}
							name="endDate"
							render={({ field }) => (
								<DateTimePicker form={form} field={field} />
							)}
						/>
						<FormField
							control={form.control}
							name="color"
							render={({ field, fieldState }) => (
								<FormItem>
									<FormLabel className="required">Category</FormLabel>
									<FormControl>
										<Select value={field.value} onValueChange={field.onChange}>
											<SelectTrigger
												className={`w-full ${
													fieldState.invalid ? "border-red-500" : ""
												}`}
											>
												<SelectValue placeholder="Select a category" />
											</SelectTrigger>
											<SelectContent>
												{COLORS.map((color) => (
													<SelectItem value={color} key={color}>
														<div className="flex items-center gap-2">
															<EventBullet color={color} />
															{color}
														</div>
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						{/* Recurrence: show a compact select and a custom popup */}
						<FormField
							control={form.control}
							name="recurrencePreset"
							render={({ field }) => (
								<FormItem>
									<FormLabel>Repeat</FormLabel>
									<FormControl>
										<Select
											value={field.value}
											onValueChange={(value: RecurrencePreset) => {
												field.onChange(value);
												if (value === "custom") {
													setOpenCustom(true);
												}
											}}
										>
											<SelectTrigger className="w-full">
												<SelectValue placeholder="Does not repeat" />
											</SelectTrigger>
											<SelectContent>
												{recurrenceOptions.map((option) => (
													<SelectItem key={option.value} value={option.value}>
														{option.label}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						{/* Custom recurrence modal trigger: controlled by local state so we never write
							   the literal "custom" into the form (zod validation disallows it). */}
						{openCustom && (
							<CustomRecurrenceModal
								form={form}
								onClose={() => setOpenCustom(false)}
							/>
						)}
						<FormField
							control={form.control}
							name="description"
							render={({ field, fieldState }) => (
								<FormItem>
									<FormLabel> Description</FormLabel>
									<FormControl>
										<Textarea
											{...field}
											placeholder="Enter a description"
											className={fieldState.invalid ? "border-red-500" : ""}
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
					</form>
				</Form>
				<ModalFooter className="flex justify-end gap-2">
					<ModalClose asChild>
						<Button type="button" variant="outline">
							Cancel
						</Button>
					</ModalClose>
					<Button form="event-form" type="submit">
						{isEditing ? "Save Changes" : "Create Event"}
					</Button>
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
}

function CustomRecurrenceModal({
	form,
	onClose,
}: {
	form: UseFormReturn<EventFormValues>;
	onClose: () => void;
}) {
	const [open, setOpen] = useState(true);

	// local mirror values
	const savedFreq = form.getValues("recurrenceFreq");
	const freq = !savedFreq || savedFreq === "none" ? "weekly" : savedFreq;
	const interval = form.getValues("recurrenceInterval") ?? 1;
	const weekdays: number[] = form.getValues("recurrenceWeekdays") ?? [
		form.getValues("startDate").getDay(),
	];
	const endType = form.getValues("recurrenceEndType") ?? "never"; // 'never' | 'on' | 'after'
	const recurrenceUntil = form.getValues("recurrenceUntil");
	const until = recurrenceUntil ? new Date(recurrenceUntil) : undefined;
	const count = form.getValues("recurrenceCount") ?? 1;

	const [localFreq, setLocalFreq] = useState<string>(freq);
	const [localInterval, setLocalInterval] = useState<number>(interval);
	const [localWeekdays, setLocalWeekdays] = useState<number[]>(weekdays);
	const [localEndType, setLocalEndType] = useState<"never" | "on" | "after">(
		endType,
	);
	const [localUntil, setLocalUntil] = useState<Date | undefined>(until);
	const [localCount, setLocalCount] = useState<number>(count);

	function toggleWeekday(d: number) {
		if (localWeekdays.includes(d)) {
			setLocalWeekdays((s) => s.filter((x) => x !== d));
		} else setLocalWeekdays((s) => [...s, d]);
	}

	function handleSave() {
		form.setValue("recurrencePreset", "custom");
		form.setValue("recurrenceFreq", localFreq);
		form.setValue("recurrenceInterval", localInterval);
		form.setValue("recurrenceWeekdays", localWeekdays);
		form.setValue("recurrenceEndType", localEndType);
		form.setValue(
			"recurrenceUntil",
			localUntil ? localUntil.toISOString() : undefined,
		);
		form.setValue(
			"recurrenceCount",
			localEndType === "never"
				? defaultRecurrenceCount(
						localFreq as "daily" | "weekly" | "monthly" | "yearly",
					)
				: localEndType === "after"
					? localCount
					: undefined,
		);
		setOpen(false);
		onClose();
	}

	function handleCancel() {
		// simply close without modifying the form (we never wrote "custom")
		setOpen(false);
		onClose();
	}

	return (
		<Modal
			open={open}
			onOpenChange={(v) => {
				setOpen(v);
				if (!v) onClose();
			}}
			modal={true}
		>
			<ModalContent>
				<ModalHeader>
					<ModalTitle>Custom recurrence</ModalTitle>
				</ModalHeader>
				<div className="p-4">
					<div className="grid gap-3">
						<div className="flex items-center gap-2">
							<label className="w-32" htmlFor="recurrence-interval">
								Repeat every
							</label>
							<Input
								id="recurrence-interval"
								type="number"
								min={1}
								value={localInterval}
								onChange={(e) => setLocalInterval(Number(e.target.value))}
								className="w-20"
							/>
							<Select value={localFreq} onValueChange={(v) => setLocalFreq(v)}>
								<SelectTrigger className="w-32">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="daily">day(s)</SelectItem>
									<SelectItem value="weekly">week(s)</SelectItem>
									<SelectItem value="monthly">month(s)</SelectItem>
									<SelectItem value="yearly">year(s)</SelectItem>
								</SelectContent>
							</Select>
						</div>

						{/* Repeat on - show weekdays */}
						<div>
							<div className="mb-2">Repeat on</div>
							<div className="flex gap-2">
								{[
									{ label: "S", name: "Sunday", day: 0 },
									{ label: "M", name: "Monday", day: 1 },
									{ label: "T", name: "Tuesday", day: 2 },
									{ label: "W", name: "Wednesday", day: 3 },
									{ label: "T", name: "Thursday", day: 4 },
									{ label: "F", name: "Friday", day: 5 },
									{ label: "S", name: "Saturday", day: 6 },
								].map(({ label, name, day }) => (
									<button
										key={day}
										onClick={() => toggleWeekday(day)}
										type="button"
										aria-label={name}
										aria-pressed={localWeekdays.includes(day)}
										className={`flex h-8 w-8 items-center justify-center rounded-full ${localWeekdays.includes(day) ? "bg-blue-600 text-white" : "bg-gray-200"}`}
									>
										{label}
									</button>
								))}
							</div>
						</div>

						{/* Ends */}
						<div>
							<div className="mb-2">Ends</div>
							<div className="space-y-2">
								<label className="flex items-center gap-2">
									<input
										type="radio"
										name="endType"
										checked={localEndType === "never"}
										onChange={() => setLocalEndType("never")}
									/>
									<span className="ml-2">Never</span>
								</label>
								<label className="flex items-center gap-2">
									<input
										type="radio"
										name="endType"
										checked={localEndType === "on"}
										onChange={() => setLocalEndType("on")}
									/>
									<span className="ml-2">On</span>
									{localEndType === "on" && (
										<Input
											type="date"
											value={
												localUntil ? localUntil.toISOString().slice(0, 10) : ""
											}
											onChange={(e) =>
												setLocalUntil(
													e.target.value ? new Date(e.target.value) : undefined,
												)
											}
											className="ml-4"
										/>
									)}
								</label>
								<label className="flex items-center gap-2">
									<input
										type="radio"
										name="endType"
										checked={localEndType === "after"}
										onChange={() => setLocalEndType("after")}
									/>
									<span className="ml-2">After</span>
									{localEndType === "after" && (
										<Input
											type="number"
											min={1}
											value={localCount}
											onChange={(e) => setLocalCount(Number(e.target.value))}
											className="ml-4 w-24"
										/>
									)}
								</label>
							</div>
						</div>
					</div>
				</div>
				<ModalFooter>
					<Button variant="outline" onClick={handleCancel}>
						Cancel
					</Button>
					<Button onClick={handleSave}>Done</Button>
				</ModalFooter>
			</ModalContent>
		</Modal>
	);
}

export function AddEditTaskDialog({
	children,
	startDate,
	startTime,
	task,
}: IProps) {
	const { isOpen, onClose, onToggle } = useDisclosure();
	const { addTask, updateTask } = useCalendar();
	const isEditing = !!task;

	const initialDates = useMemo(() => {
		if (!isEditing && !task) {
			const toEod = (d: Date) =>
				set(new Date(d), {
					hours: 23,
					minutes: 59,
					seconds: 0,
				});
			if (!startDate) {
				const now = new Date();
				return { dueDate: toEod(now) };
			}
			const start = startTime
				? set(new Date(startDate), {
						hours: startTime.hour,
						minutes: startTime.minute,
						seconds: 0,
					})
				: new Date(startDate);
			return { dueDate: toEod(start) };
		}

		return {
			dueDate: new Date(task.dueDate),
		};
	}, [startDate, startTime, task, isEditing]);

	// Use a flexible form type for tasks to avoid mismatched defaultValues shape
	// NOTE: We intentionally do NOT use `eventSchema` for tasks because the
	// event schema expects `startDate`/`endDate` while tasks use `dueDate`.
	const form = useForm<TaskFormValues>({
		defaultValues: {
			title: task?.title ?? "",
			description: task?.description ?? "",
			dueDate: initialDates.dueDate,
			estimatedHours:
				task?.estimatedHours ??
				estimateTaskDurationHours(task?.title ?? "", task?.description ?? ""),
			color: task?.color ?? "Other",
		},
	});

	const watchedTitle = form.watch("title");
	const watchedDescription = form.watch("description");
	const watchedDueDate = form.watch("dueDate");
	const watchedColor = form.watch("color");
	const autoEstimatedHours = useMemo(
		() =>
			estimateTaskDurationHours(watchedTitle ?? "", watchedDescription ?? ""),
		[watchedTitle, watchedDescription],
	);
	const [useAutoEstimate, setUseAutoEstimate] = useState(!task?.estimatedHours);
	const [estimateRefreshKey, setEstimateRefreshKey] = useState(0);
	const [isLlmEstimating, setIsLlmEstimating] = useState(false);
	const [estimateDetails, setEstimateDetails] =
		useState<TaskEstimateResponse | null>(null);
	const estimateLabel =
		estimateDetails?.source === "local" ? "Local estimate" : "AI estimate";
	const estimateRequestId = useRef(0);
	const [pendingTaskConflict, setPendingTaskConflict] =
		useState<PendingTaskConflict | null>(null);
	const [isEod, setIsEod] = useState(() => {
		const due = task ? new Date(task.dueDate) : initialDates.dueDate;
		return due.getHours() === 23 && due.getMinutes() === 59;
	});

	useEffect(() => {
		form.reset({
			title: task?.title ?? "",
			description: task?.description ?? "",
			dueDate: initialDates.dueDate,
			estimatedHours:
				task?.estimatedHours ??
				estimateTaskDurationHours(task?.title ?? "", task?.description ?? ""),
			color: task?.color ?? "Other",
		});
		setUseAutoEstimate(!task?.estimatedHours);
		const due = task ? new Date(task.dueDate) : initialDates.dueDate;
		setIsEod(due.getHours() === 23 && due.getMinutes() === 59);
	}, [task, initialDates, form]);

	useEffect(() => {
		if (!useAutoEstimate) return;
		form.setValue("estimatedHours", autoEstimatedHours, { shouldDirty: false });
	}, [autoEstimatedHours, form, useAutoEstimate]);

	useEffect(() => {
		if (!useAutoEstimate) return;
		void estimateRefreshKey;

		const title = (watchedTitle ?? "").trim();
		const description = (watchedDescription ?? "").trim();

		if (!title && !description) {
			setEstimateDetails(null);
			setIsLlmEstimating(false);
			return;
		}

		const requestId = estimateRequestId.current + 1;
		estimateRequestId.current = requestId;
		const controller = new AbortController();

		const timeout = window.setTimeout(async () => {
			setIsLlmEstimating(true);

			try {
				const response = await fetch("/api/task-estimate", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					signal: controller.signal,
					body: JSON.stringify({
						title,
						description,
						category: watchedColor ?? "Other",
						dueDate: watchedDueDate
							? new Date(watchedDueDate).toISOString()
							: undefined,
					}),
				});

				if (!response.ok) {
					throw new Error(`Estimate request failed: ${response.status}`);
				}

				const estimate = (await response.json()) as TaskEstimateResponse;
				if (estimateRequestId.current !== requestId) return;

				form.setValue(
					"estimatedHours",
					normalizeTaskDurationHours(estimate.estimatedHours),
					{ shouldDirty: false },
				);
				setEstimateDetails(estimate);
			} catch (error) {
				if (
					controller.signal.aborted ||
					estimateRequestId.current !== requestId
				) {
					return;
				}

				form.setValue("estimatedHours", autoEstimatedHours, {
					shouldDirty: false,
				});
				setEstimateDetails({
					estimatedHours: autoEstimatedHours,
					estimatedMinutes: autoEstimatedHours * 60,
					confidence: "low",
					reason: "Local estimate used because the background estimate failed.",
					source: "local",
					model: "local",
				});
				console.warn("Task estimate failed:", error);
			} finally {
				if (estimateRequestId.current === requestId) {
					setIsLlmEstimating(false);
				}
			}
		}, 700);

		return () => {
			window.clearTimeout(timeout);
			controller.abort();
		};
	}, [
		autoEstimatedHours,
		estimateRefreshKey,
		form,
		useAutoEstimate,
		watchedDescription,
		watchedColor,
		watchedDueDate,
		watchedTitle,
	]);

	useEffect(() => {
		if (!isEod || !watchedDueDate) return;
		const dueDate = new Date(watchedDueDate);
		if (dueDate.getHours() === 23 && dueDate.getMinutes() === 59) return;
		form.setValue(
			"dueDate",
			set(dueDate, { hours: 23, minutes: 59, seconds: 0 }),
			{ shouldDirty: true },
		);
	}, [isEod, watchedDueDate, form]);

	const buildTaskFromValues = (values: TaskFormValues): ITask => {
		const estimatedHours = normalizeTaskDurationHours(
			values.estimatedHours ??
				estimateTaskDurationHours(values.title ?? "", values.description ?? ""),
		);

		return {
			...values,
			dueDate: format(values.dueDate, "yyyy-MM-dd'T'HH:mm:ss"),
			estimatedHours,
			id: isEditing ? task.id : crypto.randomUUID(),
			user: isEditing
				? task.user
				: {
						id: Math.floor(Math.random() * 1000000).toString(),
						name: "Jeraidi Yassir",
						picturePath: null,
					},
			color: values.color,
		};
	};

	const saveTask = async (formattedTask: ITask) => {
		if (isEditing) {
			await updateTask(formattedTask);
			toast.success("Task updated successfully");
		} else {
			await addTask(formattedTask);
			toast.success("Task created successfully");
		}
	};

	const closeAfterTaskSave = () => {
		onClose();
		form.reset();
		setPendingTaskConflict(null);
	};

	const onSubmit = async (values: TaskFormValues) => {
		try {
			const formattedTask = buildTaskFromValues(values);
			await saveTask(formattedTask);
			closeAfterTaskSave();
		} catch (error) {
			if (error instanceof TaskSchedulingError) {
				setPendingTaskConflict({
					error,
					task: buildTaskFromValues(values),
				});
				return;
			}

			console.error(`Error ${isEditing ? "editing" : "adding"} task:`, error);
			toast.error(`Failed to ${isEditing ? "edit" : "add"} task`);
		}
	};

	return (
		<>
			<Modal open={isOpen} onOpenChange={onToggle} modal={false}>
				<ModalTrigger asChild>{children}</ModalTrigger>
				<ModalContent>
					<ModalHeader>
						<ModalTitle>{isEditing ? "Edit Task" : "Add New Task"}</ModalTitle>
						<ModalDescription>
							{isEditing
								? "Modify your existing task."
								: "Create a new task for your calendar."}
						</ModalDescription>
					</ModalHeader>

					<Form {...form}>
						<form
							id="task-form"
							onSubmit={form.handleSubmit(onSubmit)}
							className="grid gap-4 py-4"
						>
							<FormField
								control={form.control}
								name="title"
								render={({ field, fieldState }) => (
									<FormItem>
										<FormLabel htmlFor="title" className="required">
											Title
										</FormLabel>
										<FormControl>
											<Input
												id="title"
												placeholder="Enter a title"
												{...field}
												className={fieldState.invalid ? "border-red-500" : ""}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="dueDate"
								render={({ field }) => (
									<DateTimePicker form={form} field={field} />
								)}
							/>
							<div className="flex items-center gap-2">
								<input
									id="task-eod"
									type="checkbox"
									checked={isEod}
									onChange={(e) => {
										const checked = e.target.checked;
										setIsEod(checked);
										if (!checked) return;
										const currentDue = form.getValues("dueDate") ?? new Date();
										form.setValue(
											"dueDate",
											set(new Date(currentDue), {
												hours: 23,
												minutes: 59,
												seconds: 0,
											}),
											{ shouldDirty: true },
										);
									}}
									className="size-4 rounded border-input"
								/>
								<Label htmlFor="task-eod">EOD (11:59 PM)</Label>
							</div>
							<FormField
								control={form.control}
								name="estimatedHours"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Estimated Duration (hours)</FormLabel>
										<FormControl>
											<div className="flex items-center gap-2">
												<Input
													type="number"
													min={0.5}
													max={8}
													step={0.5}
													value={field.value ?? ""}
													onChange={(e) => {
														const value = Number(e.target.value);
														field.onChange(
															Number.isNaN(value)
																? 1
																: normalizeTaskDurationHours(value),
														);
														setUseAutoEstimate(false);
													}}
												/>
												<Button
													type="button"
													variant="outline"
													disabled={isLlmEstimating}
													onClick={() => {
														setUseAutoEstimate(true);
														field.onChange(autoEstimatedHours);
														setEstimateRefreshKey((key) => key + 1);
													}}
												>
													{isLlmEstimating ? "Estimating..." : "Auto Estimate"}
												</Button>
											</div>
										</FormControl>
										<p className="text-xs text-muted-foreground">
											{estimateDetails
												? `${estimateLabel}: ${estimateDetails.reason}`
												: "Based on task title and description. Range: 0.5h to 8h."}
										</p>
										<FormMessage />
									</FormItem>
								)}
							/>

							<FormField
								control={form.control}
								name="color"
								render={({ field, fieldState }) => (
									<FormItem>
										<FormLabel className="required">Category</FormLabel>
										<FormControl>
											<Select
												value={field.value}
												onValueChange={field.onChange}
											>
												<SelectTrigger
													className={`w-full ${
														fieldState.invalid ? "border-red-500" : ""
													}`}
												>
													<SelectValue placeholder="Select a category" />
												</SelectTrigger>
												<SelectContent>
													{COLORS.map((color) => (
														<SelectItem value={color} key={color}>
															<div className="flex items-center gap-2">
																<EventBullet color={color} />
																{color}
															</div>
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="description"
								render={({ field, fieldState }) => (
									<FormItem>
										<FormLabel> Description</FormLabel>
										<FormControl>
											<Textarea
												{...field}
												placeholder="Enter a description"
												className={fieldState.invalid ? "border-red-500" : ""}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
						</form>
					</Form>
					<ModalFooter className="flex justify-end gap-2">
						<ModalClose asChild>
							<Button type="button" variant="outline">
								Cancel
							</Button>
						</ModalClose>
						<Button form="task-form" type="submit">
							{isEditing ? "Save Changes" : "Create Task"}
						</Button>
					</ModalFooter>
				</ModalContent>
			</Modal>
			<AlertDialog
				open={!!pendingTaskConflict}
				onOpenChange={(open) => {
					if (!open) setPendingTaskConflict(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Not enough time before the due date
						</AlertDialogTitle>
						<AlertDialogDescription>
							This task is estimated to take{" "}
							{pendingTaskConflict?.task.estimatedHours ?? 0} hours, but there
							is not enough available time to schedule it before{" "}
							{pendingTaskConflict
								? format(
										new Date(pendingTaskConflict.task.dueDate),
										"MMM d, h:mm a",
									)
								: "the due date"}
							. Adjust the due date, reduce the estimate, or free up time before
							the due date before creating this task.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Keep editing</AlertDialogCancel>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
