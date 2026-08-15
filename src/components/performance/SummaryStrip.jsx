// The answer, before the evidence.
//
// Three figures a reader wants within a second of arriving: how fast it runs,
// what is holding it back, and what it draws. Everything below this strip is
// the working — grouped, still complete, but no longer competing with the
// headline for attention.
//
// Deliberately NOT a single "your build gets N fps" number. Coverage is one
// game in twenty-three; a headline frame rate would be the most prominent
// figure on the page and the least supported one. It reports how much it can
// answer instead, which is true at any corpus size.
function Tile({ label, value, sub, tone = 'ink' }) {
  const toneClass = tone === 'good' ? 'text-good'
    : tone === 'ok' ? 'text-ok'
      : tone === 'bad' ? 'text-bad'
        : tone === 'accent' ? 'text-accent' : 'text-ink'

  return (
    <div className="px-3.5 py-3">
      <div className="text-[10px] uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 font-mono text-xl leading-none tabular-nums ${toneClass}`}>
        {value ?? '—'}
      </div>
      {sub && <div className="mt-1 text-[11px] text-muted leading-tight">{sub}</div>}
    </div>
  )
}

export default function SummaryStrip({ hasCore, report, power, resolution }) {
  const answered = report?.coverage?.gamesAnswered ?? 0
  const total = report?.coverage?.gamesTotal ?? 0
  const measured = report?.coverage?.gamesExact ?? 0
  const leaning = report?.bottleneck?.leaning

  const leaningLabel = !report?.bottleneck ? 'no data yet'
    : leaning === 'cpu' ? 'processor'
      : leaning === 'gpu' ? 'graphics' : 'balanced'

  // The count behind the verdict, matching the verdict.
  //
  // ⚠️ gpuLedGames + cpuLedGames does NOT equal gamesConsidered — the rest are
  // balanced. Always quoting gpuLedGames would print "processor / 0 of 5 games"
  // for a processor-led build, the headline contradicting its own evidence.
  const led = !report?.bottleneck ? 0
    : leaning === 'cpu' ? report.bottleneck.cpuLedGames
      : leaning === 'gpu' ? report.bottleneck.gpuLedGames
        : report.bottleneck.gamesConsidered
          - report.bottleneck.cpuLedGames - report.bottleneck.gpuLedGames

  return (
    // A grid, not flex-wrap: `divide-x` on a wrapping flex row draws a stray
    // left border on the first tile of every wrapped line. One column stacked
    // with horizontal rules, three columns side by side with vertical ones.
    <div className="grid divide-y divide-line rounded-xl border border-line bg-surface sm:grid-cols-3 sm:divide-x sm:divide-y-0">
      <Tile
        label={`Games covered at ${resolution}`}
        value={hasCore ? `${answered}/${total}` : null}
        // Not the "pick a CPU and a graphics card" prompt — the Frame rates
        // section below already carries it, and saying it twice on one screen
        // reads as a rendering fault rather than emphasis.
        sub={hasCore ? `${measured} from a direct measurement` : 'No parts selected yet'}
        tone={answered > 0 ? 'accent' : 'ink'}
      />
      <Tile
        label="Bottleneck"
        value={hasCore ? leaningLabel : null}
        // ⚠️ States its own base. The verdict is computed only from the games
        // with a fitted CPU constant — 5 of 53 covered for a typical build — so
        // a bare "4 graphics-limited" reads as a whole-build conclusion drawn
        // from 9% of the rows. `gamesConsidered` is the honest denominator.
        sub={report?.bottleneck
          ? `${led} of ${report.bottleneck.gamesConsidered} games where the split is known`
          : 'Needs benchmark data to say'}
        // A graphics-led frame is the healthy arrangement, so it is not "bad".
        tone={!report?.bottleneck ? 'ink' : leaning === 'cpu' ? 'bad' : 'good'}
      />
      <Tile
        label="Gaming draw"
        value={power?.gamingW ? `${power.gamingW}W` : null}
        sub={power?.peakW ? `${power.peakW}W peak, ${power.fromWallW}W from the wall` : null}
      />
    </div>
  )
}
