import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { LandingPage } from "@/components/landing/landing-page";
import { AuthControls } from "@/modules/auth/auth-controls";
import { authOptions } from "@/modules/auth/auth-options";

export default async function Home() {
	const session = await getServerSession(authOptions);

	if (session?.user) redirect("/calendar");

	return (
		<LandingPage>
			<AuthControls />
		</LandingPage>
	);
}
