/**
 * Dev-only e2e testability hooks. Never active in production builds.
 *
 * `?fixture=<url>` opens a drawing through the exact same code path as the
 * upload dialog, so flows that cannot drive native file choosers (Maestro,
 * CI browsers) can still exercise a real open. A fixed status element
 * reports database and scene entity counts as visible text so UI tests can
 * assert on load completeness without DOM access:
 *
 *   e2e: file=hop-cung.dxf entities=142 rendered=142 pending=false
 *
 * `entities` counts the parsed database (model space); `rendered` counts
 * entities converted into the three.js scene. A gap between the two is the
 * signal for render-path regressions.
 */
import {
  AcApDocManager,
  AcApOpenViewMode,
  AcEdOpenMode
} from '@mlightcad/cad-simple-viewer'
import {
  ACDB_DRAW_CIRCLE_SIDES_DRAFT,
  ACGI_PAPER_SPACE_BACKGROUND
} from '@mlightcad/data-model'

const E2E_STATUS_ID = 'e2e-status'
const POLL_INTERVAL_MS = 500
const REPORT_TIMEOUT_MS = 120_000

// Capture console warnings/errors from app boot onward (runs at import time,
// before any open), so e2e runs can surface swallowed open failures.
if (import.meta.env.DEV) {
  const w = window as Window & { __e2eLogs?: string[] }
  w.__e2eLogs = []
  const capture = (level: string, original: (...args: unknown[]) => void) =>
    (...args: unknown[]) => {
      w.__e2eLogs!.push(
        `${level}: ${args.map(a => String(a)).join(' ').slice(0, 300)}`
      )
      original(...args)
    }
  console.error = capture('E', console.error.bind(console))
  console.warn = capture('W', console.warn.bind(console))
}

export type E2EFileSelect = (
  file: File,
  mode: AcEdOpenMode,
  mainThreadDraw: boolean,
  showNoPlotLayers: boolean,
  enableProgressiveRendering: boolean,
  viewMode: AcApOpenViewMode | undefined,
  sides: number,
  paperBg: number,
  exportDisabled: boolean
) => void

function setE2EStatus(text: string) {
  let node = document.getElementById(E2E_STATUS_ID)
  if (!node) {
    node = document.createElement('div')
    node.id = E2E_STATUS_ID
    node.style.position = 'fixed'
    node.style.left = '8px'
    node.style.bottom = '32px'
    node.style.zIndex = '9999'
    node.style.font = '12px monospace'
    node.style.color = '#7CFC00'
    node.style.background = 'rgba(0, 0, 0, 0.55)'
    node.style.padding = '2px 6px'
    node.style.borderRadius = '4px'
    node.style.pointerEvents = 'none'
    document.body.appendChild(node)
  }
  node.textContent = text
}

function countDatabaseEntities(): number {
  const modelSpace =
    AcApDocManager.instance.curDocument?.database?.tables?.blockTable
      ?.modelSpace
  if (!modelSpace) return -1
  let count = 0
  for (const _entity of modelSpace.newIterator()) count++
  return count
}

function countRenderedEntities(): number {
  const view = (AcApDocManager.instance as {
    curView?: {
      cadScene?: {
        stats?: { summary?: { entityCount?: number } }
      }
    }
  }).curView
  const count = view?.cadScene?.stats?.summary?.entityCount
  return typeof count === 'number' ? count : -1
}

let probeCanvas: HTMLCanvasElement | null = null

/**
 * Measures non-background pixels of the last rendered frame. WebGL canvas
 * readback only works inside the render tick (preserveDrawingBuffer is
 * false), so this wraps the view's own render call and samples right after
 * each frame completes. Returns a getter for the latest ink measurement.
 */
function hookInkProbe(): () => number {
  const view = AcApDocManager.instance.curView as unknown as {
    renderer?: {
      domElement: HTMLCanvasElement
      // The app's render loop calls the wrapped three.js renderer directly,
      // so hook there rather than on the public AcTrRenderer.render.
      _renderer?: { render: (scene: unknown, camera: unknown) => void }
    }
  }
  const domElement = view?.renderer?.domElement
  const three = view?.renderer?._renderer
  if (!domElement || !three) return () => -1
  let lastInk = -1
  const original = three.render.bind(three)
  three.render = (scene: unknown, camera: unknown) => {
    original(scene, camera)
    try {
      const width = 480
      const height = Math.max(
        1,
        Math.round((domElement.height / domElement.width) * width)
      )
      probeCanvas ??= document.createElement('canvas')
      probeCanvas.width = width
      probeCanvas.height = height
      const ctx = probeCanvas.getContext('2d', { willReadFrequently: true })
      if (ctx) {
        ctx.drawImage(domElement, 0, 0, width, height)
        const { data } = ctx.getImageData(0, 0, width, height)
        let ink = 0
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] >= 200 && data[i] + data[i + 1] + data[i + 2] > 60) {
            ink++
          }
        }
        lastInk = ink
      }
    } catch {
      // keep the previous measurement
    }
  }
  return () => lastInk
}

function getMinInk(): number {
  const raw = new URLSearchParams(window.location.search).get('minInk')
  const n = raw == null ? NaN : Number(raw)
  return Number.isFinite(n) ? n : 0
}

function reportUntilSettled(fileName: string) {
  const startedAt = Date.now()
  let getInk: (() => number) | null = null
  let frameRequested = false
  let retried = false
  const timer = setInterval(() => {
    const entities = countDatabaseEntities()
    const rendered = countRenderedEntities()
    const view = AcApDocManager.instance.curView as unknown as {
      isProcessingEntities?: boolean
      isConvertingEntities?: boolean
      renderer?: unknown
    }
    const pending =
      view?.isProcessingEntities === true || view?.isConvertingEntities === true
    if (
      view?.renderer &&
      getInk === null &&
      !new URLSearchParams(window.location.search).has('noInkWrap')
    ) {
      getInk = hookInkProbe()
    }
    const ink = getInk === null ? -1 : getInk()
    const inkOK = ink >= 0 && ink >= getMinInk()
    setE2EStatus(
      `e2e: file=${fileName} entities=${entities} rendered=${rendered} ink=${ink} inkOK=${inkOK} pending=${pending}`
    )
    // The open pipeline can silently produce a blank document (openDocument
    // returning false — see upstream issue #384). One automatic retry keeps
    // e2e runs deterministic.
    if (
      !retried &&
      entities === 0 &&
      !new URLSearchParams(window.location.search).has('noretry') &&
      Date.now() - startedAt > 8000 &&
      Date.now() - startedAt < REPORT_TIMEOUT_MS
    ) {
      retried = true
      location.reload()
      return
    }
    const settled = !pending && entities > 0
    // Keep reporting after settle: the first real frame (and therefore the
    // ink measurement) can land after the database finishes loading.
    if (settled && !frameRequested && view) {
      frameRequested = true
      try {
        ;(view as { requestOpenLineworkFrame?: () => void }).requestOpenLineworkFrame?.()
      } catch {
        // ignore; the status line simply keeps the last ink value
      }
    }
    if (Date.now() - startedAt > REPORT_TIMEOUT_MS) {
      clearInterval(timer)
    }
  }, POLL_INTERVAL_MS)
}

/**
 * Opens `?fixture=<url>` through the real file-select path (dev only).
 * Returns true when a fixture was requested, whether or not it loaded.
 */
export async function openFixtureFromUrl(
  handleFileSelect: E2EFileSelect
): Promise<boolean> {
  if (!import.meta.env.DEV) return false
  const fixture = new URLSearchParams(window.location.search).get('fixture')
  if (!fixture) return false
  const fileName = fixture.split('/').pop() || 'fixture.dxf'
  try {
    const resp = await fetch(fixture)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const buf = await resp.arrayBuffer()
    const file = new File([buf], fileName, { type: 'application/dxf' })
    // Mirror the upload dialog defaults, with Extents so the whole drawing
    // is framed for pixel/visual assertions.
    handleFileSelect(
      file,
      AcEdOpenMode.Write,
      true,
      false,
      false,
      AcApOpenViewMode.Extents,
      ACDB_DRAW_CIRCLE_SIDES_DRAFT,
      ACGI_PAPER_SPACE_BACKGROUND,
      false
    )
    reportUntilSettled(fileName)
    return true
  } catch (e) {
    setE2EStatus(`e2e: FAILED fixture=${fixture} (${String(e)})`)
    return true
  }
}
