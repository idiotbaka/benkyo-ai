import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import bookImg from '../../assets/icons/ui/book.png';

gsap.registerPlugin(useGSAP);

export default function ChapterBanner({ chapter }) {
  const [fromColor, toColor] = chapter.gradient;
  const navigate = useNavigate();
  const hasGrammar = !!chapter.grammar;

  const c1 = useRef(null);
  const c2 = useRef(null);
  const c3 = useRef(null);
  const c4 = useRef(null);

  useGSAP(() => {
    // Each circle drifts on a different phase / speed — organic feel
    const configs = [
      { ref: c1, x:  9, y: -11, dur: 6.2, delay: 0      },
      { ref: c2, x: -12, y:  8, dur: 8.0, delay: 1.4    },
      { ref: c3, x:  7, y:  13, dur: 7.1, delay: 0.7    },
      { ref: c4, x: -8, y:  -9, dur: 5.6, delay: 2.1    },
    ];
    configs.forEach(({ ref, x, y, dur, delay }) => {
      if (!ref.current) return;
      gsap.to(ref.current, {
        x, y,
        repeat: -1,
        yoyo: true,
        duration: dur,
        delay,
        ease: 'sine.inOut',
      });
    });
  }, []);

  return (
    <div
      className="rounded-3xl p-5 mb-2 shadow-lg relative overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${fromColor}, ${toColor})` }}
    >
      {/* Floating decorative circles */}
      <div ref={c1} className="absolute -top-6 -right-6 w-28 h-28 rounded-full opacity-20"
        style={{ background: 'white' }} />
      <div ref={c2} className="absolute -bottom-4 -left-4 w-20 h-20 rounded-full opacity-10"
        style={{ background: 'white' }} />
      <div ref={c3} className="absolute top-2 right-16 w-12 h-12 rounded-full opacity-10"
        style={{ background: 'white' }} />
      <div ref={c4} className="absolute -bottom-2 right-8 w-10 h-10 rounded-full opacity-[0.07]"
        style={{ background: 'white' }} />

      <div className="relative z-10">
        <span className="text-4xl block mb-2">{chapter.icon}</span>
        <h2 className="text-white font-bold text-xl jp leading-tight">
          {chapter.title}
        </h2>
        <p className="text-white/80 text-sm font-medium mt-0.5">{chapter.subtitle}</p>
        <p className="text-white/60 text-xs mt-1">{chapter.description}</p>
        {hasGrammar && (
          <button
            className="btn-press"
            onClick={() => navigate(`/grammar/${chapter.id}`)}
            style={{
              marginTop: 12,
              background: 'rgba(255,255,255,0.22)',
              border: '1.5px solid rgba(255,255,255,0.35)',
              borderRadius: 10, padding: '6px 14px',
              color: 'white', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
            }}
          >
            <img src={bookImg} alt="语法" width={16} height={16} style={{ objectFit: 'contain' }} /> 学习本章语法
          </button>
        )}
      </div>
    </div>
  );
}
