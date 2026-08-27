import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
	title:
		"OctoMind - AI Task Scheduler | Next.js, React, TypeScript, Gemini, Prisma, Supabase, Auth.js, and shadcn/ui",
	description:
		"An AI-powered calendar and task scheduler built with Next.js, React, TypeScript, Gemini, Prisma, Supabase, Auth.js, and shadcn/ui.",
	icons: {
		icon: "/final.OctoMind.transparent.png",
		shortcut: "/final.OctoMind.transparent.png",
		apple: "/final.OctoMind.transparent.png",
	},
	authors: [
		{
			name: "Pranavi Kondapalli",
			url: "https://pranavik24.github.io/",
		},
	],
	keywords: [
		"AI task scheduler",
		"calendar",
		"Next.js",
		"React",
		"Gemini",
		"TypeScript",
		"Prisma",
		"Supabase",
		"Auth.js",
		"shadcn/ui",
	],
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body>
				<ThemeProvider
					attribute="class"
					defaultTheme="light"
					enableSystem={false}
					forcedTheme="light"
					disableTransitionOnChange
				>
					{children}
					<Toaster />
				</ThemeProvider>
			</body>
		</html>
	);
}
