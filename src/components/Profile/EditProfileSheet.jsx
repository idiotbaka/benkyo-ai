import { useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import useUserStore from '../../store/userStore';
import AvatarCropper from './AvatarCropper';
import logoImg from '../../assets/icons/logo.png';

export default function EditProfileSheet({ onClose }) {
  const { profile, updateProfile } = useUserStore();

  const [nickname, setNickname] = useState(profile?.nickname ?? '');
  const [gender, setGender] = useState(profile?.gender ?? null);
  const [signature, setSignature] = useState(profile?.signature ?? '');
  const [avatarSrc, setAvatarSrc] = useState(profile?.avatar ?? null);
  const [cropSrc, setCropSrc] = useState(null);
  const [showCropper, setShowCropper] = useState(false);

  const overlayRef = useRef(null);
  const sheetRef = useRef(null);
  const fileInputRef = useRef(null);

  const valid = nickname.length >= 2 && nickname.length <= 12 && gender !== null;

  useGSAP(() => {
    gsap.set(overlayRef.current, { opacity: 0 });
    gsap.set(sheetRef.current, { y: '100%' });
  });

  useGSAP(() => {
    const tl = gsap.timeline();
    tl.to(overlayRef.current, { opacity: 1, duration: 0.28 });
    tl.to(sheetRef.current, { y: 0, duration: 0.45, ease: 'back.out(1.6)' }, '-=0.1');
  }, []);

  const handleClose = () => {
    const tl = gsap.timeline({ onComplete: onClose });
    tl.to(sheetRef.current, { y: '100%', duration: 0.3, ease: 'power2.in' });
    tl.to(overlayRef.current, { opacity: 0, duration: 0.2 }, '-=0.15');
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setCropSrc(ev.target.result); setShowCropper(true); };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSave = () => {
    if (!valid) return;
    updateProfile({ nickname, gender, signature, avatar: avatarSrc });
    handleClose();
  };

  return (
    <>
      <div
        ref={overlayRef}
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.42)' }}
        onClick={handleClose}
      />
      <div
        ref={sheetRef}
        className="fixed bottom-0 left-0 right-0 z-40 overflow-y-auto scroll-y"
        style={{
          background: 'white',
          borderRadius: '24px 24px 0 0',
          maxHeight: '88vh',
          boxShadow: '0 -8px 40px rgba(91,79,233,0.15)',
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div style={{ width: 40, height: 4, borderRadius: 2, background: '#E5E7EB' }} />
        </div>

        <div style={{ padding: '12px 20px 48px' }}>
          <h2 className="font-extrabold text-center mb-5" style={{ fontSize: 18, color: '#1E1B4B' }}>
            编辑资料
          </h2>

          {/* Avatar */}
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
          <div className="flex justify-center mb-5">
            <button onClick={() => fileInputRef.current?.click()} style={{ position: 'relative', width: 72, height: 72 }}>
              <div style={{
                width: 72, height: 72, borderRadius: '50%', overflow: 'hidden',
                background: 'var(--tp-lite)', border: '3px solid var(--tp-bdr)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {avatarSrc
                  ? <img src={avatarSrc} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <img src={logoImg} alt="默认头像" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                }
              </div>
              <div style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 22, height: 22, borderRadius: '50%',
                background: 'var(--tp)', border: '2px solid white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11,
              }}>📷</div>
            </button>
          </div>

          {/* Nickname */}
          <div className="rounded-2xl mb-3" style={{ background: '#F9F8FF', padding: '14px 16px', border: '1px solid #E5E0FF' }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              昵称
            </label>
            <input
              type="text"
              value={nickname}
              onChange={e => setNickname(e.target.value.slice(0, 12))}
              className="w-full outline-none font-semibold text-base"
              style={{ background: 'transparent', color: '#1E1B4B' }}
            />
            <div style={{ textAlign: 'right', fontSize: 11, marginTop: 4, color: '#D1D5DB' }}>{nickname.length}/12</div>
          </div>

          {/* Gender */}
          <div className="rounded-2xl mb-3" style={{ background: '#F9F8FF', padding: '14px 16px', border: '1px solid #E5E0FF' }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
              性别
            </label>
            <div className="flex gap-3">
              {[
                { value: 'male',   label: '♂ 男', color: '#3B82F6' },
                { value: 'female', label: '♀ 女', color: '#EC4899' },
              ].map(({ value, label, color }) => {
                const active = gender === value;
                return (
                  <button
                    key={value}
                    onClick={() => setGender(value)}
                    className="flex-1 py-2.5 rounded-xl font-bold text-sm"
                    style={{
                      background: active ? color : '#F3F4F6',
                      color: active ? 'white' : '#9CA3AF',
                      transition: 'all 0.18s ease',
                    }}
                  >{label}</button>
                );
              })}
            </div>
          </div>

          {/* Signature */}
          <div className="rounded-2xl mb-6" style={{ background: '#F9F8FF', padding: '14px 16px', border: '1px solid #E5E0FF' }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
              个人签名
            </label>
            <textarea
              value={signature}
              onChange={e => setSignature(e.target.value.slice(0, 60))}
              placeholder="写点什么…"
              rows={2}
              className="w-full outline-none font-medium text-sm resize-none"
              style={{ background: 'transparent', color: '#1E1B4B' }}
            />
            <div style={{ textAlign: 'right', fontSize: 11, marginTop: 4, color: '#D1D5DB' }}>{signature.length}/60</div>
          </div>

          <button
            onClick={handleSave}
            disabled={!valid}
            className="w-full py-4 rounded-2xl font-bold text-white text-base"
            style={{
              background: valid ? 'var(--tp)' : '#D1D5DB',
              boxShadow: valid ? '0 5px 0 var(--tp-deep)' : 'none',
              transition: 'background 0.2s, box-shadow 0.2s',
            }}
            onMouseDown={e => valid && gsap.to(e.currentTarget, { translateY: 4, boxShadow: '0 1px 0 var(--tp-deep)', duration: 0.08 })}
            onMouseUp={e => valid && gsap.to(e.currentTarget, { translateY: 0, boxShadow: '0 5px 0 var(--tp-deep)', duration: 0.15, ease: 'back.out(2)' })}
          >保存</button>
        </div>
      </div>

      {showCropper && cropSrc && (
        <AvatarCropper
          imgSrc={cropSrc}
          onConfirm={dataUrl => { setAvatarSrc(dataUrl); setShowCropper(false); setCropSrc(null); }}
          onCancel={() => { setShowCropper(false); setCropSrc(null); }}
        />
      )}
    </>
  );
}
