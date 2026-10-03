import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { parse } from "node-html-parser";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { remarkHighlight } from "../src/plugins/remark-highlight.js";

const require = createRequire(import.meta.url);
const astroRequire = createRequire(require.resolve("astro"));
const { createMarkdownProcessor } = await import(
	astroRequire.resolve("@astrojs/markdown-remark")
);
const compiler = await createMarkdownProcessor({
	syntaxHighlight: false,
	remarkPlugins: [remarkMath, remarkHighlight],
	rehypePlugins: [rehypeKatex],
});

async function render(markdown) {
	return parse((await compiler.render(markdown)).code, {
		blockTextElements: { script: true, noscript: true, style: true },
	});
}

const inline = await render(
	"==中文高亮== 与 ==**加粗**、*斜体*、~~删除~~及 [链接](https://example.test/?q==kept==)==。",
);
assert.deepEqual(
	inline.querySelectorAll("mark").map((mark) => mark.textContent),
	["中文高亮", "加粗、斜体、删除及 链接"],
);
assert.equal(inline.querySelector("mark strong").textContent, "加粗");
assert.equal(inline.querySelector("mark em").textContent, "斜体");
assert.equal(inline.querySelector("mark del").textContent, "删除");
assert.equal(inline.querySelector("mark a").textContent, "链接");
assert.equal(
	inline.querySelector("mark a").getAttribute("href"),
	"https://example.test/?q==kept==",
);

const nested = await render(
	"**外层 ==内部==** 与 [==链接文字==](https://example.test/) 与 ==外层 `==代码==`==",
);
assert.equal(nested.querySelector("strong mark").textContent, "内部");
assert.equal(nested.querySelector("a mark").textContent, "链接文字");
assert.equal(nested.querySelector("mark code").textContent, "==代码==");
assert.equal(nested.querySelector("mark mark"), null);

const wrapped = await render("==第一行\n第二行==");
assert.equal(wrapped.querySelector("mark").textContent, "第一行\n第二行");

for (const markdown of [
	"==unclosed",
	"unopened==",
	"====",
	"== ==",
	"==\t==",
	"==\u3000==",
	"==&#32;==",
	"==&nbsp;==",
	"===unequal==",
	"==unequal===",
	"===long===",
	"=single=",
	"==first\n\nsecond==",
	"==first\n\n> second==",
	"- ==first\n- second==",
	String.raw`\==escaped==`,
	String.raw`==escaped\==`,
	String.raw`\=\=escaped\=\=`,
]) {
	const document = await render(markdown);
	assert.equal(
		document.querySelector("mark"),
		null,
		`Must not create a highlight for ${JSON.stringify(markdown)}`,
	);
}

const escaped = await render(String.raw`\==literal== and ==actual==`);
assert.equal(escaped.querySelector("p").textContent, "==literal== and actual");
assert.deepEqual(
	escaped.querySelectorAll("mark").map((mark) => mark.textContent),
	["actual"],
);

const protectedSyntax = await render([
	"`==inline code==`",
	"",
	"```text",
	"==fenced code==",
	"```",
	"",
	"    ==indented code==",
	"",
	"$x == y$",
	"",
	"$$",
	"a == b",
	"$$",
	"",
	'[destination](https://example.test/==path==?q===value "==title==")',
	"",
	"https://example.test/?q==bare==",
	"",
	'<span data-label="==attribute==">HTML text</span>',
	"",
	"==visible==",
].join("\n"));
assert.deepEqual(
	protectedSyntax.querySelectorAll("mark").map((mark) => mark.textContent),
	["visible"],
);
assert.deepEqual(
	protectedSyntax.querySelectorAll("code").map((code) => code.textContent.trim()),
	["==inline code==", "==fenced code==", "==indented code=="],
);
assert.deepEqual(
	protectedSyntax.querySelectorAll("annotation").map((node) => node.textContent),
	["x == y", "a == b"],
);
assert.deepEqual(
	protectedSyntax.querySelectorAll("a").map((link) => link.getAttribute("href")),
	[
		"https://example.test/==path==?q===value",
		"https://example.test/?q==bare==",
	],
);
assert.equal(protectedSyntax.querySelector("a").getAttribute("title"), "==title==");
assert.equal(
	protectedSyntax.querySelector("span[data-label]").getAttribute("data-label"),
	"==attribute==",
);

console.log("Astro Markdown highlight checks passed.");
