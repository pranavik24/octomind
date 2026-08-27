import { pathToFileURL } from "node:url";

const sourceRoot = pathToFileURL(`${process.cwd()}/src/`).href;

export async function resolve(specifier, context, nextResolve) {
	if (specifier.startsWith("@/")) {
		return nextResolve(`${sourceRoot}${specifier.slice(2)}.ts`, context);
	}
	return nextResolve(specifier, context);
}
