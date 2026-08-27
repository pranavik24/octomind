import Image from "next/image";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/modules/auth/auth-options";
import { onboardingCompletedForUser } from "@/modules/onboarding/repository";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
	const session = await getServerSession(authOptions);
	const userId = session?.user?.id;
	if (!userId) redirect("/");
	if (await onboardingCompletedForUser(userId)) redirect("/calendar");

	return (
		<main className="ocean-page min-h-screen px-4 py-8 md:px-6">
			<div className="mx-auto w-full max-w-3xl">
				<header className="mb-7 flex items-center gap-3">
					<Image
						src="/final.OctoMind.transparent.png"
						alt="Octomind"
						width={64}
						height={64}
						className="size-14 object-contain"
						priority
					/>
					<div>
						<h1 className="text-2xl font-semibold text-foreground">
							Set up your week
						</h1>
						<p className="text-sm text-muted-foreground">
							We will protect school and sleep before scheduling tasks.
						</p>
					</div>
				</header>
				<OnboardingForm />
			</div>
		</main>
	);
}
