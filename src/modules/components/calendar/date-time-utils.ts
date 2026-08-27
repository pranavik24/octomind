export function mergeDatePreservingTime(
	selectedDate: Date,
	currentValue?: Date,
): Date {
	const nextDate = new Date(selectedDate);
	if (!currentValue || Number.isNaN(currentValue.getTime())) return nextDate;

	nextDate.setHours(
		currentValue.getHours(),
		currentValue.getMinutes(),
		currentValue.getSeconds(),
		currentValue.getMilliseconds(),
	);
	return nextDate;
}
