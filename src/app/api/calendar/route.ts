import { isPersistenceConfigured } from "@/lib/prisma";
import { getCalendarForUser } from "@/modules/persistence/calendar-repository";
import { apiError, requireUserId } from "@/modules/api/auth";

export async function GET() {
	try {
		if (!isPersistenceConfigured) {
			return Response.json(
				{ error: "Persistence is not configured." },
				{ status: 503 },
			);
		}

		const userId = await requireUserId();
		return Response.json(await getCalendarForUser(userId));
	} catch (error) {
		return apiError(error);
	}
}
