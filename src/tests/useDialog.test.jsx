import { it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'
import useDialog from '../hooks/useDialog'

function Harness({ onCancel }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      {open && <ConfirmDialog title="Sure?" body="b" confirmLabel="Yes" onConfirm={() => {}} onCancel={() => { onCancel(); setOpen(false) }} />}
    </>
  )
}

it('moves focus into the dialog, closes on Escape and returns focus to the opener', () => {
  const onCancel = vi.fn()
  const { getByText, getByRole, queryByRole } = render(<Harness onCancel={onCancel} />)
  const opener = getByText('Open')
  opener.focus()
  fireEvent.click(opener)
  expect(getByRole('dialog').contains(document.activeElement)).toBe(true)
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(onCancel).toHaveBeenCalledOnce()
  expect(queryByRole('dialog')).toBeNull()
  expect(document.activeElement).toBe(opener)
})

it('returns focus to the opener even when a control inside autofocuses', () => {
  function Auto() {
    const [open, setOpen] = useState(false)
    return (
      <>
        <button onClick={() => setOpen(true)}>Open</button>
        {open && <AutoDialog onClose={() => setOpen(false)} />}
      </>
    )
  }
  const { getByText } = render(<Auto />)
  const opener = getByText('Open')
  opener.focus()
  fireEvent.click(opener)
  expect(document.activeElement.tagName).toBe('INPUT')
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(document.activeElement).toBe(opener)
})

function AutoDialog({ onClose }) {
  const ref = useDialog(onClose)
  return <div ref={ref} role="dialog"><input autoFocus /></div>
}
