/**
 * Copies hand-maintained public API declarations from `typings/` into `lib/`.
 *
 * Why not `tsc` like the other export plugins?
 * - `package.json` exposes types at `lib/index.d.ts` and `lib/register.d.ts`.
 * - Running `tsc` or `vue-tsc` over this package pulls in the `ai` / `@ai-sdk/*`
 *   dependency graph, which is large enough to hang or OOM during declaration emit.
 * - `vite-plugin-dts` hit the same memory limit in practice.
 *
 * Instead we keep a small, curated surface in `typings/` (only what consumers
 * need) and copy it here before `vite build`. Update those files when the
 * public API changes.
 */
import { copyFileSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'

// Node's native recursive cpSync (cpSyncCopyDir) fails with EACCES on
// virtiofs bind mounts (Apple container), so copy file-by-file instead.
rmSync('lib', { recursive: true, force: true })
mkdirSync('lib', { recursive: true })
for (const entry of readdirSync('typings', { recursive: true })) {
  const src = join('typings', entry)
  if (statSync(src).isFile()) {
    mkdirSync(dirname(join('lib', entry)), { recursive: true })
    copyFileSync(src, join('lib', entry))
  }
}
