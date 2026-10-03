/** @param {string} id */
export function parseMomentDate(id) {
	const filename = id.split("/").pop()?.replace(/\.mdx?$/, "") ?? id;
	const match = filename.match(/^(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})$/);
	if (!match) return new Date(0);
	const [, year, month, day, hour, minute] = match;
	return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
}

/**
 * Select activity without changing publication-based post ordering.
 * @param {ReadonlyArray<{data: {published: Date, updated?: Date}}>} posts
 * @param {ReadonlyArray<{id: string}>} moments
 * @returns {Date | null}
 */
export function getLastActivityDate(posts, moments) {
	let latest = null;
	for (const { data } of posts) {
		if (!latest || data.published > latest) latest = data.published;
		if (data.updated && data.updated > latest) latest = data.updated;
	}
	for (const { id } of moments) {
		const date = parseMomentDate(id);
		if (!latest || date > latest) latest = date;
	}
	return latest;
}
