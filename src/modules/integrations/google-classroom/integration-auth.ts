import { getServerSession } from "next-auth";
import { ApiError } from "@/modules/api/auth";
import { authOptions } from "@/modules/auth/auth-options";

export type IntegrationUser = {
	id: string;
	email: string;
};

export async function requireIntegrationUser(): Promise<IntegrationUser> {
	const session = await getServerSession(authOptions);
	const id = session?.user?.id;
	const email = session?.user?.email;
	if (!id || !email) {
		throw new ApiError("unauthorized", 401, "Authentication required.");
	}
	return { id, email };
}
