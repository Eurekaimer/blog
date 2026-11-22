import languageConfig from "@config/content-languages.toml?raw";
import { type CollectionEntry, getCollection } from "astro:content";
import { z } from "astro/zod";
import { parse } from "smol-toml";

export type LanguageLinks = { zh: string; en: string };

const pathSchema = z.string().refine((path) => path.trim().length > 0, {
	error: ({ input }) => `Expected a nonempty path, got ${JSON.stringify(input)}`,
});
const pairSchema = z.strictObject({ zh: pathSchema, en: pathSchema });
const configSchema = z.strictObject({
	about: pairSchema,
	posts: z.array(pairSchema).default([]),
});

function configError(message: string): Error {
	return new Error(`config/content-languages.toml: ${message}`);
}

function readConfig() {
	let parsed: unknown;
	try {
		parsed = parse(languageConfig);
	} catch (error) {
		throw configError(error instanceof Error ? error.message : String(error));
	}

	const result = configSchema.safeParse(parsed);
	if (!result.success) {
		const { path, message } = result.error.issues[0];
		const field = path
			.map((part, i) =>
				typeof part === "number" ? `[${part}]` : `${i ? "." : ""}${String(part)}`,
			)
			.join("");
		throw configError(field ? `${field}: ${message}` : message);
	}
	return result.data;
}

const config = readConfig();
type LanguageEntry = CollectionEntry<"spec" | "posts" | "postTranslations">;

function byFilePath<T extends LanguageEntry>(entries: T[]): Map<string, T> {
	const index = new Map<string, T>();
	for (const entry of entries) {
		if (entry.filePath) index.set(entry.filePath, entry);
	}
	return index;
}

function requireEntry<T extends LanguageEntry>(
	entries: ReadonlyMap<string, T>,
	path: string,
	field: string,
): T {
	const entry = entries.get(path);
	if (!entry) throw configError(`${field}: no collection entry for ${JSON.stringify(path)}`);
	if (entry.collection !== "posts" && !entry.body?.trim()) {
		throw configError(`${field}: empty body in ${JSON.stringify(path)}`);
	}
	return entry;
}

export async function getAboutTranslations(): Promise<{
	zh: CollectionEntry<"spec">;
	en: CollectionEntry<"spec">;
}> {
	const { zh, en } = config.about;
	if (zh === en) throw configError(`about.en: reuses about.zh path ${JSON.stringify(en)}`);
	const entries = byFilePath(await getCollection("spec"));
	return {
		zh: requireEntry(entries, zh, "about.zh"),
		en: requireEntry(entries, en, "about.en"),
	};
}

export async function getPostTranslations(): Promise<
	ReadonlyMap<string, CollectionEntry<"postTranslations">>
> {
	const [originals, translations] = await Promise.all([
		getCollection("posts").then(byFilePath),
		getCollection("postTranslations").then(byFilePath),
	]);
	const paired = new Map<string, CollectionEntry<"postTranslations">>();
	const registered = new Set<string>();
	for (const [index, { zh, en }] of config.posts.entries()) {
		const field = `posts[${index}]`;
		for (const [lang, path] of Object.entries({ zh, en })) {
			if (registered.has(path)) {
				throw configError(`${field}.${lang}: duplicate path ${JSON.stringify(path)}`);
			}
			registered.add(path);
		}
		const original = requireEntry(originals, zh, `${field}.zh`);
		paired.set(original.id, requireEntry(translations, en, `${field}.en`));
	}
	return paired;
}
