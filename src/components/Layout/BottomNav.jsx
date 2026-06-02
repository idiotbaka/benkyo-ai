import { useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import gsap from 'gsap';

import homeOff from '../../assets/icons/nav/home_1.png';
import homeOn  from '../../assets/icons/nav/home_2.png';
import shopOff from '../../assets/icons/nav/shop_1.png';
import shopOn  from '../../assets/icons/nav/shop_2.png';
import vocabOff from '../../assets/icons/nav/vocabulary_1.png';
import vocabOn  from '../../assets/icons/nav/vocabulary_2.png';
import myOff from '../../assets/icons/nav/my_1.png';
import myOn  from '../../assets/icons/nav/my_2.png';

const TABS = [
  { path: '/',        label: '首页',  iconOff: homeOff,  iconOn: homeOn  },
  { path: '/shop',    label: '商店',  iconOff: shopOff,  iconOn: shopOn  },
  { path: '/vocab',   label: '单词本', iconOff: vocabOff, iconOn: vocabOn },
  { path: '/profile', label: '我的',  iconOff: myOff,    iconOn: myOn    },
];

const INDICATOR_W = 40;

export default function BottomNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const navRef = useRef(null);
  const indicatorRef = useRef(null);
  const tabRefs = useRef([]);
  const initialized = useRef(false);

  const activeIdx = Math.max(0, TABS.findIndex(t => t.path === location.pathname));

  useEffect(() => {
    const nav = navRef.current;
    const indicator = indicatorRef.current;
    if (!nav || !indicator) return;

    const tabW = nav.offsetWidth / TABS.length;
    const targetX = activeIdx * tabW + (tabW - INDICATOR_W) / 2;

    if (!initialized.current) {
      gsap.set(indicator, { x: targetX });
      initialized.current = true;
    } else {
      gsap.to(indicator, { x: targetX, duration: 0.32, ease: 'back.out(2.5)' });
    }
  }, [activeIdx]);

  const handleTab = (tab, idx) => {
    if (location.pathname === tab.path) return;
    const el = tabRefs.current[idx];
    if (el) {
      gsap.timeline()
        .to(el, { scale: 0.82, duration: 0.1 })
        .to(el, { scale: 1, duration: 0.38, ease: 'back.out(3)' });
    }
    navigate(tab.path);
  };

  return (
    <div
      ref={navRef}
      data-ui-click-sfx
      className="shrink-0 relative flex"
      style={{
        background: 'white',
        borderTop: '1px solid #E5E0FF',
        boxShadow: '0 -2px 16px rgba(91,79,233,0.07)',
      }}
    >
      {/* Sliding indicator at top */}
      <div
        ref={indicatorRef}
        style={{
          position: 'absolute',
          top: 0, left: 0,
          width: INDICATOR_W,
          height: 3,
          borderRadius: '0 0 4px 4px',
          background: 'linear-gradient(90deg, var(--tp-from), var(--tp))',
        }}
      />

      {TABS.map((tab, idx) => {
        const isActive = idx === activeIdx;
        return (
          <button
            key={tab.path}
            ref={el => { tabRefs.current[idx] = el; }}
            onClick={() => handleTab(tab, idx)}
            className="flex-1 flex flex-col items-center pt-3 pb-4 gap-0.5"
            style={{ WebkitTapHighlightColor: 'transparent' }}
          >
            <img
              src={isActive ? tab.iconOn : tab.iconOff}
              alt={tab.label}
              width={56}
              height={56}
              style={{ imageRendering: '-webkit-optimize-contrast', objectFit: 'contain' }}
            />
            <span
              className="text-xs font-bold"
              style={{
                color: isActive ? 'var(--tp)' : '#9CA3AF',
                transition: 'color 0.2s',
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
