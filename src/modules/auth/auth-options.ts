import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma, isPersistenceConfigured } from "@/lib/prisma";
import { SecurePrismaAdapter } from "@/modules/auth/secure-prisma-adapter";

const basicGoogleScopes = [
	"openid",
	"email",
	"profile",
].join(" ");

export const authOptions: NextAuthOptions = {
	adapter: isPersistenceConfigured ? SecurePrismaAdapter(prisma) : undefined,
	session: {
		strategy: isPersistenceConfigured ? "database" : "jwt",
	},
	secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
	providers:
		process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
			? [
					GoogleProvider({
						clientId: process.env.AUTH_GOOGLE_ID,
						clientSecret: process.env.AUTH_GOOGLE_SECRET,
						authorization: {
							params: {
								scope: basicGoogleScopes,
							},
						},
					}),
				]
			: [],
	callbacks: {
		session({ session, user, token }) {
			const userId = user?.id ?? token.sub;
			if (session.user && userId) {
				session.user.id = userId;
			}
			return session;
		},
		jwt({ token, user }) {
			if (user?.id) token.sub = user.id;
			return token;
		},
	},
	pages: {
		signIn: "/",
	},
};

declare module "next-auth" {
	interface Session {
		user?: {
			id?: string;
			name?: string | null;
			email?: string | null;
			image?: string | null;
		};
	}
}
