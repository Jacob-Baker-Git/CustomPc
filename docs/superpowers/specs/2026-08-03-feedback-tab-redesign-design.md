# Feedback tab — redesign & de-friction (design)

Date: 2026-08-03
Status: approved (design locked via visual companion, v10)

## Goal

Improve the feedback tab on two axes the user chose: **look & feel** and
**less friction**. A third want — *reading responses* — was resolved with no
code: submissions are read in the Supabase dashboard Table Editor (`feedback`
table, project `igeggndtnmdpauxovnwv`), so it is out of scope here. *Optional
replies* was explicitly rejected to preserve the no-personal-data stance, so
nothing in this change collects contact details.

Scope is one component (`FeedbackPage.jsx`) plus a small trim to `humanCheck.js`
and their tests. No database change. No new design tokens.

## Locked layout (v10)

A single card, one field group per row, in this order:

1. **Heading** — `Feedback` + subtitle "Tell us what works, what doesn't, or
   what you'd like next." (unchanged copy).
2. **Category** — label **"What's this about?"** + four compact tile boxes:
   Idea · Bug · Praise · Other, each an icon over a label. Four across on
   desktop, 2×2 below 460px. The selected tile takes the accent border, the
   `accent-soft` wash, and accent text/icon.
3. **Message** — label **"Tell us more"** + a textarea (`maxLength 2000`). The
   `n / 2000` counter sits at the textarea's bottom-right and is **absolutely
   positioned**, so it never adds a row or affects vertical spacing.
4. **Rating** — label **"Your rating"** + five stars. **Required, 1–5**
   (unchanged requirement). Stars are ~30px and **preview on hover/focus**
   (light up to the pointer, revert on leave).
5. **Send** — accent button "Send feedback", left-aligned.

### Spacing rules (the thing we iterated hardest on)

- One even vertical rhythm: **20px between every group**, **9px from each label
  to its control**. No per-element ad-hoc margins.
- The char counter floats (absolute) and is *ignored* for spacing — the 20px gap
  below the message is measured from the textarea box, so message→rating matches
  category→message exactly.
- Colours come entirely from the existing Workbench tokens (`--surface`,
  `--surface-2`, `--line`, `--line-strong`, `--accent`, `--accent-soft`,
  `--ink`, `--muted`, `--faint`). No token changes; `--faint` stays WCAG-pinned.

## Friction changes

- **Remove the math quiz.** Drop the visible "What is 4 + 3?" challenge from the
  form. Rating stays required; category and message stay required.
- **Keep the silent defences:** the honeypot (`company` field) and the 2.5s
  timing floor (`submittedTooFast`) remain, backed by the Supabase 30/min global
  `BEFORE INSERT` cap. This is the deliberate level for a static site with one
  write path.
- **No visible spam note.** The form shows no "spam-checked" reassurance line
  (there never was one; we are not adding it).

## Wording changes

- "Category" → **"What's this about?"**
- "Message" → **"Tell us more"**
- "Your rating" unchanged. Button "Send feedback" unchanged.

## Accessibility (parity, must not regress)

- Category tiles are real `<button type="button">` with `aria-pressed`
  reflecting selection (today's chips already do this — the tile restyle keeps
  it).
- Star buttons keep `aria-label="Rate N"`, stay keyboard-operable, and the hover
  preview also fires on keyboard focus so it is not mouse-only.
- Honeypot stays `aria-hidden`, `tabIndex -1`, visually hidden.

## Component changes — `FeedbackPage.jsx`

- Remove challenge state and its UI: `challenge`, `challengeInput`,
  `setChallenge`, the `makeChallenge`/`checkAnswer` imports and calls, the sum
  input block, and the "wrong answer → new sum" branch.
- Keep `submittedTooFast` + honeypot. The too-fast rejection currently writes to
  `errors.challenge`; move it to a general form-level error rendered near the
  submit button (message unchanged: "Take another moment to look that over, then
  send.").
- Add `hoveredRating` state driving the star fill: a star is filled when
  `n <= (hoveredRating || rating)`. `onMouseLeave`/`onBlur` clears
  `hoveredRating`; `onMouseEnter`/`onFocus` sets it.
- Restructure markup to the grouped, even-spacing layout above (icons on the
  category tiles via lucide-react, matching the icon set already used).

## Library change — `humanCheck.js`

- `makeChallenge` and `checkAnswer` become unused. Remove them; keep
  `SUBMIT_FLOOR_MS` and `submittedTooFast`.
- **Fix the stale comment** on line 6: it still claims "5 per source / 10 min,
  30/min global", but the per-source limit and its `ip_hash` column were dropped
  on 2026-08-02. It is **30/min global only** now.

## Testing

`FeedbackPage.test.jsx` — the math-challenge tests go; the behaviour tests stay:

- Keep/rewrite: submits valid feedback (rating + category + message, past the
  floor) → shows thank-you and calls `submitFeedback`.
- Keep: empty message is blocked and reported.
- Keep: instant submit (before the 2.5s floor) is refused even when the fields
  are valid — now asserted without any challenge step.
- Keep: an empty message is reported rather than any check complaint.
- New: clicking a category tile sets it (`aria-pressed`), and clicking a star
  sets the rating; a submit with no rating is blocked with the rating error.
- Remove: "asks a sum", "refuses on wrong answer", "fresh sum after wrong
  answer" — the challenge they exercise no longer exists.

`humanCheck.test.js` — remove the `makeChallenge`/`checkAnswer` cases; keep the
`submittedTooFast` / `SUBMIT_FLOOR_MS` cases.

`feedback.js` / `feedback.test.js` — **unchanged.** `validateFeedback` already
requires rating 1–5 and a 1–2000 char message; the payload stays
`{ rating, type, message }`.

## Out of scope / unchanged

- Success ("Thank you 🙌") and error states — untouched.
- The Supabase `feedback` table, its RLS, and the insert trigger — untouched.
- Amazon links, Search Console, and every other tab — untouched.
