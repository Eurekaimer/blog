import assert from "node:assert/strict";
import { parse } from "node-html-parser";

const base = new URL(process.argv[2] || "http://127.0.0.1:4321/blog/");
if (!base.pathname.endsWith("/")) base.pathname += "/";
const galleryUrl = new URL("gallery/", base);

async function page(url) {
	const response = await fetch(url);
	assert.equal(response.status, 200, `Expected HTTP 200 at ${url}`);
	return parse(await response.text());
}

const gallery = await page(galleryUrl);
for (const card of gallery.querySelectorAll("a.album-card[href]")) {
	const albumUrl = new URL(card.getAttribute("href"), galleryUrl);
	const album = await page(albumUrl);
	const backLink = album.querySelector("main a[href]");
	assert.ok(backLink, `Album must provide return navigation at ${albumUrl}`);
	const returnUrl = new URL(backLink.getAttribute("href"), albumUrl);
	await page(returnUrl);
	assert.equal(
		returnUrl.pathname,
		galleryUrl.pathname,
		`Album must return to the gallery under the configured base at ${albumUrl}`,
	);
}

console.log("Gallery album return navigation checks passed.");