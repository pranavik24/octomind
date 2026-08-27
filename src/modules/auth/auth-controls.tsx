"use client";

import { LogOut } from "lucide-react";
import { signIn, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function AuthControls({
	isSignedIn = false,
	userName,
}: {
	isSignedIn?: boolean;
	userName?: string | null;
} = {}) {
	if (!isSignedIn) {
		return (
			<Button
				className="group h-14 rounded-full bg-[#0e4f56] px-3 py-3 pl-6 text-base text-white shadow-[0_18px_48px_rgba(14,79,86,0.22)] transition-[transform,background-color,box-shadow] duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] hover:-translate-y-1 hover:bg-[#0b4147] hover:shadow-[0_24px_56px_rgba(14,79,86,0.28)] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#0e4f56]"
				onClick={() => signIn("google", { callbackUrl: "/calendar" })}
			>
				<span>Sign in with Google</span>
				<span
					aria-hidden="true"
					className="flex size-9 items-center justify-center rounded-full bg-white/14 text-base transition-transform duration-700 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-1 group-hover:-translate-y-px"
				>
					↗
				</span>
			</Button>
		);
	}

	return (
		<div className="flex items-center gap-2">
			<span className="hidden text-sm font-medium text-slate-700 md:inline">
				{userName ?? "Signed in"}
			</span>
			<Button variant="outline" onClick={() => signOut({ callbackUrl: "/" })}>
				<LogOut className="size-4" />
				Sign out
			</Button>
		</div>
	);
}
