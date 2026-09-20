import assert from "node:assert/strict";
import { parse } from "node-html-parser";

const base = new URL(process.argv[2] || "http://127.0.0.1:4321/blog/");
if (!base.pathname.endsWith("/")) base.pathname += "/";
const encoded = "SSBmZWx0IHRoYXQgdGhlIHRlYWNoZXJzIGFyb3VuZCBtZSB3ZXJlIGFsbCBpbmNvbXBldGVudCBhbmQgdGhhdCBJIGNvdWxkIGxlYXJuIG5vdGhpbmcgZnJvbSB0aGVtLg==";

async function page(path) {
	const url = new URL(path, base);
	try {
		const response = await fetch(url);
		assert.equal(response.status, 200, `Expected HTTP 200 at ${url}`);
		return parse(await response.text());
	} catch (error) {
		throw new Error(`Content check failed at ${url}: ${error.message}`, { cause: error });
	}
}

const annual = await page("posts/summary/2025年度总结/");
const note = annual.querySelectorAll('details[data-callout="note"]').find(
	(element) => element.querySelector("summary")?.textContent.includes("Base64"),
);
assert.ok(note, "Annual summary must contain the selected Base64 note");
assert.ok(!note.hasAttribute("open"), "Selected note must start collapsed");
assert.ok(note.textContent.includes(encoded), "Selected note must retain the exact encoded comment");
console.log("Rendered post content checks passed.");
