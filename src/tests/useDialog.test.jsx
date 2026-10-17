import { it, expect, vi } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import ConfirmDialog from '../components/ConfirmDialog'

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
