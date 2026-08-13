import { useMemo, useState } from 'react'
import useBuilderStore from '../../store/useBuilderStore'
import { estimateBuildPerformance } from '../../lib/perfEngine'
import { onlyRealData } from '../../lib/perfEngine/rowBasis'
import { estimatePower, estimateThermals } from '../../lib/perfEngine/power'
import { memoryProfile } from '../../lib/perfEngine/memory'
import { gpuCapability, cpuCapability } from '../../lib/perfEngine/capability'
import perfModel from '../../data/perfModel.json'
import perfGames from '../../data/perfGames.json'
import gpuSpecs from '../../../data/specs/gpuSpecs.json'
import cpuSpecs from '../../../data/specs/cpuSpecs.json'
import { PERF_CAVEAT } from '../../lib/siteContent'
import StatPanel from './StatPanel'
import StatRow from './StatRow'
import FpsCardGrid from './FpsCardGrid'
import Section from './Section'
import SummaryStrip from './SummaryStrip'
import BasisBar from './BasisBar'

// One grid definition for every band, so the panels line up across sections
// rather than each group inventing its own rhythm.
const GRID = 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3'

const capacity = (gb) => (gb >= 1000 && gb % 1000 === 0 ? `${gb / 1000}TB` : `${gb}GB`)

export default function PerformanceScreen() {
  const selectedParts = useBuilderStore((s) => s.selectedParts)
  const resolution = useBuilderStore((s) => s.resolution)
  // The engine's game list is the MEASURED one, not the catalogue's. The legacy
  // 22 exist to drive the CustomPC score and almost none of them appear in a
  // modern GPU roundup, so pointing the Performance tab at them guarantees 22
  // rows of "no benchmark data yet". perfGames.json holds the games real
  // reviews actually publish, and it grows as the corpus does.
  //
  // It is a bundled import rather than useCatalogStore: the catalogue swaps to
  // live Supabase data at runtime, and the Supabase `games` table mirrors the
  // legacy 22. Reading from the store would drop these on the first fetch.
  const games = perfGames

  const { cpu, gpu } = selectedParts
  const hasCore = Boolean(cpu && gpu)
  const [realOnly, setRealOnly] = useState(false)

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
  // archEfficiency is fitted by perf:fit from the corpus, not hand-written, so the
  // capability index corrects for the fact that vendors count shaders differently.
  // Architectures the corpus covers with fewer than three cards come back
  // uncalibrated and the panel says so.
  const gpuCap = useMemo(() => gpuCapability(gpu, gpuSpecs, { archEfficiency: perfModel.archEfficiency }), [gpu])
  const cpuCap = useMemo(() => cpuCapability(cpu, cpuSpecs), [cpu])

  const answered = report?.coverage?.gamesAnswered ?? 0
  // realOnly filters what's DRAWN, never what's COUNTED — BasisBar takes
  // allRows so its totals can't be made to look stronger by hiding the rest.
  const allRows = report?.games ?? []
  const shownRows = realOnly ? onlyRealData(allRows) : allRows

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

      <SummaryStrip hasCore={hasCore} report={report} power={power} resolution={resolution} />

      <div className="mt-3">
        <BasisBar rows={allRows} realOnly={realOnly} onRealOnlyChange={setRealOnly} />
      </div>

      <Section
        title="Frame rates"
        blurb={`At ${resolution}, High preset. Games are listed in the engine's own order — covered first, fastest first — and anything without a published measurement behind it says so rather than showing a number.`}
      >
        {!hasCore ? (
          <p className="text-xs text-muted leading-relaxed">
            Pick a CPU and a graphics card to estimate frame rates.
          </p>
        ) : answered === 0 ? (
          <p className="max-w-[68ch] text-xs text-muted leading-relaxed">
            No benchmark data for these parts yet. The engine only reports figures it
            can trace to a published measurement, so rather than estimate around the
            gap it says nothing. Coverage grows as the benchmark corpus does — every
            section below is computed from the parts themselves and does not depend
            on it.
          </p>
        ) : (
          <FpsCardGrid rows={shownRows} />
        )}

        <p className="mt-3 max-w-[80ch] text-[11px] text-muted leading-relaxed">{PERF_CAVEAT}</p>
        {report?.coverage?.gpuResolutionCopied && (
          <p className="mt-1.5 max-w-[80ch] text-[11px] text-ok leading-relaxed">
            No measurements exist for this card at {resolution}, so its index was carried
            over from 1440p. Treat these as the shape of the result rather than the figure.
          </p>
        )}
        {/* Two units, said separately on purpose. Coverage is counted in GAMES,
            because "19 of 22 games" is what a reader wants to know. The cards
            are one per game AND preset, so the result count is stated too —
            without it the footer claims 19 while 43 cards sit above it, which
            reads as a counting bug. */}
        <p className="mt-1.5 text-[10px] text-muted">
          Model {perfModel.modelVersion} · data as of {perfModel.datasetVersion}
          {hasCore && ` · ${answered} of ${report.coverage.gamesTotal} games answered`}
          {hasCore && ` · ${report.coverage.rowsAnswered} results shown, ${report.coverage.rowsExact} measured directly`}
        </p>
      </Section>

      <Section
        title="What's holding it back"
        blurb="Which part is the limit differs per game, so it is worked out from the frame rates rather than by comparing the two parts in the abstract."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <StatPanel
            title="Bottleneck"
            subtitle={report?.bottleneck
              ? report.bottleneck.verdict
              : 'Needs benchmark data before it can say anything.'}
            footnote={report?.bottleneck?.nextUpgrade?.reason}
          >
            {report?.bottleneck ? (
              <>
                <StatRow label="Leaning"
                         value={report.bottleneck.leaning === 'cpu' ? 'processor'
                           : report.bottleneck.leaning === 'gpu' ? 'graphics' : 'balanced'}
                         tone={report.bottleneck.leaning === 'cpu' ? 'bad' : 'good'} />
                <StatRow label="Processor-limited" value={report.bottleneck.cpuLedGames}
                         unit={`of ${report.bottleneck.gamesConsidered}`} />
                <StatRow label="Graphics-limited" value={report.bottleneck.gpuLedGames}
                         unit={`of ${report.bottleneck.gamesConsidered}`} />
                <StatRow label="Worst case" value={report.bottleneck.worstCase.name} />
                <StatRow label="Lost to the weaker part"
                         value={report.bottleneck.worstCase.lostToWeakerSide} unit="%"
                         hint={`${report.bottleneck.worstCase.name}: card could do ${report.bottleneck.worstCase.gpuOnlyFps}, chip could feed ${report.bottleneck.worstCase.cpuOnlyFps}`}
                         tone={report.bottleneck.worstCase.lostToWeakerSide > 25 ? 'bad' : 'ok'} />
                <StatRow label="Upgrade next"
                         value={report.bottleneck.nextUpgrade.category === 'cpu' ? 'processor' : 'graphics card'} />
              </>
            ) : (
              <StatRow label="Status" value="needs benchmark data" />
            )}
          </StatPanel>

          <StatPanel title="The parts that decide it">
            <StatRow label="Processor" value={cpu?.name} />
            <StatRow label="Cores" value={cpu?.specs?.cores} />
            <StatRow label="Boost clock" value={cpu?.specs?.boostClock} unit="GHz" />
            <StatRow label="Graphics" value={gpu?.name} />
            <StatRow label="VRAM" value={gpu?.specs?.vram} unit="GB" />
            <StatRow label="Storage" value={selectedParts.storage?.storageType} />
          </StatPanel>
        </div>
      </Section>

      <Section
        title="Power and cooling"
        blurb="What the build draws, whether the supply has room for it, and whether the cooler can shed it."
      >
      <div className={GRID}>
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
      </div>
      </Section>

      <Section
        title="The hardware"
        blurb="What the parts can do on paper. Computed from published specifications, so this half works whether or not anyone has benchmarked your exact combination."
      >
      <div className={GRID}>
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

        <StatPanel
          title="Graphics capability"
          subtitle={gpuCap.basis === 'spec-derived'
            ? `Computed from published specifications, indexed against an RTX 4090 at 100.`
            : 'No published specifications transcribed for this card yet.'}
          footnote={gpuCap.basis !== 'spec-derived'
            ? undefined
            : gpuCap.archCalibrated
              // The vendors still count different things; what has changed is that
              // the corpus now says by how much, so the figure is corrected rather
              // than merely caveated. The spread is quoted because the correction
              // is an average over cards that do not all agree — on some
              // architectures it is wide enough to matter.
              ? `Calibrated across architectures from ${gpuCap.archParts} measured ${gpuCap.architecture} cards, so this is comparable with a rival brand. The correction (x${gpuCap.archEfficiency}) is a fitted average and those cards spread ${gpuCap.archSpreadPct}% around it — read a gap narrower than that as noise, not a ranking.`
              : `Trustworthy against other ${gpuCap.architecture} cards. NOT yet calibrated across architectures — ${gpuCap.vendor === 'nvidia' ? 'NVIDIA counts CUDA cores' : gpuCap.vendor === 'amd' ? 'AMD counts stream processors' : 'Intel counts Xe vector engines'}, and the vendors count different things. Fewer than three ${gpuCap.architecture} cards have been measured, so comparing this figure with a rival brand still needs data we do not have.`}
        >
          <StatRow label="Capability index" value={gpuCap.index}
                   hint={gpuCap.archCalibrated ? 'comparable across brands' : gpuCap.architecture ? `vs other ${gpuCap.architecture} cards` : undefined} />
          <StatRow label="Compute" value={gpuCap.tflops} unit="TFLOPS"
                   hint="Theoretical FP32 peak" />
          <StatRow label="Memory bandwidth" value={gpuCap.bandwidthGbs} unit="GB/s" />
          <StatRow label={gpuCap.shaderUnit ? gpuCap.shaderUnit.replace(/^./, (m) => m.toUpperCase()) : 'Shaders'}
                   value={gpuSpecs.gpus?.[gpu?.id]?.shaders} />
          <StatRow label="Architecture" value={gpuCap.architecture} />
        </StatPanel>

        <StatPanel
          title="Processor capability"
          subtitle={cpuCap.basis === 'spec-derived'
            ? 'Clock leads, cores saturate at eight because games cannot use more, and cache counts for more than its size suggests.'
            : 'No published specifications transcribed for this processor yet.'}
          footnote={cpuCap.cacheBasis === 'single-sourced'
            ? 'The cache figure comes from a single source with nothing to corroborate it — unlike the boost clock, which matches the catalogue independently.'
            : undefined}
        >
          <StatRow label="Capability index" value={cpuCap.index} />
          <StatRow label="Boost clock" value={cpuCap.boostGhz} unit="GHz" />
          <StatRow label="Cores" value={cpuCap.cores}
                   hint={cpuCap.cores > 8 ? 'games use about eight' : undefined} />
          {/* The reachable figure, not the package total. On a multi-chiplet
              part those differ and the spec sheet quotes the larger one, so
              say which this is rather than look like a typo. */}
          <StatRow label="L3 cache" value={cpuCap.l3Mb} unit="MB"
                   hint={cpuCap.l3PackageMb > cpuCap.l3Mb
                     ? `per chiplet, of ${cpuCap.l3PackageMb} MB total — L3 is not shared between chiplets`
                     : undefined} />
        </StatPanel>
      </div>
      </Section>
    </div>
  )
}
