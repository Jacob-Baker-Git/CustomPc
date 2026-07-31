import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ScoreInfo from '../components/ScoreInfo'

describe('ScoreInfo', () => {
  it('stays out of the way until asked', () => {
    render(<ScoreInfo />)
    expect(screen.queryByRole('note')).toBeNull()
  })

  it('explains how the score is worked out', () => {
    render(<ScoreInfo />)
    fireEvent.click(screen.getByRole('button', { name: /how the custompc score is calculated/i }))
    const note = screen.getByRole('note')
    expect(note).toHaveTextContent(/catalogue/i)
    expect(note).toHaveTextContent(/use case/i)
    expect(note).toHaveTextContent(/hold each other back/i)
  })

  // The whole point of the user's request: a number out of 100 invites more
  // confidence than the method carries, so the caveat has to be explicit.
  it('says plainly not to take it as gospel', () => {
    render(<ScoreInfo />)
    fireEvent.click(screen.getByRole('button', { name: /how the custompc score is calculated/i }))
    const note = screen.getByRole('note')
    expect(note).toHaveTextContent(/rough guide, not a verdict/i)
    expect(note).toHaveTextContent(/not a benchmark/i)
    expect(note).toHaveTextContent(/3D view/i)
  })

  it('closes again on a second press', () => {
    render(<ScoreInfo />)
    const btn = screen.getByRole('button', { name: /how the custompc score is calculated/i })
    fireEvent.click(btn)
    expect(screen.getByRole('note')).toBeInTheDocument()
    fireEvent.click(btn)
    expect(screen.queryByRole('note')).toBeNull()
  })
})
