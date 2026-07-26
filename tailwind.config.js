export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Hanken Grotesk', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Bricolage Grotesque', 'Hanken Grotesk', 'ui-sans-serif', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        // Workbench design system — neutral dark base + one warm accent.
        // Values live as CSS vars in src/index.css so they can be tuned in one place.
        ground: 'var(--ground)',
        surface: { DEFAULT: 'var(--surface)', 2: 'var(--surface-2)' },
        line: { DEFAULT: 'var(--line)', strong: 'var(--line-strong)' },
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        faint: 'var(--faint)',
        accent: { DEFAULT: 'var(--accent)', soft: 'var(--accent-soft)', ink: 'var(--accent-ink)' },
        steel: 'var(--steel)',
        good: 'var(--good)',
        ok: 'var(--ok)',
        bad: 'var(--bad)',
      },
    },
  },
  plugins: [],
}
