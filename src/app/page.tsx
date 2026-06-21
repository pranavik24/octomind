import Image from "next/image";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { AuthControls } from "@/modules/auth/auth-controls";
import { authOptions } from "@/modules/auth/auth-options";

export default async function Home() {
	const session = await getServerSession(authOptions);

	if (session?.user) redirect("/calendar");

	return (
		<main
			className="relative flex min-h-screen items-center overflow-hidden bg-cover bg-center px-6 py-12"
			style={{ backgroundImage: "url('/octomind_website_background.png')" }}
		>
			<div className="absolute inset-0 bg-white/55" aria-hidden="true" />
			<section className="relative mx-auto flex w-full max-w-5xl flex-col items-start gap-8">
				<Image
					src="/final.OctoMind.transparent.png"
					alt="Octomind"
					width={144}
					height={144}
					className="size-28 object-contain md:size-36"
					priority
				/>
				<div className="max-w-3xl space-y-4">
					<h1 className="text-5xl font-semibold tracking-normal text-slate-950 md:text-7xl">
						Octomind
					</h1>
					<p className="max-w-2xl text-lg leading-8 text-slate-700 md:text-xl">
						A calm calendar for turning classes, deadlines, and plans into a
						workable week.
					</p>
				</div>
				<AuthControls />
			</section>
		</main>
	);
}
