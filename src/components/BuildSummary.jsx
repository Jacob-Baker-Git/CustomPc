import { useState } from 'react'
import { createPortal } from 'react-dom'
import useBuilderStore, { selTotalSpent, selPeripheralsTotal, selPeakDraw } from '../store/useBuilderStore'
import { CATEGORIES } from '../lib/categories'
import { searchUrl } from '../lib/retailerLinks'
import { useBuildActions } from '../hooks/useBuildActions'
import { useIsDesktop } from '../hooks/useIsDesktop'
import { priceShares } from '../lib/showroomSlots'
import PartPictogram from './showroom/PartPictogram'

const PHONE_ROWS = 4
import { buildMarkdown } from '../lib/buildMarkdown'
import { BUILD_PROFILES } from '../lib/buildProfiles'
import { PANEL_STRONG } from '../lib/uiTokens'
import Block from './ui/Block'
import { PRICE_SNAPSHOT } from '../lib/siteContent'
import DimensionsChecklist from './DimensionsChecklist'
import ConfirmDialog from './ConfirmDialog'
import useDialog from '../hooks/useDialog'
import { countEssentials, isOptional } from '../lib/recommendedOrder'
import { gbp, gbp2 } from '../lib/money'

const PERIPHERAL_LABELS = { monitor: 'Monitor', keyboard: 'Keyboard', mouse: 'Mouse', headset: 'Headset' }
const PERIPHERAL_ORDER = ['monitor', 'keyboard', 'mouse', 'headset']
const RES_LABEL = { '1080p': '1080p', '1440p': '1440p', '4k': '4K' }
// One line of the build table (spec 2026-10-20). The grid areas live in
// index.css (.part-row): a phone puts type, % and price on one line, the name
// full width under them and the share bar under that; desktop is one line.
function Row({ id, label, name, brand, price, pct, hot, onHot }) {
  return (
    <div
      data-row
      onMouseEnter={onHot && (() => onHot(id))}
      onMouseLeave={onHot && (() => onHot(null))}
      // Keyboard too: focus on the row's ↗ link lights the label (React's
      // focus/blur bubble, like focusin/focusout).
      onFocus={onHot && (() => onHot(id))}
      onBlur={onHot && (() => onHot(null))}
      className={`part-row group border-t border-line px-1 py-1.5 transition-colors ${hot === id ? 'bg-surface-2' : ''}`}
    >
      <span className="[grid-area:icon]"><PartPictogram id={id} className={hot === id ? 'text-brass' : ''} /></span>
      <span className={`[grid-area:type] font-mono text-[12px] uppercase tracking-wider ${hot === id ? 'text-brass' : 'text-muted'}`}>
        {label}
      </span>
      <span className="[grid-area:name] min-w-0 break-words text-sm text-ink">{name}</span>
      {pct != null && (
        <>
          <span className="[grid-area:bar] mt-1 h-1 bg-line lg:mt-0"><span data-share-bar className="block h-1 bg-brass" style={{ width: `${pct}%` }} /></span>
          <span className="[grid-area:pct] text-right font-mono text-[12px] text-muted">{pct.toFixed(1)}%</span>
        </>
      )}
      <span className="[grid-area:price] text-right font-mono text-sm text-ink">{gbp2(price)}</span>
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
        className="[grid-area:link] text-right text-sm text-brass hover:brightness-110 opacity-0 transition-opacity focus:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        ↗
      </a>
    </div>
  )
}

// Portalled for the same reason as ConfirmDialog: the summary column is
// transformed, which would trap a fixed overlay inside it.
function SaveDialog({ name, setName, onSave, onCancel }) {
  const ref = useDialog(onCancel)
  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs flex items-center justify-center p-6">
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label="Save build" className={`${PANEL_STRONG} w-full max-w-sm p-5`}>
        <h3 className="text-ink text-sm font-semibold mb-3">Save this build</h3>
        <label htmlFor="save-name" className="block text-xs text-muted mb-1">Build name</label>
        <input
          id="save-name"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSave() }}
          className="w-full bg-surface-2 text-ink text-sm px-3 py-2 rounded-lg border border-line focus:outline-hidden focus:border-brass"
        />
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onCancel} className="min-h-11 text-xs px-3.5 py-2 rounded-lg border border-line text-muted hover:border-line-strong transition-colors">Cancel</button>
          <button onClick={onSave} className="min-h-11 text-xs px-3.5 py-2 rounded-lg bg-brass hover:brightness-110 text-accent-ink transition-colors">Save</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function MissingRow({ id, label, optional }) {
  return (
    <div data-missing-row className="part-row border-t border-line px-1 py-1.5">
      <span className="[grid-area:icon] opacity-40"><PartPictogram id={id} /></span>
      <span className="[grid-area:type] font-mono text-[12px] uppercase tracking-wider text-muted">
        {label}
      </span>
      {optional ? (
        <span className="[grid-area:name] text-sm text-muted">Optional</span>
      ) : (
        <span className="[grid-area:name] text-sm text-ok">
          <span aria-hidden="true" className="mr-1.5">⚠</span>Not selected
        </span>
      )}
      <span className="[grid-area:price] text-right font-mono text-sm text-faint">—</span>
    </div>
  )
}

export default function BuildSummary({ hot = null, onHot } = {}) {
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

  const shares = Object.fromEntries(priceShares(selectedParts).map((r) => [r.id, r.pct]))
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
              {gbp(buildTotal)}
              {budget > 0 && (
                <span className={`text-sm ${overBudget ? 'text-bad' : 'text-muted'}`}> / {gbp(budget)}</span>
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
                    <span className="text-[12px] uppercase tracking-wider text-muted">Core build</span>
                    {missingCount > 0 && (
                      <span className="text-[12px] text-ok">{missingCount} part{missingCount === 1 ? '' : 's'} missing</span>
                    )}
                  </div>
                  {(capList ? CATEGORIES.slice(0, PHONE_ROWS) : CATEGORIES).map((c) => {
                    const part = selectedParts[c.id]
                    return part
                      ? <Row key={c.id} id={c.id} label={c.label} name={part.name} brand={part.brand} price={part.price} pct={shares[c.id]} hot={hot} onHot={onHot} />
                      : <MissingRow key={c.id} id={c.id} label={c.label} optional={isOptional(c.id)} />
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
                  <div className="mt-5 mb-1 text-[12px] uppercase tracking-wider text-muted">Peripherals</div>
                  {periphRows.map((r) => <Row key={r.key} id={r.key} label={r.label} name={r.part.name} brand={r.part.brand} price={r.part.price} />)}
                </>
              )}

              <div className="flex flex-wrap gap-x-5 gap-y-1 mt-4 pt-3 border-t border-line text-xs text-muted">
                <span>Build <span className="font-mono text-muted">{gbp2(buildTotal)}</span></span>
                <span>Peripherals <span className="font-mono text-muted">{gbp2(periphTotal)}</span></span>
                <span>Peak draw <span className="font-mono text-ok">{power}W</span></span>
                <span>Total <span className="font-mono text-ink">{gbp2(grandTotal)}</span></span>
              </div>

              {/* Frame rates live on the Performance tab, from measured
                  benchmarks. This used to be a table built from the guessed
                  per-game multipliers of the old 22-game list (retired
                  2026-10-17). */}
              {framePaced && selectedParts.cpu && selectedParts.gpu && (
                <a
                  href="#performance"
                  className="mt-5 inline-block py-1 text-[12px] uppercase tracking-wider text-muted hover:text-brass transition-colors"
                >
                  Frame rates @ {RES_LABEL[resolution] ?? resolution} →
                </a>
              )}
              <div className="mt-5">
                <div className="text-[12px] uppercase tracking-wider text-muted mb-1">Physical dimensions</div>
                <DimensionsChecklist />
              </div>
            </>
          )}

          <p className="mt-4 text-[12px] text-muted leading-relaxed">
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

      {saveOpen && (
        <SaveDialog name={nameDraft} setName={setNameDraft} onSave={confirmSave} onCancel={() => setSaveOpen(false)} />
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
