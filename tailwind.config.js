export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
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
