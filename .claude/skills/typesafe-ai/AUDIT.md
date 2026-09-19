# Provenance

`SKILL.md` and `LICENSE` are byte-identical copies from
[typesafe-ai/skills](https://github.com/typesafe-ai/skills) (MIT), adopted
unmodified on 2026-09-18 after a red-team pass.

| | |
| --- | --- |
| Source commit | `65a39f393687675ce170e6094757de20370365b9` (tag `v0.5.7`) |
| `SKILL.md` sha256 | `71ea90d7906c6554c4f4c460ef7361b2d26f59116ccdae986dc6d997b9389f52` |
| Install method | manual copy, project-local only |

Verify: `shasum -a 256 .claude/skills/typesafe-ai/SKILL.md`

## Why a manual copy, not the plugin

- `claude plugin marketplace add typesafe-ai/skills` tracks `main` with no ref
  pin, and the docs encourage auto-update. That breaks pin-to-what-was-audited.
- `npx skills add` runs an unpinned third-party CLI that was not audited.

Bumps are deliberate: re-clone, re-run the byte scan, diff against this copy,
update the commit and hash above.

## Audit findings (2026-09-18)

- Repo is six files; no scripts, hooks, MCP servers, commands, or executables.
- Byte scan: no zero-width, bidi, tag, or control characters; no HTML comments.
- Content is design guidance only. It never tells the agent to run commands,
  read secrets, or install anything.
- **Accepted risk:** the skill directs the agent to read live pages on
  `docs.typesafe.ai`, which are mutable and unpinnable. Acceptable in this
  sandbox (nothing sensitive in reach). Revisit before using the skill anywhere
  with broader permissions or unattended agents.
- Do not follow the Python cookbooks' `pip install ... --extra-index-url
  https://pypi.typesafe.ai/` lines (dependency-confusion pattern).

## SDK

`@typesafe-ai/sdk` is pinned to exactly `0.6.0` in `package.json`. Tarball
audited without installing: hash matches registry, SLSA provenance attested,
zero dependencies, no install scripts, no fs/child_process/eval, only network
call is `fetch` to `https://api.typesafe.ai`. `TYPESAFE_BASE_URL` in the
environment can redirect requests (and the bearer key), so `lib/client.ts`
hardcodes `baseURL`.
