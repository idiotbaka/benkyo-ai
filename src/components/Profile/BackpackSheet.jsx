import { useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import useUserStore, { MAX_HEARTS } from '../../store/userStore';
import { ITEM_DEFINITIONS } from '../../data/shopItems';
import { drawGiftboxOpenReward } from '../../lib/giftbox-rewards';
import XpBoostActivationModal from '../UI/XpBoostActivationModal';
import RewardModal from '../UI/RewardModal';
import { useIcon, useIconResolver } from '../../lib/icons';

gsap.registerPlugin(useGSAP);

export default function BackpackSheet({ onClose, onBadgeProgressChange }) {
  const inventory   = useUserStore(s => s.inventory);
  const hearts      = useUserStore(s => s.hearts);
  const xpBoost     = useUserStore(s => s.xpBoost);
  const coinBoost   = useUserStore(s => s.coinBoost);
  const consumeCake    = useUserStore(s => s.useCake);
  const consumeCoffee  = useUserStore(s => s.useCoffee);
  const consumeSweetsSet = useUserStore(s => s.useSweetsSet);
  const openGiftbox = useUserStore(s => s.useGiftbox);
  const activateXpCard = useUserStore(s => s.useXpCard);
  const activateCoinCard = useUserStore(s => s.useCoinCard);
  const lastCoffeeUsedDate = useUserStore(s => s.lastCoffeeUsedDate);
  const bagImg = useIcon('ui/bag.png');
  const resolveIcon = useIconResolver();

  const [activationBoost, setActivationBoost] = useState(null);
  const [giftboxReward, setGiftboxReward] = useState(null);

  // Brief button flash: itemId → 'used' | 'full'
  const [flash, setFlash] = useState({});
  const triggerFlash = (id, type) => {
    setFlash(f => ({ ...f, [id]: type }));
    setTimeout(() => setFlash(f => ({ ...f, [id]: null })), 1300);
  };

  const today = new Date().toISOString().slice(0, 10);
  const hasActiveBoost = Boolean(xpBoost || coinBoost);
  const coffeeUsedToday = lastCoffeeUsedDate === today;

  // Is the 使用 button disabled for this item?
  const isDisabled = (item) => {
    const count = inventory?.[item.id] ?? 0;
    if (count === 0) return true;
    if (item.usable === false) return true;
    if (item.id === 'coffee' && (!hasActiveBoost || coffeeUsedToday)) return true;
    if (item.id === 'sweets_set' && hearts >= MAX_HEARTS) return true;
    if (item.id === 'cake' && hearts >= MAX_HEARTS) return true;
    if (item.multiplier && (xpBoost !== null || coinBoost !== null)) return true; // boost already active
    return false;
  };

  // Label + style for the button
  const btnConfig = (item) => {
    const count = inventory?.[item.id] ?? 0;
    const f = flash[item.id];
    if (f === 'used') return { label: '✓ 已使用', bg: '#22C55E', color: 'white', shadow: 'none', cursor: 'default' };
    if (count === 0) return { label: '使用', bg: '#F3F4F6', color: '#D1D5DB', shadow: 'none', cursor: 'not-allowed' };
    if (item.usable === false) return { label: '收纳中', bg: '#F3F4F6', color: '#9CA3AF', shadow: 'none', cursor: 'default' };
    if (item.id?.startsWith('giftbox')) return {
      label: '开启',
      bg: 'linear-gradient(135deg, #F59E0B, #EF4444)',
      color: 'white',
      shadow: '0 3px 10px rgba(245,158,11,0.28)',
      cursor: 'pointer',
    };
    if (item.id === 'coffee' && coffeeUsedToday)
      return { label: '今日已用', bg: '#E0F2FE', color: '#0369A1', shadow: 'none', cursor: 'not-allowed' };
    if (item.id === 'coffee' && !hasActiveBoost)
      return { label: '需有加成', bg: '#F3F4F6', color: '#9CA3AF', shadow: 'none', cursor: 'not-allowed' };
    if (item.id === 'sweets_set' && hearts >= MAX_HEARTS)
      return { label: '已满血', bg: '#FEF9C3', color: '#CA8A04', shadow: 'none', cursor: 'not-allowed' };
    if (item.id === 'cake' && hearts >= MAX_HEARTS)
      return { label: '已满血', bg: '#FEF9C3', color: '#CA8A04', shadow: 'none', cursor: 'not-allowed' };
    if (item.multiplier && (xpBoost !== null || coinBoost !== null))
      return { label: '加成生效中', bg: '#D1FAE5', color: '#065F46', shadow: 'none', cursor: 'not-allowed' };
    return {
      label: '使用',
      bg: 'linear-gradient(135deg, var(--tp-from), var(--tp))',
      color: 'white',
      shadow: '0 3px 10px rgba(91,79,233,0.30)',
      cursor: 'pointer',
    };
  };

  const handleUse = (item) => {
    if (isDisabled(item)) return;
    if (item.multiplier) {
      const ok = item.boostType === 'coin'
        ? activateCoinCard(item.multiplier)
        : activateXpCard(item.multiplier);
      if (ok) setActivationBoost({ multiplier: item.multiplier, boostType: item.boostType ?? 'xp' });
      else triggerFlash(item.id, 'full');
      return;
    }
    if (item.id === 'cake') {
      const ok = consumeCake();
      triggerFlash(item.id, ok ? 'used' : 'full');
      if (ok) onBadgeProgressChange?.();
    }
    if (item.id === 'coffee') {
      const ok = consumeCoffee();
      triggerFlash(item.id, ok ? 'used' : 'full');
    }
    if (item.id === 'sweets_set') {
      const ok = consumeSweetsSet();
      triggerFlash(item.id, ok ? 'used' : 'full');
    }
    if (item.id?.startsWith('giftbox')) {
      const reward = drawGiftboxOpenReward(item.id);
      const ok = openGiftbox(item.id, reward);
      if (ok) setGiftboxReward(reward);
      else triggerFlash(item.id, 'full');
    }
  };

  const overlayRef = useRef(null);
  const sheetRef   = useRef(null);

  // Entrance
  useGSAP(() => {
    gsap.set(overlayRef.current, { opacity: 0 });
    gsap.set(sheetRef.current, { y: '100%' });
  });
  useGSAP(() => {
    const tl = gsap.timeline();
    tl.to(overlayRef.current, { opacity: 1, duration: 0.25 });
    tl.to(sheetRef.current, { y: 0, duration: 0.42, ease: 'back.out(1.6)' }, '-=0.1');
  }, []);

  const handleClose = () => {
    const tl = gsap.timeline({ onComplete: onClose });
    tl.to(sheetRef.current, { y: '100%', duration: 0.28, ease: 'power2.in' });
    tl.to(overlayRef.current, { opacity: 0, duration: 0.18 }, '-=0.12');
  };

  const heldItems = ITEM_DEFINITIONS.filter(item => (inventory?.[item.id] ?? 0) > 0);
  const totalItems = heldItems.reduce((sum, item) => sum + (inventory?.[item.id] ?? 0), 0);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
      {/* Backdrop */}
      <div
        ref={overlayRef}
        onClick={handleClose}
        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.45)' }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          background: 'white',
          borderRadius: '24px 24px 0 0',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Handle bar */}
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12, paddingBottom: 4 }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#E5E7EB' }} />
        </div>

        {/* Header */}
        <div style={{ padding: '10px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 900, color: '#1E1B4B', marginBottom: 2, display: 'flex', alignItems: 'center', gap: 6 }}><img src={bagImg} alt="背包" width={24} height={24} style={{ objectFit: 'contain' }} /> 我的背包</h2>
            <p style={{ fontSize: 12, color: '#9CA3AF' }}>
              共 {totalItems} 件道具
            </p>
          </div>
          <button
            onClick={handleClose}
            style={{
              width: 32, height: 32, borderRadius: 10,
              background: '#F3F4F6',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, color: '#6B7280', border: 'none', cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {/* Item list */}
        <div style={{ overflowY: 'auto', padding: '0 16px 32px', flex: 1, display: heldItems.length === 0 ? 'flex' : 'block', alignItems: 'center', justifyContent: 'center' }}>
          {heldItems.length === 0 ? (
            <p style={{ fontSize: 14, fontWeight: 800, color: '#9CA3AF', textAlign: 'center', lineHeight: 1.6 }}>
              背包空空如也，快去商店购买吧！
            </p>
          ) : heldItems.map((item) => {
            const itemImg = resolveIcon(item.iconPath);
            const count = inventory?.[item.id] ?? 0;
            const disabled = isDisabled(item);
            const btn = btnConfig(item);
            return (
              <div
                key={item.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '14px 16px',
                  background: count > 0 ? 'white' : '#FAFAFA',
                  borderRadius: 18,
                  marginBottom: 10,
                  boxShadow: count > 0
                    ? '0 2px 12px rgba(91,79,233,0.09)'
                    : '0 1px 4px rgba(0,0,0,0.04)',
                  border: `1.5px solid ${count > 0 ? '#E9E6FF' : '#F3F4F6'}`,
                  opacity: count > 0 ? 1 : 0.55,
                  transition: 'opacity 0.2s',
                }}
              >
                {/* Icon */}
                <div
                  style={{
                    width: 52, height: 52, borderRadius: 14,
                    background: item.iconBg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 26, flexShrink: 0,
                    position: 'relative',
                  }}
                >
                  <img src={itemImg} alt={item.name} width={32} height={32} style={{ objectFit: 'contain' }} />
                  {/* Count badge */}
                  <div
                    style={{
                      position: 'absolute', top: -4, right: -4,
                      minWidth: 20, height: 20,
                      background: count > 0 ? 'var(--tp)' : '#D1D5DB',
                      borderRadius: 10,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 11, fontWeight: 800, color: 'white',
                      padding: '0 5px',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
                    }}
                  >
                    {count}
                  </div>
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <span style={{ fontSize: 14, fontWeight: 800, color: '#1E1B4B' }}>{item.name}</span>
                    {item.subtitle && (
                      <span
                        style={{
                          fontSize: 10, fontWeight: 700, color: item.color,
                          background: item.iconBg,
                          borderRadius: 8, padding: '1px 7px',
                        }}
                      >
                        {item.subtitle}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: '#9CA3AF', lineHeight: 1.3 }}>{item.desc}</p>
                  {(item.id === 'cake' || item.id === 'sweets_set') && count > 0 && hearts >= MAX_HEARTS && (
                    <p style={{ fontSize: 11, color: '#CA8A04', fontWeight: 600, marginTop: 3 }}>
                      ♥ 心心已满，不需要使用
                    </p>
                  )}
                  {item.id === 'coffee' && count > 0 && coffeeUsedToday && (
                    <p style={{ fontSize: 11, color: '#0369A1', fontWeight: 600, marginTop: 3 }}>
                      今日已使用，明天再来一罐
                    </p>
                  )}
                  {item.id === 'coffee' && count > 0 && !coffeeUsedToday && !hasActiveBoost && (
                    <p style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, marginTop: 3 }}>
                      需要先开启经验或金币加成
                    </p>
                  )}
                </div>

                {/* Use button */}
                <button
                  disabled={disabled}
                  onClick={() => handleUse(item)}
                  style={{
                    flexShrink: 0,
                    padding: '8px 18px',
                    borderRadius: 14,
                    fontWeight: 800,
                    fontSize: 13,
                    border: 'none',
                    cursor: btn.cursor,
                    background: btn.bg,
                    color: btn.color,
                    boxShadow: btn.shadow,
                    transition: 'all 0.18s',
                  }}
                >
                  {btn.label}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* XP boost activation celebration modal */}
      {activationBoost !== null && (
        <XpBoostActivationModal
          multiplier={activationBoost.multiplier}
          boostType={activationBoost.boostType}
          onDismiss={() => setActivationBoost(null)}
        />
      )}
      {giftboxReward && (
        <RewardModal
          reward={giftboxReward}
          title="宝箱开启！"
          subtitle="奖励已发放"
          sourceLabel="礼物盒"
          zIndex={220}
          onDismiss={() => {
            setGiftboxReward(null);
            onBadgeProgressChange?.();
          }}
        />
      )}
    </div>
  );
}
