import { artVariant } from '../../lib/artVariant'
import { initialsFor } from '../../lib/gameInitials'
import { GENRE_MARKS } from '../../lib/gameGenreMarks'

// Cover artwork for a game, keyed by genre and initialled by title.
//
// Real cover art is the one asset class on this site that could not be used
// safely: every cover is the publisher's copyright, none is freely licensed,
// and serving 60 of them would need the CSP opened to a third-party host.
// So a game gets a genre-tinted plate carrying a drawn genre mark — a reticle,
// a sword, a steering wheel — which is enough for the eye to find a row it has
// seen before without pretending to be something it is not. A game whose genre
// is unknown keeps its initials instead: see gameGenreMarks.jsx.
//
// ⚠️ The route to real covers is CLOSED, and not for want of effort. RAWG's
// terms forbid "further distribution in any way"; neither RAWG nor IGDB owns
// the covers, so neither can license one; and hotlinking would break both
// legalContent.js's promise that every asset is same-origin and the assertion
// in cspHeaders.test.js. Researched 2026-08-27 — do not reopen it by wiring an
// image URL.
//
// The plate is a gradient of two hues per genre, and the angle comes from a
// hash of the game id so that two shooters side by side are not the same
// rectangle. Deterministic — see artVariant.
//
// ⚠️ These are the ONE place on the site that is not in the yellow family, and
// that is deliberate rather than an oversight of the palette rule in index.css.
// The rule governs UI state: what you can press, what is on, what is a number.
// These plates are CONTENT — they stand in for box art, which would be
// full-colour if it were here. Sixty tiles in one hue would also destroy the
// only thing they are for, which is letting the eye find a row it has already
// looked at. Nothing that carries state may borrow these colours.

const GENRE = {
  shooter:            { from: '#E0A93B', to: '#7A4A18', ink: '#1b1f26' },
  rpg:                { from: '#9C7BD4', to: '#3B2A5E', ink: '#F2EEFA' },
  'action-adventure': { from: '#56A8D8', to: '#1E3F5C', ink: '#EAF4FA' },
  horror:             { from: '#C4514A', to: '#2E1414', ink: '#FAECEA' },
  'strategy-sim':     { from: '#5FBF8F', to: '#1E4634', ink: '#EAFAF2' },
  racing:             { from: '#E8D49A', to: '#6B5A2E', ink: '#1b1f26' },
  moba:               { from: '#D48ABF', to: '#4A2340', ink: '#FAEAF5' },
  sports:             { from: '#6FA8DC', to: '#1F3A55', ink: '#EAF2FA' },
  other:              { from: '#8892A0', to: '#2A2E35', ink: '#F2F4F7' },
}

export default function GameArt({ name, genre, seed, className = '', rounded = 'rounded-md' }) {
  const g = GENRE[genre] ?? GENRE.other
  const v = artVariant(seed ?? name)
  const angle = 25 + (v % 8) * 15
  const id = `ga-${(v % 100000).toString(36)}`

  // A known genre draws its mark; anything else keeps the initials. See the
  // note in gameGenreMarks.jsx for why `other` has no symbol of its own.
  const Mark = GENRE_MARKS[genre]

  return (
    <svg
      viewBox="0 0 48 48"
      className={`${rounded} ${className}`}
      preserveAspectRatio="xMidYMid slice"
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={id} gradientTransform={`rotate(${angle} 0.5 0.5)`}>
          <stop offset="0%" stopColor={g.from} />
          <stop offset="100%" stopColor={g.to} />
        </linearGradient>
      </defs>
      <rect width="48" height="48" fill={`url(#${id})`} />
      {/* One diagonal sweep, offset by the hash, so the plates differ beyond
          their gradient angle without becoming busy. */}
      <path
        d={`M${-10 + (v % 20)} 48 L${18 + (v % 20)} 0 L${30 + (v % 20)} 0 L${2 + (v % 20)} 48 Z`}
        fill="#FFFFFF"
        opacity="0.08"
      />
      {Mark ? (
        <g data-genre-mark={genre} color={g.ink} opacity="0.92">
          <Mark />
        </g>
      ) : (
        <text
          x="24" y="24"
          textAnchor="middle"
          dominantBaseline="central"
          fill={g.ink}
          fontSize="19"
          fontWeight="800"
          fontFamily="Archivo, ui-sans-serif, sans-serif"
          letterSpacing="-0.5"
        >
          {initialsFor(name)}
        </text>
      )}
    </svg>
  )
}
