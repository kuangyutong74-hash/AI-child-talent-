import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ChannelProvider, useChannel } from './contexts/ChannelContext'
import { StoryProvider } from './contexts/StoryContext'
import Background from './components/Layout/Background'
import Header from './components/Layout/Header'
import MusicPlayer from './components/Layout/MusicPlayer'
import ChannelPage from './pages/ChannelPage'
import CharacterPage from './pages/CharacterPage'
import GalleryPage from './pages/GalleryPage'
import HomePage from './pages/HomePage'
import StoryPlayPage from './pages/StoryPlayPage'
import TalentPage from './pages/TalentPage'

const STORY_ROOT = '/story-create'

/** 未选择年龄段通道时，先引导去选择。 */
function ChannelGuard({ children }: { children: React.ReactNode }) {
  const { ageGroup } = useChannel()
  if (!ageGroup) return <Navigate to={`${STORY_ROOT}/channel`} replace />
  return <>{children}</>
}

function StoryRoutes() {
  return (
    <Routes>
      <Route path="channel" element={<ChannelPage />} />
      <Route
        index
        element={
          <ChannelGuard>
            <HomePage />
          </ChannelGuard>
        }
      />
      <Route
        path="characters"
        element={
          <ChannelGuard>
            <CharacterPage />
          </ChannelGuard>
        }
      />
      <Route
        path="play/:storyId"
        element={
          <StoryProvider>
            <StoryPlayPage />
          </StoryProvider>
        }
      />
      <Route
        path="gallery"
        element={
          <ChannelGuard>
            <GalleryPage />
          </ChannelGuard>
        }
      />
      <Route
        path="talent/:storyId"
        element={
          <ChannelGuard>
            <TalentPage />
          </ChannelGuard>
        }
      />
      <Route
        path="parent"
        element={
          <ChannelGuard>
            <GalleryPage parentMode />
          </ChannelGuard>
        }
      />
      <Route
        path="parent/talent/:storyId"
        element={
          <ChannelGuard>
            <TalentPage parentView />
          </ChannelGuard>
        }
      />
      <Route path="*" element={<Navigate to={STORY_ROOT} replace />} />
    </Routes>
  )
}

export default function StoryCreateApp() {
  const { pathname } = useLocation()
  const isStoryPlayPage = pathname.startsWith(`${STORY_ROOT}/play/`)

  return (
    <ChannelProvider>
      <Background />
      {!isStoryPlayPage && <Header />}
      <MusicPlayer />
      <StoryRoutes />
    </ChannelProvider>
  )
}
