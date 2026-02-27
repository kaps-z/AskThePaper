import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

window.onerror = function (message, source, lineno, colno, error) {
  console.error('🔥 Global Client Error:', { message, source, lineno, colno, error });
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
