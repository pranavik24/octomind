import { cva } from "class-variance-authority";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { transition } from "@/modules/components/calendar/animations";
import type { TEventColor } from "@/modules/components/calendar/types";

const eventBulletVariants = cva("size-2 rounded-full", {
	variants: {
		color: {
			School: "reef-dot-school",
			Homework: "reef-dot-homework",
			Studying: "reef-dot-studying",
			Extracurriculars: "reef-dot-extracurriculars",
			Work: "reef-dot-work",
			Other: "reef-dot-other",
		},
	},
	defaultVariants: {
		color: "Other",
	},
});

export function EventBullet({
	color,
	className,
}: {
	color: TEventColor;
	className?: string;
}) {
	return (
		<motion.div
			className={cn(eventBulletVariants({ color, className }))}
			initial={{ scale: 0, opacity: 0 }}
			animate={{ scale: 1, opacity: 1 }}
			whileHover={{ scale: 1.2 }}
			transition={transition}
		/>
	);
}
