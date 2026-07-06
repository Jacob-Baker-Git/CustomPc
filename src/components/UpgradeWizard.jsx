import Backdrop from './Backdrop'

export default function UpgradeWizard({ onBack }) {
  return (
    <div className="relative min-h-screen flex flex-col items-center text-white bg-[#05080f] py-12">
      <Backdrop />
      <div className="relative z-10 w-full max-w-2xl px-4">
        <h1 className="text-3xl font-bold mb-2 text-center">Upgrade your PC</h1>
        <button onClick={onBack} className="mt-8 text-xs text-slate-500 hover:text-slate-300 transition-colors">
          ← Back to menu
        </button>
      </div>
    </div>
  )
}
