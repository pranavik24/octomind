import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
	title: "Octomind Calender",
	description: "Calendar page",
	icons: {
		icon: "/final.OctoMind.transparent.png",
		shortcut: "/final.OctoMind.transparent.png",
		apple: "/final.OctoMind.transparent.png",
	},
	authors: [
		{
			name: "Jeraidi Yassir",
			url: "https://jeraidi.tech",
		},
	],
	keywords: [
		"calendar",
		"big calendar",
		"full calendar",
		"next.js",
		"tailwind css",
		"shadcn ui",
		"events",
		"react.js",
	],
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html suppressHydrationWarning>
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
