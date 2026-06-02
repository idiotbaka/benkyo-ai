import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import useUserStore from '../store/userStore';
import useGameStore, { computeLevel, XP_PER_LEVEL } from '../store/gameStore';
import useCourseStore from '../store/courseStore';
import EditProfileSheet from '../components/Profile/EditProfileSheet';
import BackpackSheet from '../components/Profile/BackpackSheet';
import HeartDisplay from '../components/UI/HeartDisplay';
import CheckInModal from '../components/UI/CheckInModal';
import lvImg from '../assets/icons/ui/lv.png';
import logoImg from '../assets/icons/logo.png';
import lvUpImg from '../assets/icons/ui/level_up.png';
import fireImg from '../assets/icons/ui/fire.png';
import completedImg from '../assets/icons/ui/completed_levels.png';
import collectStarImg from '../assets/icons/ui/collect_star.png';
import bagImg from '../assets/icons/ui/bag.png';
import checkInImg from '../assets/icons/ui/check_in.png';
import settingImg from '../assets/icons/ui/setting.png';
import coinImg from '../assets/icons/item/coin.png';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { profile, currentStreak } = useUserStore();
  const coins = useUserStore(s => s.coins);
  const lastCheckIn = useUserStore(s => s.lastCheckIn);
  const checkIn = useUserStore(s => s.checkIn);
  const totalXp = useGameStore(s => s.totalXp);
  const levelProgress = useGameStore(s => s.levelProgress);
  const [showEdit, setShowEdit] = useState(false);
  const [showBackpack, setShowBackpack] = useState(false);
  const [checkInCoins, setCheckInCoins] = useState(null); // null = not shown
  const chapters = useCourseStore(s => s.chapters);

  const level = computeLevel(totalXp);
  const xpInLevel = totalXp % XP_PER_LEVEL;
  const xpPct = (xpInLevel / XP_PER_LEVEL) * 100;

  const completedCount = Object.values(levelProgress).filter(v => v.completed).length;
  const totalLevels = chapters.reduce((sum, ch) => sum + ch.levels.length, 0);
  const totalStars = Object.values(levelProgress).reduce((sum, v) => sum + (v.stars ?? 0), 0);

  const today = new Date().toISOString().slice(0, 10);
  const checkedInToday = lastCheckIn === today;

  const handleCheckIn = () => {
    if (checkedInToday) return;
    const awarded = checkIn();
    if (awarded > 0) setCheckInCoins(awarded);
  };
  const genderIcon  = profile?.gender === 'male' ? '♂' : profile?.gender === 'female' ? '♀' : '';
  const genderColor = profile?.gender === 'male' ? '#3B82F6' : '#EC4899';

  const headerRef = useRef(null);
  const statsRef = useRef(null);
  const progressRef = useRef(null);
  const settingsBtnRef = useRef(null);
  const editBtnRef = useRef(null);
  const backpackBtnRef = useRef(null);
  const checkInBtnRef = useRef(null);
  // Floating bubble refs
  const b1 = useRef(null);
  const b2 = useRef(null);
  const b3 = useRef(null);
  const b4 = useRef(null);
  const b5 = useRef(null);

  const pressAndRun = (ref, fn) => {
    gsap.timeline()
      .to(ref.current, { scale: 0.88, duration: 0.08, ease: 'power2.in' })
      .to(ref.current, { scale: 1, duration: 0.18, ease: 'back.out(2.5)' })
      .call(fn);
  };

  useGSAP(() => {
    gsap.set([headerRef.current, statsRef.current, progressRef.current], { opacity: 0, y: 22 });
  });

  // Floating bubbles drift
  useGSAP(() => {
    const configs = [
      { ref: b1, x:  22, y: -18, dur: 7.0, delay: 0    },
      { ref: b2, x: -20, y:  16, dur: 8.6, delay: 1.2  },
      { ref: b3, x:  18, y:  20, dur: 6.8, delay: 0.5  },
      { ref: b4, x: -16, y: -18, dur: 9.2, delay: 2.0  },
      { ref: b5, x:  14, y:  12, dur: 7.4, delay: 3.1  },
    ];
    configs.forEach(({ ref, x, y, dur, delay }) => {
      if (!ref.current) return;
      gsap.to(ref.current, { x, y, repeat: -1, yoyo: true, duration: dur, delay, ease: 'sine.inOut' });
    });
  }, []);

  useGSAP(() => {
    const tl = gsap.timeline();
    tl.to(headerRef.current, { opacity: 1, y: 0, duration: 0.4, ease: 'back.out(2)' }, 0.05);
    tl.to(statsRef.current,  { opacity: 1, y: 0, duration: 0.38, ease: 'back.out(1.7)' }, 0.15);
    tl.to(progressRef.current, { opacity: 1, y: 0, duration: 0.35, ease: 'back.out(1.7)' }, 0.25);
  }, []);

  return (
    <div data-ui-click-sfx className="h-full overflow-y-auto scroll-y" style={{ background: '#F5F3FF' }}>

      {/* Hero header */}
      <div
        ref={headerRef}
        style={{
          background: 'linear-gradient(155deg, var(--tp) 0%, var(--tp-from) 100%)',
          padding: '36px 20px 68px',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 浮动装饰圆圈 */}
        {/* b1: 左上大圆，远离右上角按钮 */}
        <div ref={b1} className="absolute rounded-full opacity-[0.18]"
          style={{ background: 'white', width: 160, height: 160, top: -48, left: '20%' }} />
        {/* b2: 左下中圆 */}
        <div ref={b2} className="absolute rounded-full opacity-[0.12]"
          style={{ background: 'white', width: 100, height: 100, bottom: -28, left: -20 }} />
        {/* b3: 中央偏右小圆 */}
        <div ref={b3} className="absolute rounded-full opacity-[0.09]"
          style={{ background: 'white', width: 64, height: 64, top: '30%', left: '55%' }} />
        {/* b4: 底部右侧中圆 */}
        <div ref={b4} className="absolute rounded-full opacity-[0.07]"
          style={{ background: 'white', width: 88, height: 88, bottom: -20, right: 40 }} />
        {/* b5: 中部左侧小圆 */}
        <div ref={b5} className="absolute rounded-full opacity-[0.10]"
          style={{ background: 'white', width: 44, height: 44, top: '45%', left: '30%' }} />
        <button
          ref={editBtnRef}
          onClick={() => pressAndRun(editBtnRef, () => setShowEdit(true))}
          style={{
            position: 'absolute', top: 16, right: 16,
            background: 'rgba(255,255,255,0.18)',
            borderRadius: 12, padding: '6px 16px',
            color: 'white', fontSize: 13, fontWeight: 700,
            backdropFilter: 'blur(4px)',
            border: 'none', cursor: 'pointer',
          }}
        >
          编辑
        </button>
        <button
          ref={settingsBtnRef}
          onClick={() => pressAndRun(settingsBtnRef, () => navigate('/settings'))}
          style={{
            position: 'absolute', top: 16, left: 16,
            background: 'rgba(255,255,255,0.18)',
            borderRadius: 12, padding: '6px 14px',
            color: 'white', fontSize: 13, fontWeight: 700,
            backdropFilter: 'blur(4px)',
            border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          <img src={settingImg} alt="设置" width={16} height={16} style={{ objectFit: 'contain' }} /> 设置
        </button>

        <div className="flex flex-col items-center text-center">
          <div style={{
            width: 80, height: 80, borderRadius: '50%', overflow: 'hidden',
            background: 'var(--tp-lite)',
            border: '3px solid rgba(255,255,255,0.5)',
            marginBottom: 12,
            boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          }}>
            {profile?.avatar
              ? <img src={profile.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <img src={logoImg} alt="默认头像" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            }
          </div>

          <div className="flex items-center gap-2 mb-2">
            <span className="text-white font-extrabold" style={{ fontSize: 20 }}>{profile?.nickname}</span>
            {genderIcon && (
              <span style={{ color: genderColor, fontSize: 16, fontWeight: 800, textShadow: '0 0 8px rgba(0,0,0,0.3)' }}>
                {genderIcon}
              </span>
            )}
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.2)',
            borderRadius: 20, padding: '4px 14px',
            marginBottom: profile?.signature ? 10 : 0,
          }}>
            <span style={{ color: 'rgba(255,255,255,0.92)', fontWeight: 700, fontSize: 18, display: 'flex', alignItems: 'center', gap: 4 }}>
              <img src={lvImg} alt="等级" width={32} height={32} style={{ objectFit: 'contain' }} />
              Lv.{level}
            </span>
          </div>

          {profile?.signature && (
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginTop: 6, maxWidth: 260, lineHeight: 1.5 }}>
              {profile.signature}
            </p>
          )}
        </div>
      </div>

      {/* Stats card — overlaps hero */}
      <div ref={statsRef} style={{ margin: '-36px 16px 0', position: 'relative' }}>
        <div className="bg-white rounded-2xl" style={{ padding: '20px 16px', boxShadow: '0 4px 24px rgba(91,79,233,0.12)' }}>
          <div className="flex">
            {[
              { icon: <img src={lvUpImg} alt="XP" width={32} height={32} style={{ objectFit: 'contain' }} />, label: '总经验', value: `${totalXp}`, unit: ' XP', color: '#F59E0B' },
              { icon: <img src={fireImg} alt="连胜" width={32} height={32} style={{ objectFit: 'contain' }} />, label: '连胜天数', value: `${currentStreak}`, unit: ' 天', color: '#EF4444' },
              { icon: <img src={completedImg} alt="完成" width={32} height={32} style={{ objectFit: 'contain' }} />, label: '完成关卡', value: `${completedCount}`, unit: `/${totalLevels}`, color: 'var(--tp)' },
              { icon: <img src={collectStarImg} alt="星星" width={32} height={32} style={{ objectFit: 'contain' }} />, label: '累计星星', value: `${totalStars}`, unit: '', color: '#D97706' },
            ].map(({ icon, label, value, unit, color }) => (
              <div key={label} className="flex-1 text-center">
                <div style={{ fontSize: 22, marginBottom: 4, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>{icon}</div>
                <div style={{ fontWeight: 800, color, lineHeight: 1.2 }}>
                  <span style={{ fontSize: 18 }}>{value}</span>
                  <span style={{ fontSize: 12 }}>{unit}</span>
                </div>
                <div style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, marginTop: 3 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* XP progress bar */}
          <div style={{ marginTop: 18 }}>

          {/* Hearts row */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>生命値</span>
            <HeartDisplay size="sm" />
          </div>

          {/* Coins row */}
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: 14 }}>
            <div style={{ display:'flex', alignItems:'center', gap: 6 }}>
              <img src={coinImg} alt="金币" width={18} height={18} style={{ objectFit: 'contain' }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: '#9CA3AF' }}>金币余额</span>
            </div>
            <span style={{ fontSize: 16, fontWeight: 800, color: '#D97706' }}>{coins}</span>
          </div>

          {/* Backpack button */}
          <button
            ref={backpackBtnRef}
            onClick={() => pressAndRun(backpackBtnRef, () => setShowBackpack(true))}
            style={{
              width: '100%', padding: '10px 0', marginBottom: 8,
              borderRadius: 14, border: '1.5px solid #E9E6FF',
              background: '#F5F3FF',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              cursor: 'pointer',
            }}
          >
            <img src={bagImg} alt="背包" width={20} height={20} style={{ objectFit: 'contain' }} />
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--tp)' }}>打开背包</span>
          </button>

          {/* Check-in button */}
          <button
            ref={checkInBtnRef}
            onClick={() => checkedInToday ? undefined : pressAndRun(checkInBtnRef, handleCheckIn)}
            disabled={checkedInToday}
            style={{
              width: '100%', padding: '10px 0', marginBottom: 16,
              borderRadius: 14, border: `1.5px solid ${checkedInToday ? '#E5E7EB' : '#FDE68A'}`,
              background: checkedInToday ? '#F9FAFB' : '#FFFBEB',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              cursor: checkedInToday ? 'not-allowed' : 'pointer',
            }}
          >
            <img src={checkInImg} alt="签到" width={22} height={22} style={{ objectFit: 'contain' }} />
            <span style={{ fontSize: 13, fontWeight: 800, color: checkedInToday ? '#9CA3AF' : '#D97706' }}>
              {checkedInToday ? '今日已签到' : '每日签到'}
            </span>
            {!checkedInToday && (
              <span style={{ fontSize: 11, fontWeight: 600, color: '#B45309', background: '#FDE68A', borderRadius: 8, padding: '1px 7px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                60–120 <img src={coinImg} alt="金币" width={12} height={12} style={{ objectFit: 'contain' }} />
              </span>
            )}
          </button>

            <div className="flex justify-between" style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, marginBottom: 7 }}>
              <span>升到 Lv.{level + 1}</span>
              <span>{xpInLevel} / {XP_PER_LEVEL} XP</span>
            </div>
            <div style={{ height: 8, background: 'var(--tp-lite)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${xpPct}%`,
                background: 'linear-gradient(90deg, var(--tp-from), var(--tp))',
                borderRadius: 4,
                transition: 'width 0.8s ease',
              }} />
            </div>
          </div>
        </div>
      </div>

      {/* Course progress */}
      <div ref={progressRef} style={{ margin: '16px 16px 28px' }}>
        <h3 style={{ fontSize: 12, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
          课程进度
        </h3>
        {chapters.map(ch => {
          const total = ch.levels.length;
          const done = ch.levels.filter(l => levelProgress[l.id]?.completed).length;
          const pct = total > 0 ? (done / total) * 100 : 0;
          const finished = done === total && total > 0;
          const chStars = ch.levels.reduce((sum, l) => sum + (levelProgress[l.id]?.stars ?? 0), 0);
          const maxChStars = total * 3;
          return (
            <div key={ch.id} className="bg-white rounded-2xl mb-3" style={{ padding: '14px 16px', boxShadow: '0 2px 10px rgba(91,79,233,0.06)' }}>
              <div className="flex items-center gap-3 mb-3">
                <span style={{ fontSize: 24 }}>{ch.icon}</span>
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#1E1B4B', marginBottom: 2 }}>
                    {ch.title} · {ch.subtitle}
                  </div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>{done}/{total} 关卡完成</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                  <div style={{
                    fontSize: 12, fontWeight: 700,
                    color: finished ? '#22C55E' : 'var(--tp)',
                    background: finished ? '#F0FDF4' : 'var(--tp-lite)',
                    borderRadius: 12, padding: '3px 10px',
                  }}>
                    {Math.round(pct)}%
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                    <span style={{ fontSize: 12 }}>⭐</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: chStars > 0 ? '#D97706' : '#9CA3AF' }}>
                      {chStars}/{maxChStars}
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ height: 6, background: '#F3F4F6', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${pct}%`,
                  background: `linear-gradient(90deg, ${ch.gradient[0]}, ${ch.gradient[1]})`,
                  borderRadius: 3,
                  transition: 'width 0.7s ease',
                  minWidth: pct > 0 ? 6 : 0,
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {showEdit && <EditProfileSheet onClose={() => setShowEdit(false)} />}
      {showBackpack && <BackpackSheet onClose={() => setShowBackpack(false)} />}
      {checkInCoins !== null && (
        <CheckInModal coins={checkInCoins} onDismiss={() => setCheckInCoins(null)} />
      )}
    </div>
  );
}
