import ReactDOM from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { applyShareLinkFromUrl } from './lib/shareLink'
import { syncBuildWithCatalog } from './store/useCatalogStore'
import { initFlowHistory } from './lib/flowHistory'
import './index.css'

// Before the first render: apply a ?build= share link, then re-point the
// persisted build at the bundled catalogue (loadCatalog repeats this live).
applyShareLinkFromUrl()
syncBuildWithCatalog()
initFlowHistory()

// ⚠️ NO React.StrictMode, deliberately. This is not an oversight, and re-adding
// it breaks the 3D view in development. src/tests/mainEntry.test.js holds the
// measurements and guards it; the short version:
//
// StrictMode mounts a component, tears its effects down and mounts it again.
// r3f's teardown is deferred by 500 ms and then calls forceContextLoss() and
// _roots.delete(canvas) without checking whether a newer root has taken that
// canvas — and a canvas only ever hands out one WebGL context. So the second
// mount is handed the first mount's context, and the first mount's cleanup then
// destroys it. The canvas froze roughly 512 draw calls into every local dev
// session: no rotation, no zoom.
//
// Production is untouched either way, because StrictMode's double-invoke is a
// development behaviour.
ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
)
