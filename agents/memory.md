# Project memory

## User requirements

- Correct Chinese/English prose spacing and unambiguous spelling/casing in context. Ask about uncertain terms instead of guessing. Preserve proper names, opinions, code, math, URLs, file paths, identifiers, and image links. Presentation-only edits must not change publication or modification dates.
- Only the second item of the opening frustrating-moments callout in `content/posts/summary/2025年度总结.md` is obscured. Its English translation is UTF-8 Base64 inside a default-collapsed `[!note]-`. Per the revised request, do not display an encoding label, explanatory text, or code language. No decoding UI. Do not store the original or translated plaintext here. This is reversible obfuscation, not confidentiality or history removal.
- Other opinions, classmates, schools, departments, and majors remain visible. In particular, do not obscure passages in the Linux anniversary or second-year spring summary. Article test passwords were removed; optional encryption support remains.
- Retain pnpm 9.14.4 and the locked dependency graph. No incidental upgrades.
- Root README is formal English. New commits need English `type(scope): summary` subjects, substantive English bodies, and one concern per commit.
- The user approved the archive design and explicitly authorized commit and push after verification, superseding the earlier visual-review push gate. Preserve a local preview for inspection. Obtain authorization again for unrelated future pushes.
- The approved authoring layout is root `content/posts/`, `content/moments/`, and `content/spec/`. Preserve collection-relative paths and public routes. Gallery images remain in `public/gallery/` and metadata in `src/config/galleryConfig.ts`; do not migrate them or create a separate photo-wall data copy without approval.
- Keep agent documentation in the visible root `agents/` directory, not a dot-prefixed directory, and track it together with `AGENTS.md`.

## Architecture and verification

- `src/content.config.ts` defines Astro collections and root-content loaders. `scripts/new-post.js` and `_frontmatter.json` use `content/posts/`.
- `src/pages/posts/[...slug].astro` renders articles; `src/utils/content-utils.ts` supplies collection data. Nested relative cover images must resolve from root content in article pages, cards, and sharing metadata, not only from `src/`. Inline Markdown images use Astro's asset handling.
- `src/pages/moments.astro` derives short-form dates from filenames; `src/pages/about.astro` loads `content/spec/about.md`.
- `src/components/controls/ArchivePanel.svelte` preserves publication-based ordering, year grouping, and the left `MM-DD` marker. Only an `updated` date strictly later than `published` appears as muted full-date metadata beside the timeline/title, including mobile. Reuse `I18nKey.updatedAt` and `formatDateToYYYYMMDD`; use semantic dates and accessible descriptions. No filesystem or Git timestamp fallback.
- `pnpm test:content` checks real rendered article pages; the server must be running. `pnpm test:authoring` tests nested creation and overwrite protection in temporary directories. `pnpm test:data` covers Steam-history behavior. Use browser evidence for archive hydration, filters, themes, keyboard navigation, and mobile layout.
- `pnpm build` runs icon generation, local koma-bell synchronization, Steam refresh, Astro, and Pagefind. For non-preprocessing verification use `pnpm astro build` then `pnpm exec pagefind --site dist`; network integrations may still run. Never commit credentials or incidental generated snapshots.

## Deferred work

These are not implemented by the current pass. Review leads originated in static inspection and older ignored build artifacts unless runtime evidence is explicitly noted.

- [ ] Restrict `archive.astro` client-island props to id/title/tags/category/published/updated. It currently forwards full `post.data`; removing current passwords does not eliminate the structural private-frontmatter exposure risk.
- [ ] Broader agent skills/harness, engineering review, CI test execution, and reproducible-install improvements. Existing authoring/content checks and these concise rules are not a full harness or CI redesign.
- [ ] Reconcile stale upstream `public/robots.txt` with the generated robots route. The current production build confirmed that the public file causes Astro to skip the generated route.
- [ ] Review base-unsafe sitemap/RSS URLs and local-time publication-date discrepancies.
- [ ] Reconcile duplicate manga-snapshot writers and Steam refresh warnings that do not fail CI.

## Engineering principles

Test observable behavior and meaningful boundaries; use red/green/refactor for bug fixes. Prefer clear names and existing patterns over new abstractions. Isolate side effects, avoid unrelated formatting, and remove throwaway fixtures after smoke tests.

References: [TDD](https://martinfowler.com/bliki/TestDrivenDevelopment.html), [TDD cycles](https://blog.cleancoder.com/uncle-bob/2014/12/17/TheCyclesOfTDD.html), [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).
