import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { applyTheme } from './lib/theme';
import HomePage from './pages/HomePage';
import LessonPage from './pages/LessonPage';
import GrammarPage from './pages/GrammarPage';
import LevelKnowledgePage from './pages/LevelKnowledgePage';
import ProfileSetupPage from './pages/ProfileSetupPage';
import ProfilePage from './pages/ProfilePage';
import ShopPage from './pages/ShopPage';
import SettingsPage from './pages/SettingsPage';
import VocabPage from './pages/VocabPage';
import VocabBookPage from './pages/VocabBookPage';
import ListeningPracticePage from './pages/ListeningPracticePage';
import CourseReviewPracticePage from './pages/CourseReviewPracticePage';
import WordReviewPracticePage from './pages/WordReviewPracticePage';
import WrongReviewPracticePage from './pages/WrongReviewPracticePage';
import MainLayout from './components/Layout/MainLayout';
import useUserStore from './store/userStore';
import useDailyTaskStore from './store/dailyTaskStore';
import useNextChapterRecommendationStore from './store/nextChapterRecommendationStore';
import XpBoostWidget from './components/UI/XpBoostWidget';
import SoundEffectProvider from './components/UI/SoundEffectProvider';
import DailyTaskToast from './components/UI/DailyTaskToast';
import XpBoostActivationModal from './components/UI/XpBoostActivationModal';

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
  const ensureDailyTasks = useDailyTaskStore(s => s.ensureToday);
  const resetRecommendationRuntime = useNextChapterRecommendationStore(s => s.resetRuntimeState);
  useEffect(() => {
    checkStreak();
    syncHearts();
    syncXpBoost();
    ensureDailyTasks();
    resetRecommendationRuntime();
  }, [checkStreak, ensureDailyTasks, resetRecommendationRuntime, syncHearts, syncXpBoost]);

  useEffect(() => {
    window.benkyoDebugDailyTaskToast = (selector = 'small') => (
      useDailyTaskStore.getState().debugCompleteToast(selector)
    );

    window.benkyoDebugCompleteDailyTask = (selector = 'small') => (
      useDailyTaskStore.getState().debugResetAndCompleteTask(selector)
    );

    return () => {
      delete window.benkyoDebugDailyTaskToast;
      delete window.benkyoDebugCompleteDailyTask;
    };
  }, []);

  return null;
}

function DebugConsoleCommands() {
  const [xpBoostModal, setXpBoostModal] = useState(null);
  const [coinBoostModal, setCoinBoostModal] = useState(null);

  useEffect(() => {
    window.benkyoDebugXpBoost = (multiplier = 2) => {
      const result = useUserStore.getState().debugActivateXpBoost(multiplier);
      setXpBoostModal(result.multiplier);
      return {
        ok: true,
        multiplier: result.multiplier,
        expiresAt: new Date(result.expiresAt).toLocaleString(),
      };
    };

    window.benkyoDebugAddCoins = (amount = 1000) => (
      useUserStore.getState().debugAddCoins(amount)
    );

    window.benkyoDebugCoinBoost = (multiplier = 2) => {
      const result = useUserStore.getState().debugActivateCoinBoost(multiplier);
      setCoinBoostModal(result.multiplier);
      return {
        ok: true,
        multiplier: result.multiplier,
        expiresAt: new Date(result.expiresAt).toLocaleString(),
      };
    };

    return () => {
      delete window.benkyoDebugXpBoost;
      delete window.benkyoDebugAddCoins;
      delete window.benkyoDebugCoinBoost;
    };
  }, []);

  if (xpBoostModal === null && coinBoostModal === null) return null;

  return (
    <>
      {xpBoostModal !== null && (
        <XpBoostActivationModal
          multiplier={xpBoostModal}
          onDismiss={() => setXpBoostModal(null)}
        />
      )}
      {coinBoostModal !== null && (
        <XpBoostActivationModal
          multiplier={coinBoostModal}
          boostType="coin"
          onDismiss={() => setCoinBoostModal(null)}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <HashRouter>
      <AppInit />
      <ThemeSync />
      <SoundEffectProvider />
      <XpBoostWidget />
      <DailyTaskToast />
      <DebugConsoleCommands />
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
          <Route path="/practice/wrong-review" element={<WrongReviewPracticePage />} />
          <Route path="/grammar/:chapterId" element={<GrammarPage />} />
          <Route path="/level-knowledge/:chapterId/:levelId" element={<LevelKnowledgePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
