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

for (const path of [
	"posts/summary/2025年度总结/",
	"posts/summary/2025年度总结/en/",
]) {
	const annual = await page(path);
	const note = annual
		.querySelectorAll('details[data-callout="note"]')
		.find((element) => element.textContent.includes(encoded));
	assert.ok(note, `${path}: must contain the selected personal note`);
	assert.ok(!note.hasAttribute("open"), `${path}: note must start collapsed`);
	assert.doesNotMatch(
		note.textContent,
		/base64|encod(?:e|ed|ing)|编码/i,
		`${path}: note must not explain its encoding`,
	);
}

const anniversary = "posts/summary/linux-使用一周年纪念/";
const paths = [anniversary, `${anniversary}en/`];
const versions = await Promise.all(paths.map(page));
const languages = versions.map((document) =>
	document.querySelector("html")?.getAttribute("lang"),
);
assert.deepEqual(languages, ["zh-CN", "en"]);

const [zhTitle, enTitle] = versions.map((document) =>
	document.querySelector("title")?.textContent.trim(),
);
assert.ok(zhTitle && enTitle && zhTitle !== enTitle, "Titles must be localized");

const dates = versions.map((document, i) => {
	const path = paths[i];
	const target = 1 - i;
	assert.ok(
		document.querySelector("#post-container .custom-md")?.textContent.trim(),
		`${path}: readable article body is required`,
	);
	const link = document.querySelector("#post-container nav a[hreflang]");
	assert.ok(link, `${path}: missing language link`);
	assert.equal(link.getAttribute("hreflang"), languages[target], path);
	assert.equal(
		new URL(link.getAttribute("href"), base).pathname,
		new URL(paths[target], base).pathname,
		path,
	);

	const jsonLd = document.querySelector('script[type="application/ld+json"]');
	assert.ok(jsonLd, `${path}: structured data is required`);
	const { datePublished, inLanguage } = JSON.parse(jsonLd.textContent);
	assert.ok(datePublished, `${path}: publication date is required`);
	assert.equal(inLanguage, languages[i], path);
	return datePublished;
});
assert.equal(dates[0], dates[1]);

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
