"use client";
import { motion } from "motion/react";
import React from "react";

type SpotlightProps = {
	fillFirst?: string;
	fillSecond?: string;
	fillThird?: string;
	translateY?: number;
	width?: number;
	height?: number;
	smallWidth?: number;
	duration?: number;
	xOffset?: number;
};

export const Spotlight = ({
	fillFirst = "hsla(190, 64%, 66%, 0.1)",
	fillSecond = "hsla(18, 80%, 78%, 0.08)",
	fillThird = "hsla(145, 55%, 70%, 0.06)",
	translateY = -350,
	width = 560,
	height = 1380,
	smallWidth = 240,
	duration = 7,
	xOffset = 100,
}: SpotlightProps = {}) => {
	return (
		<motion.div
			initial={{
				opacity: 0,
			}}
			animate={{
				opacity: 1,
			}}
			transition={{
				duration: 1.5,
			}}
			className="pointer-events-none absolute inset-0 z-10 h-full w-full"
		>
			<motion.div
				animate={{
					x: [0, xOffset, 0],
				}}
				transition={{
					duration,
					repeat: Infinity,
					repeatType: "reverse",
					ease: "easeInOut",
				}}
				className="pointer-events-none absolute top-0 left-0 z-0 h-screen w-screen"
			>
				<div
					style={{
						transform: `translateY(${translateY}px) rotate(-45deg)`,
						background: fillFirst,
						width: `${width}px`,
						height: `${height}px`,
					}}
					className={`absolute top-0 left-0`}
				/>

				<div
					style={{
						transform: "rotate(-45deg) translate(5%, -50%)",
						background: fillSecond,
						width: `${smallWidth}px`,
						height: `${height}px`,
					}}
					className={`absolute top-0 left-0 origin-top-left`}
				/>

				<div
					style={{
						transform: "rotate(-45deg) translate(-180%, -70%)",
						background: fillThird,
						width: `${smallWidth}px`,
						height: `${height}px`,
					}}
					className={`absolute top-0 left-0 origin-top-left`}
				/>
			</motion.div>

			<motion.div
				animate={{
					x: [0, -xOffset, 0],
				}}
				transition={{
					duration,
					repeat: Infinity,
					repeatType: "reverse",
					ease: "easeInOut",
				}}
				className="pointer-events-none absolute top-0 right-0 z-40 h-screen w-screen"
			>
				<div
					style={{
						transform: `translateY(${translateY}px) rotate(45deg)`,
						background: fillFirst,
						width: `${width}px`,
						height: `${height}px`,
					}}
					className={`absolute top-0 right-0`}
				/>

				<div
					style={{
						transform: "rotate(45deg) translate(-5%, -50%)",
						background: fillSecond,
						width: `${smallWidth}px`,
						height: `${height}px`,
					}}
					className={`absolute top-0 right-0 origin-top-right`}
				/>

				<div
					style={{
						transform: "rotate(45deg) translate(180%, -70%)",
						background: fillThird,
						width: `${smallWidth}px`,
						height: `${height}px`,
					}}
					className={`absolute top-0 right-0 origin-top-right`}
				/>
			</motion.div>
		</motion.div>
	);
};
