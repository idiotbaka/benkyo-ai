import { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { applyTheme } from './lib/theme';
import HomePage from './pages/HomePage';
import LessonPage from './pages/LessonPage';
import GrammarPage from './pages/GrammarPage';
import ProfileSetupPage from './pages/ProfileSetupPage';
import ProfilePage from './pages/ProfilePage';
import ShopPage from './pages/ShopPage';
import SettingsPage from './pages/SettingsPage';
import VocabPage from './pages/VocabPage';
import VocabBookPage from './pages/VocabBookPage';
import ListeningPracticePage from './pages/ListeningPracticePage';
import CourseReviewPracticePage from './pages/CourseReviewPracticePage';
import WordReviewPracticePage from './pages/WordReviewPracticePage';
import MainLayout from './components/Layout/MainLayout';
import useUserStore from './store/userStore';
import XpBoostWidget from './components/UI/XpBoostWidget';
import SoundEffectProvider from './components/UI/SoundEffectProvider';

// Syncs CSS theme vars whenever profile gender changes
function ThemeSync() {
  const gender = useUserStore(s => s.profile?.gender);
  useEffect(() => { applyTheme(gender); }, [gender]);
  return null;
}

// Redirects to /setup if user has no profile yet
function RequireProfile() {
  const profile = useUserStore(s => s.profile);
  if (!profile) return <Navigate to="/setup" replace />;
  return <Outlet />;
}

// Calls checkStreak, syncHearts, and syncXpBoost once on app load
function AppInit() {
  const checkStreak = useUserStore(s => s.checkStreak);
  const syncHearts  = useUserStore(s => s.syncHearts);
  const syncXpBoost = useUserStore(s => s.syncXpBoost);
  useEffect(() => {
    checkStreak();
    syncHearts();
    syncXpBoost();
  }, [checkStreak, syncHearts, syncXpBoost]);
  return null;
}

export default function App() {
  return (
    <HashRouter>
      <AppInit />
      <ThemeSync />
      <SoundEffectProvider />
      <XpBoostWidget />
      <Routes>
        <Route path="/setup" element={<ProfileSetupPage />} />
        <Route element={<RequireProfile />}>
          <Route element={<MainLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/shop" element={<ShopPage />} />
            <Route path="/vocab" element={<VocabPage />} />
            <Route path="/vocab/book" element={<VocabBookPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
          <Route path="/lesson/:chapterId/:levelId" element={<LessonPage />} />
          <Route path="/practice/listening" element={<ListeningPracticePage />} />
          <Route path="/practice/course-review" element={<CourseReviewPracticePage />} />
          <Route path="/practice/word-review" element={<WordReviewPracticePage />} />
          <Route path="/grammar/:chapterId" element={<GrammarPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
