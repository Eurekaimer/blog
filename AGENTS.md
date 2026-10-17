# Contribution rules

Read [project memory](agents/memory.md) before changing content, architecture, or integrations.

- Use pnpm 9.14.4 and the existing lockfile. Do not upgrade dependencies or change package managers as incidental work.
- Keep authored posts, moments, and standalone content in root `content/`; keep rendering code in `src/`. Preserve collection-relative paths and public URLs. Gallery storage remains in `public/gallery/`.
- Respect existing edits and concurrent commits. Do not overwrite, bulk-stage, amend, or rewrite unrelated user work. Stage explicit paths only.
- Use English `type(scope): summary` commit subjects and substantive English bodies describing the change and exact verification. Keep one concern per commit.
- Push only with explicit user authorization. The user authorized pushing the current content, archive, documentation, and directory-migration work after verification; this is not blanket authorization for future tasks.
- For bugs, write a behavior-focused reproduction, observe failure, fix it, and verify success. Keep regression tests for meaningful boundaries, errors, and state changes; do not pin wording or implementation details.
- Run relevant checks: `pnpm test:authoring`, `pnpm test:data`, `pnpm check`, and `pnpm test:content` against a running server. Verify UI behavior in the actual browser, including mobile and light/dark themes.
- For a production smoke check without snapshot preprocessing, use `pnpm astro build`, `pnpm exec pagefind --site dist`, and `pnpm preview`. A full `pnpm build` can mutate tracked data and access local sibling state or network services.
- No bulk formatting. `pnpm lint` and `pnpm format` write files. Reuse existing patterns, name concepts clearly, isolate side effects, and remove temporary fixtures after verification.
- Keep Chinese prose typography consistent: use one space between CJK characters and Latin letters or digits, and one space between an inline Markdown link and adjacent CJK prose. Never insert a space before punctuation. Preserve code, mathematics, URLs, file paths, and proper names verbatim.
