// Copyright (c) 2026 MeeJoy

import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import App from "./App.jsx"
import { ThemeProvider } from "@/components/theme-provider"
import "./index.css"

// Patch fetch for Tauri: prefix /api/ requests with remote API_BASE
const API_BASE = import.meta.env.VITE_API_BASE || ''

if (API_BASE) {
  const _origFetch = window.fetch
  window.fetch = function(input, init) {
    if (typeof input === 'string' && input.startsWith('/api/')) {
      input = API_BASE + input
    } else if (input instanceof Request && input.url.startsWith('/api/')) {
      input = new Request(API_BASE + input.url, input)
    }
    return _origFetch.call(window, input, init)
  }
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      enableColorScheme
      storageKey="hermes-desktop-theme"
      disableTransitionOnChange>
      <App />
    </ThemeProvider>
  </StrictMode>
)
