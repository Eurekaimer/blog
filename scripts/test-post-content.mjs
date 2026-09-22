import assert from "node:assert/strict";
import { parse } from "node-html-parser";

const base = new URL(process.argv[2] || "http://127.0.0.1:4321/blog/");
if (!base.pathname.endsWith("/")) base.pathname += "/";
const encoded =
	"SSBmZWx0IHRoYXQgdGhlIHRlYWNoZXJzIGFyb3VuZCBtZSB3ZXJlIGFsbCBpbmNvbXBldGVudCBhbmQgdGhhdCBJIGNvdWxkIGxlYXJuIG5vdGhpbmcgZnJvbSB0aGVtLg==";

async function page(path) {
	const url = new URL(path, base);
	try {
		const response = await fetch(url);
		assert.equal(response.status, 200, `Expected HTTP 200 at ${url}`);
		return parse(await response.text());
	} catch (error) {
		throw new Error(`Content check failed at ${url}: ${error.message}`, {
			cause: error,
		});
	}
}

const annual = await page("posts/summary/2025年度总结/");
const note = annual
	.querySelectorAll('details[data-callout="note"]')
	.find((element) => element.textContent.includes(encoded));
assert.ok(note, "Annual summary must contain the selected personal note");
assert.ok(!note.hasAttribute("open"), "Selected note must start collapsed");
assert.doesNotMatch(
	note.textContent,
	/base64|编码/i,
	"Selected note must not explain its encoding",
);
for (const slug of ["2024总结", "2025寒假总结", "大二下学期总结"]) {
	const document = await page(`posts/summary/${slug}/`);
	const body = document.querySelector("#post-container .custom-md");
	assert.ok(body, `${slug}: directly readable article body is required`);
	for (let element = body; element; element = element.parentNode) {
		assert.ok(
			!element.hasAttribute?.("hidden") &&
				!element.classList?.contains("hidden"),
			`${slug}: article body must not be hidden`,
		);
	}
	assert.equal(
		document.querySelector(
			'#encrypted-container, #password-ui, input[type="password"]',
		),
		null,
		`${slug}: obsolete password UI must be absent`,
	);
}

console.log("Rendered post content checks passed.");
