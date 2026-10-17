import { useState } from 'react'
import { createPortal } from 'react-dom'
import useBuilderStore, { selTotalSpent, selPeripheralsTotal, selPeakDraw } from '../store/useBuilderStore'
import { CATEGORIES } from '../lib/categories'
import { searchUrl } from '../lib/retailerLinks'
import { useBuildActions } from '../hooks/useBuildActions'
import { useIsDesktop } from '../hooks/useIsDesktop'

const PHONE_ROWS = 4
import { buildMarkdown } from '../lib/buildMarkdown'
import { BUILD_PROFILES } from '../lib/buildProfiles'
import { PANEL_STRONG } from '../lib/uiTokens'
import Block from './ui/Block'
import { PRICE_SNAPSHOT } from '../lib/siteContent'
import DimensionsChecklist from './DimensionsChecklist'
import ConfirmDialog from './ConfirmDialog'
import { countEssentials, isOptional } from '../lib/recommendedOrder'

const PERIPHERAL_LABELS = { monitor: 'Monitor', keyboard: 'Keyboard', mouse: 'Mouse', headset: 'Headset' }
const PERIPHERAL_ORDER = ['monitor', 'keyboard', 'mouse', 'headset']
const RES_LABEL = { '1080p': '1080p', '1440p': '1440p', '4k': '4K' }
function Row({ label, name, brand, price }) {
  return (
    <div data-row className="group flex items-center py-1.5 border-t border-line">
      <span className="font-mono text-[11px] uppercase text-muted w-24 shrink-0 pr-2">
        {label}
      </span>
      <span className="flex-1 text-sm text-ink truncate">{name}</span>
      <span className="font-mono text-sm text-muted w-20 text-right">£{price.toFixed(2)}</span>
      {/* Revealed on hover or keyboard focus. Ten always-visible links down the
          right-hand edge were the loudest thing on a page whose job is to be
          read; group-focus-within is what keeps them reachable without a
          pointer, rather than hiding them behind a gesture a keyboard cannot
          make. */}
      <a
        href={searchUrl(name, brand)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Find best price for ${name}`}
        title="Find best price"
        className="w-7 text-right text-sm text-brass hover:brightness-110 opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        ↗
      </a>
    </div>
  )
}

function MissingRow({ label, optional }) {
  return (
    <div data-missing-row className="flex items-center py-1.5 border-t border-line">
      <span className="font-mono text-[11px] uppercase text-muted w-24 shrink-0 pr-2">
        {label}
      </span>
      {optional ? (
        <span className="flex-1 text-sm text-muted">Optional</span>
      ) : (
        <span className="flex-1 text-sm text-ok">
          <span aria-hidden="true" className="mr-1.5">⚠</span>Not selected
        </span>
      )}
      <span className="font-mono text-sm text-faint w-20 text-right">—</span>
      <span className="w-7" />
    </div>
  )
}

export default function BuildSummary() {
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const selectedPeripherals = useBuilderStore((s) => s.selectedPeripherals)
  const budget = useBuilderStore((s) => s.budget)
  const clearBuild = useBuilderStore((s) => s.clearBuild)
  const setFlow = useBuilderStore((s) => s.setFlow)
  const { save, share, fallbackName } = useBuildActions()
  const buildTotal = useBuilderStore(selTotalSpent)
  const periphTotal = useBuilderStore(selPeripheralsTotal)
  const power = useBuilderStore(selPeakDraw)
  const resolution = useBuilderStore((s) => s.resolution)
  const useCase = useBuilderStore((s) => s.useCase)
  const [copied, setCopied] = useState(false)
  // A phone shows the first few rows of the parts list; desktop shows them all
  // (spec 2026-10-16). Read once at mount, like every fold's default.
  const desktop = useIsDesktop()
  const [allRows, setAllRows] = useState(false)
  const capList = !desktop && !allRows

  const framePaced = Boolean(BUILD_PROFILES[useCase]?.cpuGpuPaced)

  const buildRows = CATEGORIES.map((c) => ({ key: c.id, label: c.label, part: selectedParts[c.id] })).filter((r) => r.part)
  const missingCount = countEssentials(selectedParts).missing.length
  const periphRows = PERIPHERAL_ORDER.map((id) => ({ key: id, label: PERIPHERAL_LABELS[id], part: selectedPeripherals[id] })).filter((r) => r.part)
  const isEmpty = buildRows.length === 0 && periphRows.length === 0
  const grandTotal = buildTotal + periphTotal
  const overBudget = budget > 0 && buildTotal > budget

  async function copyShareLink() {
    if (await share()) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }
  }

  function copyMarkdown() {
    const rows = [...buildRows, ...periphRows].map((r) => ({ label: r.label, name: r.part.name, price: r.part.price }))
    navigator.clipboard?.writeText(buildMarkdown(rows, grandTotal)).catch(() => {})
  }

  const [saveOpen, setSaveOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [nameDraft, setNameDraft] = useState('')

  function handleSave() {
    setNameDraft(fallbackName)
    setSaveOpen(true)
  }

  function confirmSave() {
    save(nameDraft)
    setSaveOpen(false)
  }

  function handleClear() {
    setClearOpen(true)
  }

  function confirmClear() {
    clearBuild()
    setClearOpen(false)
  }

  return (
    <div>
      <div>
        <Block>
          <div className="flex items-baseline justify-between mb-1">
            <h2 className="text-lg text-ink">Your build</h2>
            <span className="font-mono text-base text-tech">
              £{buildTotal.toFixed(0)}
              {budget > 0 && (
                <span className={`text-sm ${overBudget ? 'text-bad' : 'text-muted'}`}> / £{budget.toFixed(0)}</span>
              )}
            </span>
          </div>

          {isEmpty ? (
            <p className="text-sm text-muted py-6 text-center">No parts selected yet. Head to the Build tab.</p>
          ) : (
            <>
              {buildRows.length > 0 && (
                <>
                  <div className="mt-4 mb-1 flex items-baseline justify-between">
                    <span className="text-[11px] uppercase tracking-wider text-muted">Core build</span>
                    {missingCount > 0 && (
                      <span className="text-[11px] text-ok">{missingCount} part{missingCount === 1 ? '' : 's'} missing</span>
                    )}
                  </div>
                  {(capList ? CATEGORIES.slice(0, PHONE_ROWS) : CATEGORIES).map((c) => {
                    const part = selectedParts[c.id]
                    return part
                      ? <Row key={c.id} label={c.label} name={part.name} brand={part.brand} price={part.price} />
                      : <MissingRow key={c.id} label={c.label} optional={isOptional(c.id)} />
                  })}
                  {capList && (
                    <button
                      type="button"
                      onClick={() => setAllRows(true)}
                      className="mt-1 min-h-11 w-full border-t border-line text-left text-sm font-semibold text-brass hover:underline"
                    >
                      +{CATEGORIES.length - PHONE_ROWS} more parts
                    </button>
                  )}
                </>
              )}
              {periphRows.length > 0 && (
                <>
                  <div className="mt-5 mb-1 text-[11px] uppercase tracking-wider text-muted">Peripherals</div>
                  {periphRows.map((r) => <Row key={r.key} label={r.label} name={r.part.name} brand={r.part.brand} price={r.part.price} />)}
                </>
              )}

              <div className="flex flex-wrap gap-x-5 gap-y-1 mt-4 pt-3 border-t border-line text-xs text-muted">
                <span>Build <span className="font-mono text-muted">£{buildTotal.toFixed(2)}</span></span>
                <span>Peripherals <span className="font-mono text-muted">£{periphTotal.toFixed(2)}</span></span>
                <span>Peak draw <span className="font-mono text-ok">{power}W</span></span>
                <span>Total <span className="font-mono text-ink">£{grandTotal.toFixed(2)}</span></span>
              </div>

              {/* Frame rates live on the Performance tab, from measured
                  benchmarks. This used to be a table built from the guessed
                  per-game multipliers of the old 22-game list (retired
                  2026-10-17). */}
              {framePaced && selectedParts.cpu && selectedParts.gpu && (
                <a
                  href="#performance"
                  className="mt-5 inline-block text-[11px] uppercase tracking-wider text-muted hover:text-brass transition-colors"
                >
                  Frame rates @ {RES_LABEL[resolution] ?? resolution} →
                </a>
              )}
              <div className="mt-5">
                <div className="text-[11px] uppercase tracking-wider text-muted mb-1">Physical dimensions</div>
                <DimensionsChecklist />
              </div>
            </>
          )}

          <p className="mt-4 text-[11px] text-muted leading-relaxed">
            Prices are curated estimates ({PRICE_SNAPSHOT}), not live retail data. Hover a part and use its ↗ link for current prices.
          </p>

          <div className="flex flex-wrap gap-2 mt-5">
            <button
              onClick={handleSave}
              disabled={isEmpty}
              className="min-h-11 text-xs px-3.5 py-2 rounded-lg border border-brass text-brass hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Save PC
            </button>
            <button
              onClick={copyShareLink}
              disabled={isEmpty}
              className="min-h-11 text-xs px-3.5 py-2 rounded-lg bg-brass hover:brightness-110 text-accent-ink disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {copied ? 'Copied!' : 'Copy share link'}
            </button>
            <button
              onClick={() => window.print()}
              disabled={isEmpty}
              className="min-h-11 text-xs px-3.5 py-2 rounded-lg border border-line text-ink hover:border-line-strong disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Print
            </button>
            <button
              onClick={copyMarkdown}
              disabled={isEmpty}
              className="min-h-11 text-xs px-3.5 py-2 rounded-lg border border-line text-ink hover:border-line-strong disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              Copy as Markdown
            </button>
          </div>

          {/* Two text links rather than two more buttons.
              Saved builds moved to the hub — this is the way back to them from
              the place where saving actually happens.
              Clear build sat in the row above as a fifth equal-weight control,
              which gave the one action that wipes the build the same weight as
              Print. It stays a <button> because it performs an action rather
              than navigating; only its weight changes. */}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <button
              onClick={() => setFlow('saved')}
              className="min-h-11 text-xs text-muted hover:text-brass transition-colors"
            >
              View your saved builds →
            </button>
            <button
              onClick={handleClear}
              disabled={isEmpty}
              className="min-h-11 text-xs text-muted hover:text-bad disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Clear build
            </button>
          </div>
        </Block>
      </div>

      {/* Portalled for the same reason as ConfirmDialog: this column is
          transformed, which would trap a fixed overlay inside it. */}
      {saveOpen && createPortal(
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6">
          <div role="dialog" aria-modal="true" aria-label="Save build" className={`${PANEL_STRONG} w-full max-w-sm p-5`}>
            <h3 className="text-ink text-sm font-semibold mb-3">Save this build</h3>
            <label htmlFor="save-name" className="block text-xs text-muted mb-1">Build name</label>
            <input
              id="save-name"
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmSave()
                if (e.key === 'Escape') setSaveOpen(false)
              }}
              className="w-full bg-surface-2 text-ink text-sm px-3 py-2 rounded-lg border border-line focus:outline-none focus:border-brass"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setSaveOpen(false)} className="min-h-11 text-xs px-3.5 py-2 rounded-lg border border-line text-muted hover:border-line-strong transition-colors">Cancel</button>
              <button onClick={confirmSave} className="min-h-11 text-xs px-3.5 py-2 rounded-lg bg-brass hover:brightness-110 text-accent-ink transition-colors">Save</button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      {clearOpen && (
        <ConfirmDialog
          title="Clear the whole build?"
          ariaLabel="Clear build"
          body="This removes every selected part and peripheral. Saved builds are kept."
          confirmLabel="Clear everything"
          onConfirm={confirmClear}
          onCancel={() => setClearOpen(false)}
        />
      )}
    </div>
  )
}
