import { useEffect, useRef, useState } from 'react'

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

// Keyboard behaviour every modal owes: focus moves inside on open (unless a
// control already took it via autoFocus), Tab and Shift+Tab wrap inside,
// Escape closes, and focus goes back to whatever opened it. Spread the returned
// ref onto the role="dialog" element.
//
// onClose is read through a ref so a parent passing an inline arrow does not
// re-run the effect, which would steal focus back to the first control.
export default function useDialog(onClose) {
  const ref = useRef(null)
  // Read on the first render: by the time an effect runs, an autoFocus control
  // inside the dialog already holds focus and would be mistaken for the opener.
  const [opener] = useState(() => document.activeElement)
  const close = useRef(onClose)
  useEffect(() => { close.current = onClose })

  useEffect(() => {
    const box = ref.current
    if (box && !box.contains(document.activeElement)) {
      ;(box.querySelector(FOCUSABLE) ?? box).focus()
    }
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); close.current?.(); return }
      if (e.key !== 'Tab' || !ref.current) return
      const items = [...ref.current.querySelectorAll(FOCUSABLE)].filter((el) => el.getClientRects().length > 0)
      if (items.length === 0) { e.preventDefault(); return }
      const first = items[0]
      const last = items[items.length - 1]
      const inside = ref.current.contains(document.activeElement)
      if (e.shiftKey && (document.activeElement === first || !inside)) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && (document.activeElement === last || !inside)) { e.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      if (opener?.isConnected) opener.focus()
    }
  }, [opener])

  return ref
}
