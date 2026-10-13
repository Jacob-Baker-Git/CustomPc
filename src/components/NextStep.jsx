import { ArrowRight } from 'lucide-react'
import useBuilderStore from '../store/useBuilderStore'
import { stepsFor } from '../hooks/useHashView'
import { BTN_PRIMARY } from '../lib/uiTokens'

// The builder's "Next" button: the following step of whichever Welcome path
// the build came from. A view off the path (Build, on a game-target build)
// leads to the path's first step.
export default function NextStep({ view, onChange }) {
  const path = useBuilderStore((s) => s.path)
  const steps = stepsFor(path)
  const next = steps[steps.indexOf(view) + 1]
  if (!next) return null
  return (
    <div className="relative z-10 flex justify-end w-full max-w-2xl lg:max-w-[1760px] mx-auto px-4 sm:px-6 lg:px-10 2xl:px-14 pb-6">
      <button onClick={() => onChange(next)}
              className={`${BTN_PRIMARY} text-sm px-5 py-2.5 rounded-lg capitalize inline-flex items-center gap-1.5`}>
        Next: {next} <ArrowRight size={14} aria-hidden="true" />
      </button>
    </div>
  )
}
