# CAD Viewer agent guide

This is the browser-based CAD viewer workspace. Read [README.md](README.md) and the affected package documentation before editing. Preserve existing TypeScript/Vue and package/plugin boundaries, drawing geometry/units, rendering and export compatibility, browser privacy, MIT/upstream attribution and license notices. Do not add a backend or upload drawings to an external service without an explicit product decision.

Tool versions and commands are owned by [package.json](package.json): Node >=24, pnpm 10.33.4. Use the existing lockfile. Relevant checks include `pnpm lint`, `pnpm build`, `pnpm test`, `pnpm test:e2e`, and `pnpm docs:build`; choose checks for the changed surface. Browser/geometry changes need meaningful fixture, rendered scene and export evidence; a parsed drawing or green compile is insufficient. See [rendering regression guidance](e2e/maestro/README.md).

Preserve unrelated changes, keep public API changes intentional, and avoid speculative dependencies/refactors. Use synthetic/permitted drawing fixtures; never commit private drawings or secrets. Release/package publication requires explicit authorization and separate checks. Report executed checks and missing runtime proof honestly.

## Maintaining AI engineering guidance

At the first repository task each month (Asia/Ho_Chi_Minh), follow [the monthly practice review](docs/engineering-practices.md#monthly-ai-engineering-practice-review), starting with claude.dev. Apply justified improvements to this contract and canonical docs; existing product, privacy, licensing and release rules remain mandatory. This is an entry check, not a background scheduler.

For long-task interruption/compaction use [resume checkpoints](docs/engineering-practices.md#resuming-agent-work) and verify actual state on return. Claimed prompt/skill/workflow gains require [independent evaluation](docs/engineering-practices.md#evaluating-guidance-changes); no performance gain is implied by this documentation change.
