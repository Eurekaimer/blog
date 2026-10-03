import assert from "node:assert/strict";
import { test } from "node:test";
import {
	getLastActivityDate,
	parseMomentDate,
} from "../src/utils/activity-utils.mjs";

const post = (published, updated) => ({
	data: {
		published: new Date(published),
		...(updated ? { updated: new Date(updated) } : {}),
	},
});

test("a newer article update advances activity without reordering posts", () => {
	const recent = post("2026-09-20T00:00:00Z");
	const revised = post("2025-01-01T00:00:00Z", "2026-09-29T00:00:00Z");
	const posts = Object.freeze([recent, revised]);
	assert.equal(
		getLastActivityDate(posts, []).toISOString(),
		"2026-09-29T00:00:00.000Z",
	);
	assert.deepEqual(posts, [recent, revised]);
});

test("missing, older, and equal updates retain publication activity", () => {
	for (const updated of [undefined, "2026-08-01T00:00:00Z", "2026-09-20T00:00:00Z"]) {
		assert.equal(
			getLastActivityDate([post("2026-09-20T00:00:00Z", updated)], []).toISOString(),
			"2026-09-20T00:00:00.000Z",
		);
	}
});

test("the newest activity wins across publications, updates, and moments", () => {
	const moments = [{ id: "2026-09-21-1943" }, { id: "2026-06-19-2130" }];
	const momentDate = new Date(2026, 8, 21, 19, 43);
	assert.equal(
		getLastActivityDate([post("2026-09-13T00:00:00Z", "2026-09-14T00:00:00Z")], moments).getTime(),
		momentDate.getTime(),
	);
	assert.equal(
		getLastActivityDate([post("2025-01-01T00:00:00Z", "2026-09-29T00:00:00Z")], moments).toISOString(),
		"2026-09-29T00:00:00.000Z",
	);
	assert.equal(
		getLastActivityDate([post("2026-09-30T00:00:00Z", "2026-09-29T00:00:00Z")], moments).toISOString(),
		"2026-09-30T00:00:00.000Z",
	);
});

test("moments keep their local-time filename date convention", () => {
	const expected = new Date(2026, 8, 21, 19, 43).getTime();
	for (const id of ["2026-09-21-1943", "nested/2026-09-21-1943.md", "nested/2026-09-21-1943.mdx"]) {
		assert.equal(parseMomentDate(id).getTime(), expected);
		assert.equal(getLastActivityDate([], [{ id }]).getTime(), expected);
	}
	assert.equal(parseMomentDate("undated").getTime(), 0);
});

test("empty activity has no date", () => {
	assert.equal(getLastActivityDate([], []), null);
});
