import BudgetEntry from './components/BudgetEntry'
import BuilderScreen from './screens/BuilderScreen'
import useBuilderStore from './store/useBuilderStore'

export default function App() {
  const budget    = useBuilderStore((s) => s.budget)
  const setBudget = useBuilderStore((s) => s.setBudget)

  if (!budget) return <BudgetEntry onSubmit={setBudget} />
  return <BuilderScreen />
}
