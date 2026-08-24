export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      screens: {
        // The width the top bar's full readout actually needs, measured rather
        // than guessed. It was 1403px while the header stated the budget twice
        // and the wattage twice — revealing that at `xl` (1280) clipped the
        // POWER figure off the right edge with no scrollbar to signal it.
        // Removing the duplication took the requirement to 1249px.
        //
        // ⚠️ 1249 is the figure for a FOUR-DIGIT budget. These are live
        // numbers, so the header's width is a function of what the user typed:
        // at £10000 the same header needs 1281px. Sizing this to the typical
        // case would have put a 1280px laptop back exactly where the whole
        // exercise started — clipping, silently, for the one user with a big
        // budget. So the threshold comes off the worst case, not the common one.
        //
        // 1300 clears a five-digit budget. See TopBar.jsx, and
        // e2e/topBar.spec.js, which measures both.
        wide: '1300px',
      },
      fontFamily: {
        sans: ['Hanken Grotesk', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Archivo', 'Hanken Grotesk', 'ui-sans-serif', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        // Board design system. Values live as CSS vars in src/index.css so they
        // can be tuned in one place.
        //
        // Every one of these is a bare var() holding a hex, so NONE of them
        // accepts an opacity modifier — `bg-gold/60` emits no CSS at all.
        // tokenOpacity.test.js fails the build for it. Use a whole token; that
        // is why gold.soft exists.
        ground: 'var(--ground)',
        surface: { DEFAULT: 'var(--surface)', 2: 'var(--surface-2)' },
        line: { DEFAULT: 'var(--line)', strong: 'var(--line-strong)' },
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        faint: 'var(--faint)',
        // Brand — wordmark only.
        accent: { DEFAULT: 'var(--accent)', ink: 'var(--accent-ink)' },
        // Metals — state.
        copper: 'var(--copper)',
        gold: { DEFAULT: 'var(--gold)', soft: 'var(--gold-soft)' },
        tech: 'var(--tech)',
        steel: 'var(--steel)',
        // Signals — interruption.
        good: 'var(--good)',
        ok: 'var(--ok)',
        bad: 'var(--bad)',
      },
    },
  },
  plugins: [],
}
