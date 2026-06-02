import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import useUserStore from '../store/userStore';
import AvatarCropper from '../components/Profile/AvatarCropper';
import logoImg from '../assets/icons/logo.png';
import { applyTheme } from '../lib/theme';

export default function ProfileSetupPage() {
  const navigate = useNavigate();
  const setProfile = useUserStore(s => s.setProfile);

  const [nickname, setNickname] = useState('');
  const [gender, setGender] = useState(null);
  const [signature, setSignature] = useState('');
  const [avatarSrc, setAvatarSrc] = useState(null);
  const [cropSrc, setCropSrc] = useState(null);
  const [showCropper, setShowCropper] = useState(false);

  const fileInputRef = useRef(null);
  const headerBgRef = useRef(null);
  const stripeRef = useRef(null);
  const logoRef = useRef(null);
  const avatarRef = useRef(null);
  const formRef = useRef(null);
  const btnRef = useRef(null);
  const submitBtnRef = useRef(null);
  const genderRefs = useRef({});

  // 性别对应的背景色
  const GENDER_COLORS = {
    male:   '#3B82F6',
    female: '#EC4899',
    none:   '#9CA3AF',
  };

  const valid = nickname.length >= 2 && nickname.length <= 12 && gender !== null;

  useGSAP(() => {
    gsap.set([logoRef.current, avatarRef.current, formRef.current, btnRef.current], { opacity: 0, y: 28 });
  });

  // 启动斜纹滚动动画（无限循环）
  useGSAP(() => {
    gsap.to(stripeRef.current, {
      backgroundPositionX: '+=60px',
      repeat: -1,
      duration: 3.5,
      ease: 'none',
    });
  }, []);

  useGSAP(() => {
    const tl = gsap.timeline();
    tl.to(logoRef.current,  { opacity: 1, y: 0, duration: 0.4, ease: 'back.out(2)' }, 0.08);
    tl.to(avatarRef.current, { opacity: 1, y: 0, duration: 0.4, ease: 'back.out(2.5)' }, 0.18);
    tl.to(formRef.current,  { opacity: 1, y: 0, duration: 0.38, ease: 'back.out(1.7)' }, 0.28);
    tl.to(btnRef.current,   { opacity: 1, y: 0, duration: 0.35, ease: 'back.out(1.7)' }, 0.38);
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setCropSrc(ev.target.result); setShowCropper(true); };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleGenderSelect = (value) => {
    setGender(value);
    applyTheme(value);    // 头部背景色过渡
    gsap.to(headerBgRef.current, {
      backgroundColor: GENDER_COLORS[value],
      duration: 0.35,
      ease: 'power2.out',
    });    const el = genderRefs.current[value];
    if (el) {
      gsap.timeline()
        .to(el, { scale: 0.95, duration: 0.08, ease: 'power2.in' })
        .to(el, { scale: 1.05, duration: 0.14, ease: 'back.out(3)' })
        .to(el, { scale: 1,    duration: 0.10, ease: 'power2.out' });
    }
  };

  const handleSubmit = () => {
    if (!valid) return;
    const btn = submitBtnRef.current;
    gsap.timeline()
      .to(btn, { translateY: 4, boxShadow: '0 1px 0 var(--tp-deep)', duration: 0.10, ease: 'power2.in' })
      .to(btn, { translateY: 0, boxShadow: '0 5px 0 var(--tp-deep)', duration: 0.22, ease: 'back.out(2)' })
      .call(() => {
        setProfile({ nickname, gender, avatar: avatarSrc, signature });
        navigate('/');
      });
  };

  return (
    <div data-ui-click-sfx className="flex flex-col h-full overflow-y-auto scroll-y" style={{ background: '#F5F3FF' }}>
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />

      {/* Top gradient header */}
      <div
        ref={headerBgRef}
        style={{
          backgroundColor: GENDER_COLORS.none,
          padding: '52px 24px 64px',
          textAlign: 'center',
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* 滚动斜纹覆盖层 */}
        <div
          ref={stripeRef}
          style={{
            position: 'absolute', inset: 0,
            backgroundImage: `repeating-linear-gradient(
              58deg,
              transparent,
              transparent 20px,
              rgba(255,255,255,0.15) 20px,
              rgba(255,255,255,0.15) 50px
            )`,
            backgroundSize: '60px 100%',
            pointerEvents: 'none',
          }}
        />
        <div ref={logoRef} style={{ position: 'relative' }}>
          <h1 className="jp text-white font-extrabold" style={{ fontSize: 22, lineHeight: 1.3 }}>
            日学へようこそ！
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 13, marginTop: 6 }}>
            设置你的个人资料，开始学习之旅
          </p>
        </div>
      </div>

      {/* Avatar — overlaps header */}
      <div ref={avatarRef} className="flex justify-center" style={{ marginTop: -44 }}>
        <button onClick={() => fileInputRef.current?.click()} style={{ position: 'relative', width: 88, height: 88 }}>
          <div style={{
            width: 88, height: 88, borderRadius: '50%', overflow: 'hidden',
            background: avatarSrc ? 'transparent' : 'var(--tp-lite)',
            border: '4px solid white',
            boxShadow: '0 6px 24px rgba(91,79,233,0.28)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {avatarSrc
              ? <img src={avatarSrc} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <img src={logoImg} alt="默认头像" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            }
          </div>
          <div style={{
            position: 'absolute', bottom: 2, right: 2,
            width: 26, height: 26, borderRadius: '50%',
            background: 'var(--tp)', border: '2px solid white',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13,
          }}>
            {avatarSrc ? '✏️' : '📷'}
          </div>
        </button>
      </div>

      {/* Form fields */}
      <div ref={formRef} style={{ padding: '24px 20px 0', flexShrink: 0 }}>

        {/* Nickname */}
        <div className="bg-white rounded-2xl shadow-sm mb-3" style={{ padding: '16px 18px' }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            昵称 <span style={{ color: '#EF4444' }}>*</span>
          </label>
          <input
            type="text"
            value={nickname}
            onChange={e => setNickname(e.target.value.slice(0, 12))}
            placeholder="2 ~ 12 个字符"
            className="w-full outline-none font-semibold text-base"
            style={{ background: 'transparent', color: '#1E1B4B' }}
          />
          <div style={{ textAlign: 'right', fontSize: 11, marginTop: 6, color: nickname.length > 10 ? '#F59E0B' : '#D1D5DB' }}>
            {nickname.length}/12
          </div>
        </div>

        {/* Gender */}
        <div className="bg-white rounded-2xl shadow-sm mb-3" style={{ padding: '16px 18px' }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
            性别 <span style={{ color: '#EF4444' }}>*</span>
          </label>
          <div className="flex gap-3">
            {[
              { value: 'male',   label: '♂ 男', activeColor: '#3B82F6', activeShadow: 'rgba(59,130,246,0.3)' },
              { value: 'female', label: '♀ 女', activeColor: '#EC4899', activeShadow: 'rgba(236,72,153,0.3)' },
            ].map(({ value, label, activeColor, activeShadow }) => {
              const active = gender === value;
              return (
                <button
                  key={value}
                  ref={el => { genderRefs.current[value] = el; }}
                  onClick={() => handleGenderSelect(value)}
                  className="flex-1 py-3 rounded-xl font-bold text-base"
                  style={{
                    background: active ? activeColor : '#F3F4F6',
                    color: active ? 'white' : '#9CA3AF',
                    boxShadow: active ? `0 4px 14px ${activeShadow}` : 'none',
                    transition: 'background 0.18s ease, color 0.18s ease, box-shadow 0.18s ease',
                  }}
                >{label}</button>
              );
            })}
          </div>
        </div>

        {/* Signature */}
        <div className="bg-white rounded-2xl shadow-sm mb-6" style={{ padding: '16px 18px' }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            个人签名
            <span style={{ color: '#D1D5DB', fontWeight: 400, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}> （选填）</span>
          </label>
          <textarea
            value={signature}
            onChange={e => setSignature(e.target.value.slice(0, 60))}
            placeholder="写点什么…"
            rows={2}
            className="w-full outline-none font-medium text-sm resize-none"
            style={{ background: 'transparent', color: '#1E1B4B' }}
          />
          <div style={{ textAlign: 'right', fontSize: 11, marginTop: 4, color: '#D1D5DB' }}>
            {signature.length}/60
          </div>
        </div>
      </div>

      {/* Submit */}
      <div ref={btnRef} style={{ padding: '0 20px 48px', flexShrink: 0 }}>
        <button
          ref={submitBtnRef}
          onClick={handleSubmit}
          disabled={!valid}
          className="w-full py-4 rounded-2xl font-bold text-white text-lg"
          style={{
            background: valid ? 'var(--tp)' : '#D1D5DB',
            boxShadow: valid ? '0 5px 0 var(--tp-deep)' : 'none',
            transition: 'background 0.2s',
          }}
        >
          开始学习！
        </button>
      </div>

      {showCropper && cropSrc && (
        <AvatarCropper
          imgSrc={cropSrc}
          onConfirm={dataUrl => { setAvatarSrc(dataUrl); setShowCropper(false); setCropSrc(null); }}
          onCancel={() => { setShowCropper(false); setCropSrc(null); }}
        />
      )}
    </div>
  );
}
