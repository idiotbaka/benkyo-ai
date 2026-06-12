import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useGameStore from '../store/gameStore';
import useNextChapterRecommendationStore from '../store/nextChapterRecommendationStore';
import LessonScreen from '../components/Lesson/LessonScreen';

export default function LessonPage() {
  const { chapterId, levelId } = useParams();
  const navigate = useNavigate();
  const { lesson, startLesson } = useGameStore();

  useEffect(() => {
    // Start the lesson when this page mounts (or if navigated to fresh)
    if (!lesson || lesson.levelId !== levelId) {
      startLesson(chapterId, levelId);
    }
    // If a lesson for this level was already in progress, resume it
  }, [chapterId, levelId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    void useNextChapterRecommendationStore.getState().prefetchForCurrentCourse();
  }, [chapterId, levelId]);

  if (!lesson) {
    // Redirect back if no valid lesson data (e.g. direct URL to empty level)
    navigate('/');
    return null;
  }

  return (
    <div className="flex flex-col h-full">
      <LessonScreen />
    </div>
  );
}
