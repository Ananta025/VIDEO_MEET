import StartPage from '@/pages/StartPage'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import RegisterPage from '@/pages/RegisterPage'
import LoginPage from '@/pages/LoginPage'
import HomePage from '@/pages/HomePage'
import VideoMeetingPage from '@/pages/VideoMeetingPage'

export default function AppRoutes() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<StartPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/:url" element={<VideoMeetingPage />} />
        <Route path="/home" element={<HomePage />} />
      </Routes>
    </Router>
  )
}
