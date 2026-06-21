import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { describe, it } from "node:test";

const projectRoot = resolve(import.meta.dirname, "../..");
const readSource = (relativePath) =>
	readFileSync(resolve(projectRoot, relativePath), "utf8");

const resolveLocalImport = (fromFile, specifier) => {
	const candidate = specifier.startsWith("@/")
		? resolve(projectRoot, "src", specifier.slice(2))
		: resolve(dirname(fromFile), specifier);
	const candidates = extname(candidate)
		? [candidate]
		: [
				`${candidate}.ts`,
				`${candidate}.tsx`,
				resolve(candidate, "index.ts"),
				resolve(candidate, "index.tsx"),
			];

	return candidates.find((path) => {
		try {
			readFileSync(path);
			return true;
		} catch {
			return false;
		}
	});
};

const collectRuntimeImports = (entryPath) => {
	const visited = new Set();
	const visit = (filePath) => {
		if (visited.has(filePath)) return;
		visited.add(filePath);
		const source = readFileSync(filePath, "utf8");
		const imports = source.matchAll(
			/import\s+(?!type\b)(?:[\s\S]*?\sfrom\s+)?["']([^"']+)["']/g,
		);

		for (const [, specifier] of imports) {
			if (!specifier.startsWith("@/") && !specifier.startsWith(".")) continue;
			const importedFile = resolveLocalImport(filePath, specifier);
			if (importedFile) visit(importedFile);
		}
	};

	visit(resolve(projectRoot, entryPath));
	return [...visited];
};

describe("authenticated application boundary", () => {
	it("keeps signed-out users on a hero-only home page and redirects signed-in users", () => {
		const source = readSource("src/app/page.tsx");

		assert.match(source, /getServerSession\(authOptions\)/);
		assert.match(
			source,
			/if \(session\?\.user\)\s*redirect\(["']\/calendar["']\)/,
		);
		assert.match(source, /<AuthControls\s*\/>/);
		assert.doesNotMatch(source, /<Calendar\b/);
		assert.doesNotMatch(source, /calendar\/calendar/);
	});

	it("protects /calendar and passes only the authenticated user ID to Calendar", () => {
		const source = readSource("src/app/calendar/page.tsx");

		assert.match(source, /const userId = session\?\.user\?\.id/);
		assert.match(source, /if \(!userId\)\s*redirect\(["']\/["']\)/);
		assert.match(source, /onboardingCompletedForUser\(userId\)/);
		assert.match(source, /redirect\(["']\/onboarding["']\)/);
		assert.match(source, /<Calendar userId=\{userId\}\s*\/>/);
	});

	it("protects onboarding and redirects completed users back to the calendar", () => {
		const source = readSource("src/app/onboarding/page.tsx");

		assert.match(source, /getServerSession\(authOptions\)/);
		assert.match(source, /if \(!userId\) redirect\(["']\/["']\)/);
		assert.match(source, /onboardingCompletedForUser\(userId\)/);
		assert.match(source, /redirect\(["']\/calendar["']\)/);
		assert.match(source, /<OnboardingForm\s*\/>/);
	});

	it("uses persisted calendar data without mock or request fallbacks", () => {
		const source = readSource("src/modules/components/calendar/calendar.tsx");

		assert.match(source, /getCalendarForUser\(userId\)/);
		assert.match(source, /events=\{events\}/);
		assert.match(source, /tasks=\{tasks\}/);
		assert.match(source, /persistenceEnabled/);
		assert.doesNotMatch(source, /getEvents|getTasks|getUsers|requests|mocks/);
	});

	it("keeps mock data out of the authenticated runtime import graph", () => {
		const imports = collectRuntimeImports("src/app/calendar/page.tsx");
		const forbiddenImports = imports.filter((path) =>
			/(?:\/mocks|\/requests)\.(?:ts|tsx)$/.test(path),
		);

		assert.deepEqual(forbiddenImports, []);
	});

	it("uses /calendar as the Google sign-in callback and / as sign-out callback", () => {
		const source = readSource("src/modules/auth/auth-controls.tsx");

		assert.match(
			source,
			/signIn\(["']google["'],\s*\{\s*callbackUrl:\s*["']\/calendar["']\s*\}\)/,
		);
		assert.match(source, /signOut\(\{\s*callbackUrl:\s*["']\/["']\s*\}\)/);
	});
});
