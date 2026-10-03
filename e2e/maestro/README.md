# Maestro e2e flows — ArtiosCAD R12 render regressions

These flows guard against the ArtiosCAD-exported R12 DXF failure mode where
the drawing parses completely but the three.js scene only receives a fraction
of the entities (blank/black canvas in the viewer).

## What they assert

The example app exposes a dev-only hook: opening the app with `?fixture=<url>`
loads that file through the exact same code path as the upload dialog and
shows a status line (bottom-left, monospace):

```
e2e: file=artioscad-hop-cung.dxf entities=142 rendered=142 pending=false
```

- `entities` — model-space entities in the parsed database
- `rendered` — entities converted into the three.js scene
- `pending` — scene batch conversion still in progress

The flows fail unless `rendered` equals `entities`, which is precisely the
signal that every parsed entity made it to the render scene. Production
builds never activate the hook (`import.meta.env.DEV` guard).

## Running

1. Start the dev server (from the repo root):

   ```sh
   pnpm dev
   ```

2. Run a flow (Maestro CLI, web beta — downloads its own managed Chromium on
   first run):

   ```sh
   maestro test e2e/maestro/artioscad-hop-cung.yaml
   maestro test e2e/maestro/artioscad-hop-tay-gai-nap-gai.yaml
   ```

   Point the flows at a different origin with:

   ```sh
   maestro test -e MAESTRO_BASE_URL=http://localhost:5273 e2e/maestro/artioscad-hop-cung.yaml
   ```

## Fixtures

Real ArtiosCAD exports live in `packages/cad-viewer-example/public/e2e/` and
are served by Vite at `/e2e/<name>.dxf`:

- `artioscad-hop-cung.dxf` — 142 entities (110 Line, 4 Arc, 8 RotatedDimension, 20 AlignedDimension), layer `Annotation`
- `artioscad-hop-tay-gai-nap-gai.dxf` — 99 entities (95 Line, 4 Arc), layer `Design`
