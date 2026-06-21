import Image from "next/image";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Suspense } from "react";
import { AuthControls } from "@/modules/auth/auth-controls";
import { authOptions } from "@/modules/auth/auth-options";
import { Calendar } from "@/modules/components/calendar/calendar";
import { CalendarSkeleton } from "@/modules/components/calendar/skeletons/calendar-skeleton";
import { onboardingCompletedForUser } from "@/modules/onboarding/repository";

export default async function CalendarPage() {
	const session = await getServerSession(authOptions);
	const userId = session?.user?.id;

	if (!userId) redirect("/");
	if (!(await onboardingCompletedForUser(userId))) redirect("/onboarding");

	return (
		<main className="min-h-screen bg-slate-50">
			<div className="mx-auto w-full max-w-screen-2xl px-4 py-4 md:px-6">
				<header className="mb-4 flex items-center justify-between gap-4">
					<div className="flex min-w-0 items-center gap-3">
						<Image
							src="/final.OctoMind.transparent.png"
							alt="Octomind"
							width={56}
							height={56}
							className="size-12 shrink-0 object-contain"
							priority
						/>
						<h1 className="truncate text-2xl font-semibold text-slate-950">
							Octomind
						</h1>
					</div>
					<AuthControls isSignedIn userName={session.user?.name} />
				</header>
				<Suspense fallback={<CalendarSkeleton />}>
					<Calendar userId={userId} />
				</Suspense>
			</div>
		</main>
	);
}
