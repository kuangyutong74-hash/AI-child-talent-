import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import StoryCreateApp from './StoryCreateApp'
import './styles/global.css'
import './styles/responsive.css'
import './styles/candy-redesign.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/story-create" replace />} />
        <Route path="/story-create/*" element={<StoryCreateApp />} />
        <Route path="*" element={<Navigate to="/story-create" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
