import { PrismaAdapter } from "@next-auth/prisma-adapter";
import type { PrismaClient } from "@prisma/client";
import type { Adapter, AdapterAccount } from "next-auth/adapters";

type ProviderAdapterAccount = {
	userId: string;
	type: AdapterAccount["type"];
	provider: string;
	providerAccountId: string;
	access_token?: string | null;
	refresh_token?: string | null;
	id_token?: string | null;
	session_state?: string | null;
	expires_at?: number;
	refresh_token_expires_in?: number | null;
	token_type?: string;
	scope?: string;
	[key: string]: unknown;
};

export function prepareAccountForPersistence(
	account: ProviderAdapterAccount,
): AdapterAccount {
	return {
		userId: account.userId,
		type: account.type,
		provider: account.provider,
		providerAccountId: account.providerAccountId,
	};
}

export function SecurePrismaAdapter(prisma: PrismaClient): Adapter {
	const adapter = PrismaAdapter(prisma);
	const linkAccount = adapter.linkAccount;

	if (!linkAccount) {
		throw new Error("Prisma adapter does not provide account linking.");
	}

	return {
		...adapter,
		linkAccount(account: AdapterAccount) {
			return linkAccount(
				prepareAccountForPersistence(account as ProviderAdapterAccount),
			);
		},
	};
}
