import { ArrowLeft, Plug } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { authOptions } from "@/modules/auth/auth-options";
import { onboardingCompletedForUser } from "@/modules/onboarding/repository";
import { ClassroomIntegrationCard } from "./classroom-integration-card";

export default async function IntegrationsSettingsPage() {
	const session = await getServerSession(authOptions);
	if (!session?.user?.id) redirect("/");
	if (!(await onboardingCompletedForUser(session.user.id)))
		redirect("/onboarding");

	return (
		<main className="min-h-screen bg-slate-50 px-4 py-8 md:px-6">
			<div className="mx-auto w-full max-w-4xl">
				<Button variant="ghost" asChild className="mb-5">
					<Link href="/calendar">
						<ArrowLeft />
						Back to calendar
					</Link>
				</Button>
				<header className="mb-6 flex items-center gap-3">
					<div className="flex size-10 items-center justify-center rounded-lg bg-slate-950 text-white">
						<Plug className="size-5" />
					</div>
					<div>
						<h1 className="text-2xl font-semibold text-slate-950">
							Integrations
						</h1>
						<p className="text-sm text-slate-600">
							Manage services connected to Octomind.
						</p>
					</div>
				</header>
				<Suspense
					fallback={
						<div className="h-64 animate-pulse rounded-lg border border-slate-200 bg-white" />
					}
				>
					<ClassroomIntegrationCard />
				</Suspense>
			</div>
		</main>
	);
}
