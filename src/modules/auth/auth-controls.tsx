"use client";

import { LogIn, LogOut } from "lucide-react";
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
			<Button onClick={() => signIn("google", { callbackUrl: "/calendar" })}>
				<LogIn className="size-4" />
				Sign in with Google
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
