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
      // Tailwind 3's type scale, restated for v4: v4 gives these UNITLESS
      // line-heights, so an arbitrary text-[11px] inside text-sm inherited 1.43
      // (15.7px) instead of v3's absolute 20px and whole rows shrank.
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1rem' }],
        sm: ['0.875rem', { lineHeight: '1.25rem' }],
        base: ['1rem', { lineHeight: '1.5rem' }],
        lg: ['1.125rem', { lineHeight: '1.75rem' }],
        xl: ['1.25rem', { lineHeight: '1.75rem' }],
        '2xl': ['1.5rem', { lineHeight: '2rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '5xl': ['3rem', { lineHeight: '1' }],
        '6xl': ['3.75rem', { lineHeight: '1' }],
        '7xl': ['4.5rem', { lineHeight: '1' }],
        '8xl': ['6rem', { lineHeight: '1' }],
        '9xl': ['8rem', { lineHeight: '1' }],
      },
      fontFamily: {
        sans: ['Hanken Grotesk', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Archivo', 'Hanken Grotesk', 'ui-sans-serif', 'sans-serif'],
        // Headings in the configurator look: a static width-125% instance (fonts.css).
        wide: ['Archivo Wide', 'Archivo', 'Hanken Grotesk', 'ui-sans-serif', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        // Board design system. Values live as CSS vars in src/index.css so they
        // can be tuned in one place.
        //
        // Every one of these is a bare var() holding a hex. Under Tailwind 3
        // an opacity modifier on them (`bg-gold/60`) emitted no CSS at all;
        // v4 would mix it, but the palette stays whole tokens by design and
        // tokenOpacity.test.js still fails the build for a modifier. That is
        // why gold.soft exists.
        ground: 'var(--ground)',
        surface: { DEFAULT: 'var(--surface)', 2: 'var(--surface-2)' },
        line: { DEFAULT: 'var(--line)', strong: 'var(--line-strong)' },
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        faint: 'var(--faint)',
        // Brand — wordmark only.
        accent: { DEFAULT: 'var(--accent)', ink: 'var(--accent-ink)' },
        // Metals — state. One yellow family: brass acts, gold is on, tech
        // (straw) is data. Named `brass` rather than `amber`/`yellow` on
        // purpose — extending either of those names with a bare string would
        // replace Tailwind's whole built-in scale for it.
        brass: 'var(--brass)',
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
