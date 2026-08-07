import { useMemo } from 'react'
import useBuilderStore from '../../store/useBuilderStore'
import useCatalogStore from '../../store/useCatalogStore'
import { estimateBuildPerformance } from '../../lib/perfEngine'
import { estimatePower, estimateThermals } from '../../lib/perfEngine/power'
import { memoryProfile } from '../../lib/perfEngine/memory'
import perfModel from '../../data/perfModel.json'
import { PERF_CAVEAT } from '../../lib/siteContent'
import StatPanel from './StatPanel'
import StatRow from './StatRow'
import FpsCardGrid from './FpsCardGrid'

const capacity = (gb) => (gb >= 1000 && gb % 1000 === 0 ? `${gb / 1000}TB` : `${gb}GB`)

export default function PerformanceScreen() {
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const resolution = useBuilderStore((s) => s.resolution)
  const games = useCatalogStore((s) => s.games)

  const { cpu, gpu } = selectedParts
  const hasCore = Boolean(cpu && gpu)

  // Two independent halves, and the split is deliberate. Everything below comes
  // from spec fields the catalogue already carries, so it works on day one with
  // an empty benchmark corpus. Only the frame rates need curated measurements.
  const report = useMemo(
    () => (hasCore
      ? estimateBuildPerformance({ parts: selectedParts, resolution, presetId: 'high',
                                   model: perfModel, games })
      : null),
    [hasCore, selectedParts, resolution, games],
  )

  const power = useMemo(
    () => estimatePower(selectedParts, report?.meanCpuShare ?? 0.5),
    [selectedParts, report],
  )
  const thermals = useMemo(() => estimateThermals(selectedParts), [selectedParts])
  const memory = useMemo(() => memoryProfile(selectedParts), [selectedParts])

  const measured = report?.coverage?.gamesExact ?? 0
  const answered = report?.coverage?.gamesAnswered ?? 0

  return (
    <div className="w-full max-w-2xl lg:max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-10 pt-3 pb-12">
      <header className="mb-4">
        <h2 className="text-lg text-ink">Performance</h2>
        <p className="mt-1 text-xs text-muted leading-relaxed">
          How this build behaves under load — what it draws, what it can shed, and
          what it renders. Everything except the frame rates is computed from the
          parts themselves.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatPanel
          title="Power"
          subtitle={hasCore
            ? 'Gaming draw is weighted by which part is setting the pace — a CPU-limited frame leaves the graphics card waiting, and a waiting card draws less.'
            : 'Add a CPU and graphics card for a load-weighted figure.'}
          footnote="Estimated from each part's rated draw. Real consumption varies with the game, the settings and the silicon."
        >
          <StatRow label="Idle" value={power.idleW} unit="W" />
          <StatRow label="Gaming" value={power.gamingW} unit="W" />
          <StatRow label="Peak" value={power.peakW} unit="W"
                   hint="What a transient spike can reach" />
          <StatRow label="From the wall" value={power.fromWallW} unit="W"
                   hint={power.efficiencyTier ? `at 80+ ${power.efficiencyTier}` : 'assuming an unrated supply'} />
        </StatPanel>

        <StatPanel
          title="Power supply"
          subtitle={power.psuWattage
            ? 'Headroom matters less for average draw than for the split-second spikes a graphics card pulls — those are what trip a supply into shutting down.'
            : 'No power supply selected yet.'}
        >
          <StatRow label="Fitted" value={power.psuWattage} unit="W" />
          <StatRow label="Recommended" value={power.recommendedPsuW} unit="W"
                   hint="Peak plus 35% for transients" />
          <StatRow
            label="Headroom over peak"
            value={power.psuHeadroomPct == null ? null : `${power.psuHeadroomPct > 0 ? '+' : ''}${power.psuHeadroomPct}`}
            unit="%"
            tone={power.psuHeadroomPct == null ? 'ink'
              : power.psuHeadroomPct < 15 ? 'bad' : power.psuHeadroomPct < 30 ? 'ok' : 'good'}
          />
          <StatRow label="Load while gaming" value={power.loadPointPct} unit="%"
                   hint="Supplies are quietest and most efficient near half load" />
        </StatPanel>

        <StatPanel
          title="Cooling"
          subtitle={thermals.headroomPct == null
            ? 'Needs a CPU and a cooler with a known size.'
            : 'Nothing gets damaged when a cooler is undersized — the CPU drops its clocks to stay in range, so you lose boost speed during long loads and gain fan noise.'}
        >
          <StatRow label="CPU heat output" value={thermals.cpuTdp} unit="W" />
          <StatRow label="Cooler capacity" value={thermals.capacityW} unit="W" />
          <StatRow
            label="Headroom"
            value={thermals.headroomPct == null ? null : `${thermals.headroomPct > 0 ? '+' : ''}${thermals.headroomPct}`}
            unit="%"
            tone={thermals.headroomPct == null ? 'ink'
              : thermals.headroomPct < 0 ? 'bad' : thermals.headroomPct < 40 ? 'ok' : 'good'}
          />
          <StatRow label="Verdict" value={thermals.verdict} />
        </StatPanel>

        <StatPanel
          title="Memory"
          subtitle={memory
            ? 'Memory speed and channel count act on the CPU side of a frame — they show up in the 1% lows more than the average.'
            : 'No memory selected yet.'}
        >
          <StatRow label="Capacity" value={memory?.capacityGb ? capacity(memory.capacityGb) : null} />
          <StatRow label="Type" value={memory?.type} />
          <StatRow label="Speed" value={memory?.speed} unit="MT/s" />
          <StatRow
            label="Channels"
            value={memory?.channels}
            tone={memory?.channels === 'single' ? 'bad' : memory?.channels === 'dual' ? 'good' : 'ink'}
          />
          <StatRow label="Platform sweet spot" value={memory?.baseline} unit="MT/s" />
          {memory?.notes?.map((n) => (
            <p key={n.text} className={`mt-2 text-[11px] leading-relaxed ${n.severity === 'bad' ? 'text-bad' : 'text-muted'}`}>
              <strong className="font-normal">{n.text}.</strong> {n.detail}
            </p>
          ))}
        </StatPanel>

        <StatPanel title="The parts that decide it">
          <StatRow label="Processor" value={cpu?.name} />
          <StatRow label="Cores" value={cpu?.specs?.cores} />
          <StatRow label="Boost clock" value={cpu?.specs?.boostClock} unit="GHz" />
          <StatRow label="Graphics" value={gpu?.name} />
          <StatRow label="VRAM" value={gpu?.specs?.vram} unit="GB" />
          <StatRow label="Storage" value={selectedParts.storage?.storageType} />
        </StatPanel>

        <StatPanel
          title="Frame rates"
          subtitle={`At ${resolution}, High preset.`}
        >
          <StatRow label="Games with an estimate" value={hasCore ? `${answered} of ${report.coverage.gamesTotal}` : null} />
          <StatRow label="From a direct measurement" value={hasCore ? measured : null} />
          <StatRow label="Model" value={perfModel.modelVersion} />
          <StatRow label="Data as of" value={perfModel.datasetVersion} />
        </StatPanel>
      </div>

      <section className="mt-5">
        <h3 className="mb-2.5 text-sm text-ink">Per game</h3>
        {!hasCore ? (
          <p className="text-xs text-muted leading-relaxed">
            Pick a CPU and a graphics card to estimate frame rates.
          </p>
        ) : answered === 0 ? (
          <p className="text-xs text-muted leading-relaxed">
            No benchmark data for these parts yet. The engine only reports figures it
            can trace to a published measurement, so rather than estimate around the
            gap it says nothing. Coverage grows as the benchmark corpus does — the
            panels above do not depend on it.
          </p>
        ) : (
          <FpsCardGrid rows={report.games} />
        )}
        <p className="mt-3 text-[11px] text-muted leading-relaxed">{PERF_CAVEAT}</p>
      </section>
    </div>
  )
}
