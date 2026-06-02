import LevelMap from '../components/Map/LevelMap';
import useGameStore, { computeLevel } from '../store/gameStore';
import HeartDisplay from '../components/UI/HeartDisplay';
import AutoGenWidget from '../components/UI/AutoGenWidget';
import logoImg32 from '../assets/icons/logo_32.png';
import lvImg from '../assets/icons/ui/lv.png';
import lvUpImg from '../assets/icons/ui/level_up.png';

export default function HomePage() {
  const totalXp = useGameStore(s => s.totalXp);
  const level = computeLevel(totalXp);

  return (
    <div data-ui-click-sfx className="flex flex-col h-full bg-[#F5F3FF]">
      <header className="flex items-center justify-between px-5 py-3 bg-white border-b border-[#E5E0FF] shrink-0">
        <div className="flex items-center gap-2">
          <img src={logoImg32} alt="日学" width={32} height={32} style={{ imageRendering: '-webkit-optimize-contrast', objectFit: 'contain' }} />
          <div>
            <h1 className="text-base font-extrabold jp text-[#1E1B4B] leading-tight">日学</h1>
            <p className="text-[10px] text-[#9CA3AF] font-medium leading-tight">日本語学習</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <HeartDisplay size="sm" />
          <div className="flex items-center gap-1 bg-[var(--tp-lite)] rounded-full px-3 py-1">
            <img src={lvImg} alt="等级" width={32} height={32} style={{ objectFit: 'contain' }} />
            <span className="text-xs font-bold text-[var(--tp)]">Lv.{level}</span>
          </div>
          <div className="flex items-center gap-1 bg-[#FEF3C7] rounded-full px-3 py-1">
            <img src={lvUpImg} alt="XP" width={32} height={32} style={{ objectFit: 'contain' }} />
            <span className="text-xs font-bold text-[#D97706]">{totalXp} XP</span>
          </div>
        </div>
      </header>

      <LevelMap />
      <AutoGenWidget />
    </div>
  );
}
