# Eurekaimer Blog

An [Astro](https://astro.build/) static site based on [Firefly](https://github.com/CuteLeaf/Firefly), which derives from [fuwari](https://github.com/saicaca/fuwari), published at <https://www.eurekaimer.icu/blog/>.

## Features

- Long-form Markdown and MDX posts with categories, tags, RSS, and Pagefind search.
- Publication-based archives that can also show a later modification date without disturbing chronology.
- Post cards show the modification date alongside the publication date when the post was updated later.
- Short-form posts, photo galleries with a lightbox, and Bangumi collection pages.
- Steam library and playtime statistics backed by historical snapshots.
- Friends, guestbook, sponsor, and About pages, plus generated Open Graph images.
- Light and dark themes with switchable banner and layout modes.
- Inline `==highlighted==` marks rendered as semantic highlights in both themes.

Steam trend windows summarize the nearest available snapshots rather than fixed 7- or 30-day ranges.

## Automation

- [Deploy workflow](.github/workflows/deploy.yml): builds and deploys to GitHub Pages on `master` pushes, scheduled runs, or manual dispatch.
- [Build workflow](.github/workflows/build.yml): builds Astro for `master` pushes and pull requests.
- [Snapshot workflow](.github/workflows/update-snapshots.yml): refreshes Steam history and Bangumi manga snapshots, then commits the updated data files. Its schedule, `10 16 */4 * *`, runs every fourth day-of-month at 16:10 UTC (days 1, 5, 9, and so on), not daily or at a guaranteed 96-hour interval.
- [Quality workflow](.github/workflows/biome.yml): currently reports that checks are disabled; it does not run quality checks.

## Contributing

See [AGENTS.md](AGENTS.md) for contribution rules and [project memory](agents/memory.md) for established requirements and deferred work. Commits use English Conventional Commit subjects, one concern per commit.

## License

The project uses the [MIT License](LICENSE), copyright 2024 saicaca. Retain the license and upstream copyright notices when redistributing it.
