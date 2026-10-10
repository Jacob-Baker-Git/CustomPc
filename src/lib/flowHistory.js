import useBuilderStore from '../store/useBuilderStore'

// The top-level screen (`flow`) lives in the store, not the URL, so each
// history entry carries it: setFlow pushes one, and Back restores it. An entry
// with no recorded flow (a content page, say) leaves the screen alone.
export function initFlowHistory() {
  const { flow } = useBuilderStore.getState()
  window.history.replaceState({ ...window.history.state, flow }, '')
  window.addEventListener('popstate', (e) => {
    const next = e.state?.flow
    if (next && next !== useBuilderStore.getState().flow) useBuilderStore.setState({ flow: next })
  })
}
