import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("./new-post.js", import.meta.url));

function workspace(t) {
	const root = mkdtempSync(path.join(tmpdir(), "blog-authoring-"));
	t.after(() => rmSync(root, { recursive: true, force: true }));
	return root;
}

function create(root, filename) {
	return spawnSync(process.execPath, [script, filename], {
		cwd: root,
		encoding: "utf8",
	});
}

test("creates a nested MDX article in the root content directory", (t) => {
	const root = workspace(t);
	const result = create(root, "notes/写作.mdx");
	assert.equal(result.status, 0, result.stderr);
	const article = readFileSync(path.join(root, "content/posts/notes/写作.mdx"), "utf8");
	assert.match(article, /^---\r?\n[\s\S]*\r?\n---\r?\n/);
});

test("refuses to overwrite an existing Markdown article", (t) => {
	const root = workspace(t);
	assert.equal(create(root, "notes/existing").status, 0);
	const destination = path.join(root, "content/posts/notes/existing.md");
	const original = "---\ntitle: Existing article\n---\nAuthor changes must survive.\n";
	writeFileSync(destination, original);
	const result = create(root, "notes/existing");
	assert.notEqual(result.status, 0);
	assert.equal(readFileSync(destination, "utf8"), original);
});
