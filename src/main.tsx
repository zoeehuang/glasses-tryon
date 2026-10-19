import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const root = createRoot(document.getElementById('root')!)

// The calibration tool only exists on the dev server; production builds drop it.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('calibrate')) {
  import('./calibration/CalibrationPage').then(({ CalibrationPage }) =>
    root.render(
      <StrictMode>
        <CalibrationPage />
      </StrictMode>,
    ),
  )
} else {
  root.render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
