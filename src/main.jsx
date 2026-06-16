import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { applyShareLinkFromUrl } from './lib/shareLink'
import './index.css'

// Hydrate from a ?build= share link before the first render (no BudgetEntry flash).
applyShareLinkFromUrl()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
