# Eurekaimer Blog

An [Astro](https://astro.build/) static site based on [Firefly](https://github.com/CuteLeaf/Firefly), which derives from [fuwari](https://github.com/saicaca/fuwari).

The site is configured at <https://www.eurekaimer.icu/blog/> with the `/blog` base path and trailing slashes.

## Features

- Posts, publication-based archives, categories, tags, RSS, and Pagefind search.
- Optional archive modification dates, displayed without changing publication chronology.
- Short-form posts, Bangumi collections, and photo galleries.
- Steam library and playtime statistics with historical snapshots.
- Bangumi manga-progress synchronization, including local koma-bell state.

Steam trend windows use recent snapshots, not necessarily 7 or 30 calendar days.

## Requirements and setup

Use Node.js **22.12.0 or later** and **pnpm 9.14.4**. Astro is pinned to 6.0.8; retain the existing lockfile.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open the development server at `/blog/`.

```sh
pnpm build
pnpm preview
```

`pnpm build` generates icons, synchronizes local koma-bell manga progress, refreshes Steam history, builds Astro, and indexes the output with Pagefind. It can rewrite tracked icon/data files and access sibling project state or network services. Review generated changes before committing.

For a production build without those preprocessing steps:

```sh
pnpm astro build
pnpm exec pagefind --site dist
pnpm preview --host 127.0.0.1 --port 4321
```

Astro may still fetch external integrations. This is not an offline build.

## Content and configuration

- Create an article with `pnpm new-post <filename>`; nested names are supported. Articles live in `content/posts/`.
- Short-form posts live in `content/moments/`.
- Standalone content, including the About page, lives in `content/spec/`.
- Gallery metadata is configured in `src/config/galleryConfig.ts`; images live in `public/gallery/<album-id>/`.
- Site settings and integration identifiers live in `src/config/siteConfig.ts`.

The root `content/` directory is the authoring entry point. Rendering code, components, and collection schemas remain in `src/`; gallery storage is unchanged. Moving an article between these authoring roots is not a URL-management mechanism: preserve its collection-relative path to preserve its public URL.

Use [`.env.example`](.env.example) as the template for an ignored `.env.local`. Never commit credentials.

Steam requires `STEAM_API_KEY` and `siteConfig.steam.steamId`. Configure the matching `STEAM_API_KEY` repository secret for GitHub Actions. `pnpm steam:history` refreshes `src/data/steam-history.json`.

Configure `siteConfig.bangumi.userId` for Bangumi collections. The snapshot workflow accepts `BANGUMI_USER_ID` as an Actions secret or variable, with the site configuration as its fallback. `pnpm manga:sync` reads local koma-bell subscriptions/state; its default project directory is the sibling `../koma-bell`, configurable through `KOMA_BELL_DIR`.

## Verification

```sh
pnpm check
pnpm test:data
pnpm test:authoring
# Start the development server or production preview before this command:
pnpm test:content
```

`test:data` checks Steam-history behavior. `test:content` fetches rendered article pages and checks the selected collapsed comment and directly readable articles. Its default base URL is `http://127.0.0.1:4321/blog/`; override it with `pnpm test:content <base-url>`. Unreachable pages and non-200 responses fail the check.

`test:authoring` runs isolated Node tests for nested article creation in `content/posts/` and protection against overwriting existing articles.

Archive layout and navigation changes also require real-browser verification at desktop and mobile widths in light and dark modes. `pnpm lint` and `pnpm format` **write files**; they are not read-only verification commands.

## Automation

- [Deploy workflow](.github/workflows/deploy.yml): builds and deploys to GitHub Pages on `master` pushes, scheduled runs, or manual dispatch.
- [Build workflow](.github/workflows/build.yml): builds Astro for `master` pushes and pull requests.
- [Snapshot workflow](.github/workflows/update-snapshots.yml): updates Steam history and Bangumi manga snapshots. Its schedule, `10 16 */4 * *`, runs every fourth day-of-month at 16:10 UTC (days 1, 5, 9, and so on), not daily or at a guaranteed 96-hour interval.
- [Quality workflow](.github/workflows/biome.yml): currently reports that checks are disabled; it does not run quality checks.

## Contribution and license

See [AGENTS.md](AGENTS.md) for contribution rules and [project memory](agents/memory.md) for established requirements and deferred work.

The project uses the [MIT License](LICENSE). Retain the license and upstream copyright notices when redistributing it.
