"use client";

import Image from "next/image";
import { useRef, type PointerEvent, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
	WaterRippleCanvas,
	type RipplePointer,
} from "@/components/landing/water-ripple-canvas";

const motionEase = [0.32, 0.72, 0, 1] as const;

export function LandingPage({ children }: { children: ReactNode }) {
	const prefersReducedMotion = useReducedMotion() ?? false;
	const pointerRef = useRef<RipplePointer>({
		x: -1,
		y: -1,
		active: false,
		version: 0,
	});

	const updatePointer = (event: PointerEvent<HTMLDivElement>) => {
		if (prefersReducedMotion) return;
		const bounds = event.currentTarget.getBoundingClientRect();
		pointerRef.current = {
			x: Math.min(
				1,
				Math.max(0, (event.clientX - bounds.left) / Math.max(bounds.width, 1)),
			),
			y: Math.min(
				1,
				Math.max(
					0,
					1 - (event.clientY - bounds.top) / Math.max(bounds.height, 1),
				),
			),
			active: true,
			version: pointerRef.current.version + 1,
		};
	};

	const handlePointerLeave = () => {
		if (prefersReducedMotion) return;
		pointerRef.current = {
			...pointerRef.current,
			active: false,
			version: pointerRef.current.version + 1,
		};
	};

	return (
		<div
			className="landing-page relative isolate overflow-hidden bg-[#eaf7f3] text-[#0c343a] dark:bg-[#08252a] dark:text-[#ecfbf7]"
			onPointerEnter={updatePointer}
			onPointerMove={updatePointer}
			onPointerDown={updatePointer}
			onPointerLeave={handlePointerLeave}
		>
			<div
				aria-hidden="true"
				className="landing-water-image"
				style={{ backgroundImage: "url('/octomind_water_background.png')" }}
			/>
			<WaterRippleCanvas
				pointerRef={pointerRef}
				disabled={prefersReducedMotion}
			/>
			<div className="landing-water-scrim" aria-hidden="true" />

			<main className="relative z-[1] flex min-h-[100dvh] items-center justify-center px-5 py-16 sm:px-8">
				<section className="flex w-full max-w-xl flex-col items-center text-center">
					<motion.div
						initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.9, ease: motionEase }}
					>
						<Image
							src="/octomind_logo_mark.png"
							alt="Octomind"
							width={112}
							height={112}
							className="size-24 object-contain drop-shadow-[0_20px_32px_rgba(12,67,74,0.18)] sm:size-28"
							priority
						/>
					</motion.div>

					<motion.h1
						className="mt-6 text-[clamp(4rem,12vw,8.4rem)] font-semibold leading-[0.88] tracking-[-0.085em] text-[#0a3037] dark:text-[#f0fcf9]"
						initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 1, delay: 0.08, ease: motionEase }}
					>
						Octomind
					</motion.h1>

					<motion.p
						className="mt-7 max-w-md text-base leading-7 text-[#315d62] sm:text-lg dark:text-[#b9dcd7]"
						initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.9, delay: 0.16, ease: motionEase }}
					>
						A calmer place to shape the week ahead.
					</motion.p>

					<motion.div
						className="mt-10"
						initial={prefersReducedMotion ? false : { opacity: 0, y: 18 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.9, delay: 0.24, ease: motionEase }}
					>
						{children}
					</motion.div>
				</section>
			</main>
		</div>
	);
}
