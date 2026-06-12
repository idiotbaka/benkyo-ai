import { startTransition, useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import useUserStore from '../store/userStore';
import { ITEM_CATEGORIES, SHOP_CONSUMABLE_ITEMS, SHOP_EQUIPMENT_ITEMS, SHOP_ITEMS } from '../data/shopItems';
import { OMAMORI_ITEMS } from '../data/omamoriGacha';
import { useIcon, useIconResolver } from '../lib/icons';
import OmamoriGacha from '../components/Shop/OmamoriGacha';

gsap.registerPlugin(useGSAP);

const warmedImageSrcs = new Set();

function scheduleIdleTask(callback) {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(callback, { timeout: 900 });
    return () => window.cancelIdleCallback?.(id);
  }

  const id = window.setTimeout(() => {
    callback({ didTimeout: true, timeRemaining: () => 0 });
  }, 80);
  return () => window.clearTimeout(id);
}

function warmImageQueue(srcs) {
  const queuedSrcs = new Set();
  const queue = srcs.filter(src => {
    if (!src || warmedImageSrcs.has(src) || queuedSrcs.has(src)) return false;
    queuedSrcs.add(src);
    return true;
  });
  let cancelIdle = null;
  let cancelled = false;

  const warmNextBatch = (deadline) => {
    let warmedInBatch = 0;

    while (
      !cancelled &&
      queue.length > 0 &&
      (deadline.didTimeout || deadline.timeRemaining() > 4 || warmedInBatch < 2)
    ) {
      const src = queue.shift();
      warmedImageSrcs.add(src);

      const image = new Image();
      image.decoding = 'async';
      image.src = src;
      if (typeof image.decode === 'function') {
        image.decode().catch(() => {});
      }
      warmedInBatch += 1;
    }

    if (!cancelled && queue.length > 0) {
      cancelIdle = scheduleIdleTask(warmNextBatch);
    }
  };

  cancelIdle = scheduleIdleTask(warmNextBatch);

  return () => {
    cancelled = true;
    cancelIdle?.();
  };
}

function getShopContentMotionTargets(root) {
  return {
    cards: root?.querySelectorAll('[data-shop-card]'),
    trailing: root?.querySelectorAll('[data-shop-trailing]'),
  };
}

const SHOP_CARD_ENTER_FROM = {
  opacity: 0,
  y: 16,
  force3D: true,
};

const SHOP_CARD_ENTER_TO = {
  opacity: 1,
  y: 0,
  duration: 0.36,
  ease: 'power2.out',
  stagger: 0.05,
  force3D: true,
};

// Flash feedback: item id → 'bought' | 'broke'
function useFlash() {
  const [flash, setFlash] = useState({});
  const trigger = (id, type) => {
    setFlash(f => ({ ...f, [id]: type }));
    setTimeout(() => setFlash(f => ({ ...f, [id]: null })), 1200);
  };
  return [flash, trigger];
}

function getPurchaseRequirementStatus(item, omamoriCollection) {
  const requirement = item.purchaseRequirement;
  if (!requirement) return { met: true, label: null };

  if (requirement.type === 'omamori') {
    const owned = (omamoriCollection?.[requirement.itemId] ?? 0) > 0;
    return {
      met: owned,
      label: requirement.label ?? '需要指定御守',
    };
  }

  return { met: true, label: null };
}

function isEquipmentItem(item) {
  return item.category === ITEM_CATEGORIES.EQUIPMENT;
}

function ConsumableShopCard({ item, itemImg, coinImg, owned, requirement, canAfford, flash, onBuy }) {
  const canBuy = requirement.met && canAfford;
  const blockedLabel = requirement.met ? '金币不足' : '条件不足';

  return (
    <div
      data-shop-card
      className="bg-white rounded-2xl mb-3 flex items-center gap-4"
      style={{
        padding: '16px',
        boxShadow: '0 4px 20px rgba(91,79,233,0.10)',
        border: flash === 'bought'
          ? '2px solid #22C55E'
          : flash === 'broke'
          ? '2px solid #EF4444'
          : '2px solid transparent',
        transition: 'border-color 0.2s',
      }}
    >
      <div
        style={{
          width: 56, height: 56, borderRadius: 16,
          background: item.iconBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 28, flexShrink: 0,
        }}
      >
        <img src={itemImg} alt={item.name} width={36} height={36} decoding="async" style={{ objectFit: 'contain' }} />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: '#1E1B4B' }}>{item.name}</span>
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
        <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 6, lineHeight: 1.4 }}>{item.desc}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {!requirement.met ? (
            <span
              style={{
                fontSize: 11, fontWeight: 800,
                color: '#92400E', background: '#FEF3C7',
                border: '1px solid #FDE68A',
                borderRadius: 10, padding: '1px 8px',
              }}
            >
              购买条件：{requirement.label}
            </span>
          ) : (
            <>
              <img src={coinImg} alt="金币" width={22} height={22} decoding="async" style={{ objectFit: 'contain' }} />
              <span style={{ fontSize: 15, fontWeight: 800, color: '#D97706' }}>{item.price}</span>
              {owned > 0 && (
                <span
                  style={{
                    marginLeft: 4, fontSize: 11, fontWeight: 700,
                    color: 'var(--tp)', background: 'var(--tp-lite)',
                    borderRadius: 10, padding: '1px 8px',
                  }}
                >
                  已拥有 {owned}
                </span>
              )}
            </>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onBuy(item)}
        style={{
          flexShrink: 0,
          padding: '8px 16px',
          borderRadius: 14,
          fontWeight: 800,
          fontSize: 14,
          border: 'none',
          cursor: canBuy ? 'pointer' : 'not-allowed',
          transition: 'all 0.18s',
          ...(flash === 'bought'
            ? { background: '#22C55E', color: 'white' }
            : flash === 'broke'
            ? { background: '#FEE2E2', color: '#EF4444' }
            : canBuy
            ? { background: 'linear-gradient(135deg, var(--tp-from), var(--tp))', color: 'white', boxShadow: '0 3px 10px rgba(91,79,233,0.32)' }
            : { background: '#F3F4F6', color: '#9CA3AF' }),
        }}
      >
        {flash === 'bought' ? '✓ 已购买' : flash === 'broke' ? blockedLabel : '购买'}
      </button>
    </div>
  );
}

function EquipmentShopCard({ item, itemImg, coinImg, owned, requirement, canAfford, equipped, flash, onBuy }) {
  const canBuy = requirement.met && canAfford && !owned;
  const blockedLabel = requirement.met ? '金币不足' : '条件不足';
  const locked = !requirement.met && !owned;
  const statusLabel = owned ? (equipped ? '装备中' : '未装备') : locked ? '未解锁' : '待购买';
  const buttonLabel = flash === 'bought'
    ? '✓ 已装备'
    : flash === 'equipped'
    ? '✓ 装备中'
    : flash === 'unequipped'
    ? '已卸下'
    : flash === 'broke'
    ? blockedLabel
    : owned
    ? (equipped ? '卸下' : '装备')
    : '购买';
  const buttonDisabled = !owned && !canBuy;

  const buttonStyle = flash === 'bought' || flash === 'equipped'
    ? { background: '#22C55E', color: 'white', borderColor: '#22C55E', boxShadow: '0 3px 10px rgba(34,197,94,0.26)' }
    : flash === 'unequipped'
    ? { background: '#F3F4F6', color: '#64748B', borderColor: '#E5E7EB', boxShadow: 'none' }
    : flash === 'broke'
    ? { background: '#FEE2E2', color: '#EF4444', borderColor: '#FECACA', boxShadow: 'none' }
    : owned && equipped
    ? { background: '#FFF7ED', color: '#C2410C', borderColor: '#FED7AA', boxShadow: 'none' }
    : owned
    ? { background: 'linear-gradient(135deg, #14B8A6, #22C55E)', color: 'white', borderColor: 'transparent', boxShadow: '0 3px 10px rgba(20,184,166,0.24)' }
    : canBuy
    ? { background: 'linear-gradient(135deg, #F59E0B, #EF4444)', color: 'white', borderColor: 'transparent', boxShadow: '0 3px 10px rgba(239,68,68,0.24)' }
    : { background: '#F3F4F6', color: '#9CA3AF', borderColor: '#E5E7EB', boxShadow: 'none' };

  return (
    <div
      data-shop-card
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 20,
        marginBottom: 12,
        padding: 14,
        background: locked
          ? 'linear-gradient(135deg, #FFFFFF 0%, #F8FAFC 100%)'
          : 'linear-gradient(135deg, #FFFFFF 0%, #FFF7ED 52%, #F0FDFA 100%)',
        border: equipped
          ? '2px solid #22C55E'
          : flash === 'broke'
          ? '2px solid #EF4444'
          : '2px solid rgba(251,146,60,0.32)',
        boxShadow: equipped
          ? '0 8px 24px rgba(34,197,94,0.16)'
          : '0 5px 22px rgba(124,58,237,0.10)',
        transition: 'border-color 0.2s, box-shadow 0.2s',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: -42,
          right: -36,
          width: 110,
          height: 110,
          borderRadius: '50%',
          background: item.badgeBg,
          opacity: locked ? 0.12 : 0.24,
        }}
      />
      <div style={{ position: 'relative', display: 'flex', gap: 13, alignItems: 'flex-start' }}>
        <div
          style={{
            width: 68,
            minWidth: 68,
            height: 78,
            borderRadius: 18,
            background: item.iconBg,
            border: `1.5px solid ${locked ? '#E5E7EB' : 'rgba(255,255,255,0.92)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: locked ? 'none' : `0 8px 18px ${item.color}22`,
            filter: locked ? 'grayscale(0.45)' : 'none',
          }}
        >
          <img src={itemImg} alt={item.name} width={48} height={48} decoding="async" style={{ objectFit: 'contain' }} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 16, fontWeight: 900, color: '#1E1B4B' }}>{item.name}</span>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: 11, lineHeight: 1.35, color: '#8B8CA7', fontWeight: 650 }}>{item.desc}</p>
            </div>
            <span
              style={{
                flexShrink: 0,
                fontSize: 11,
                fontWeight: 900,
                borderRadius: 999,
                padding: '3px 9px',
                color: equipped ? '#166534' : locked ? '#64748B' : '#92400E',
                background: equipped ? '#DCFCE7' : locked ? '#F1F5F9' : '#FEF3C7',
                border: equipped ? '1px solid #BBF7D0' : locked ? '1px solid #E2E8F0' : '1px solid #FDE68A',
                whiteSpace: 'nowrap',
              }}
            >
              {statusLabel}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              flexWrap: 'wrap',
              marginBottom: 8,
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                borderRadius: 999,
                padding: '2px 8px',
                fontSize: 11,
                fontWeight: 900,
                color: '#D97706',
                background: '#FFFBEB',
                border: '1px solid #FDE68A',
              }}
            >
              <img src={coinImg} alt="" width={16} height={16} decoding="async" style={{ objectFit: 'contain' }} />
              {item.price}
            </span>
            <span
              style={{
                borderRadius: 999,
                padding: '2px 8px',
                fontSize: 11,
                fontWeight: 900,
                color: requirement.met ? '#0F766E' : '#92400E',
                background: requirement.met ? '#CCFBF1' : '#FEF3C7',
                border: requirement.met ? '1px solid #99F6E4' : '1px solid #FDE68A',
              }}
            >
              {requirement.met ? `已解锁：${requirement.label}` : `购买条件：${requirement.label}`}
            </span>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'stretch',
              gap: 8,
            }}
          >
            <div
              style={{
                flex: 1,
                minWidth: 0,
                borderRadius: 14,
                padding: '7px 10px',
                background: 'rgba(255,255,255,0.74)',
                border: `1px solid ${locked ? '#E5E7EB' : `${item.color}24`}`,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <div style={{ fontSize: 12, lineHeight: 1.35, color: '#374151', fontWeight: 750 }}>{item.effectDesc}</div>
            </div>
            <button
              type="button"
              onClick={() => onBuy(item)}
              disabled={buttonDisabled}
              style={{
                alignSelf: 'stretch',
                minWidth: 78,
                flexShrink: 0,
                padding: '6px 13px',
                borderRadius: 14,
                fontWeight: 900,
                fontSize: 13,
                border: '1.5px solid',
                cursor: buttonDisabled ? 'not-allowed' : 'pointer',
                transition: 'all 0.18s',
                ...buttonStyle,
              }}
            >
              {buttonLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ShopPage() {
  const coins = useUserStore(s => s.coins);
  const purchaseItem = useUserStore(s => s.purchaseItem);
  const inventory = useUserStore(s => s.inventory);
  const equippedItems = useUserStore(s => s.equippedItems ?? {});
  const toggleEquipment = useUserStore(s => s.toggleEquipment);
  const omamoriCollection = useUserStore(s => s.omamoriCollection ?? {});
  const [activeView, setActiveView] = useState('items');
  const [renderedView, setRenderedView] = useState('items');
  const bagImg = useIcon('ui/bag.png');
  const cartImg = useIcon('ui/shopping_cart.png');
  const coinImg = useIcon('item/coin.png');
  const sdShoppingImg = useIcon('sd/sd_shopping.png');
  const omamoriImg = useIcon('sd/sr-てんぐ.png');
  const gachaIntroImg = useIcon('sd/gacha-intro.png');
  const roundFanImg = useIcon('item/round_fan.png');
  const windChimeImg = useIcon('item/wind_chime.png');
  const resolveIcon = useIconResolver();
  const [flash, triggerFlash] = useFlash();

  const headerRef = useRef(null);
  const contentRef = useRef(null);
  const stripeRef  = useRef(null);
  const contentSwitchRef = useRef({ rafIds: [], tween: null });
  const hasAnimatedContentSwitchRef = useRef(false);
  const isItemsView = activeView === 'items';
  const isEquipmentView = activeView === 'equipment';
  const isGachaView = activeView === 'gacha';
  const isRenderedItemsView = renderedView === 'items';
  const isRenderedEquipmentView = renderedView === 'equipment';
  const isRenderedGachaView = renderedView === 'gacha';
  const pageTitle = isGachaView ? '御守 Gacha' : isEquipmentView ? '护身符' : '道具商店';
  const pageSubtitle = isGachaView
    ? '抽取可爱的御守，给学习路上添一点好运'
    : isEquipmentView
    ? '购买永久生效的学习护身符'
    : '消费金币，获得强力道具';

  useEffect(() => {
    const warmSrcs = [
      bagImg,
      cartImg,
      coinImg,
      sdShoppingImg,
      omamoriImg,
      gachaIntroImg,
      roundFanImg,
      windChimeImg,
      ...SHOP_ITEMS.map(item => resolveIcon(item.iconPath)),
      ...OMAMORI_ITEMS.map(item => resolveIcon(item.iconPath)),
    ];

    return warmImageQueue(warmSrcs);
  }, [bagImg, cartImg, coinImg, gachaIntroImg, omamoriImg, resolveIcon, roundFanImg, sdShoppingImg, windChimeImg]);

  useEffect(() => {
    const switchState = contentSwitchRef.current;
    return () => {
      switchState.rafIds.forEach(id => window.cancelAnimationFrame(id));
      switchState.tween?.kill();
    };
  }, []);

  // FOUC prevention
  useGSAP(() => {
    const { cards, trailing } = getShopContentMotionTargets(contentRef.current);
    gsap.set([headerRef.current, contentRef.current], { opacity: 0, y: 16, force3D: true });
    gsap.set(cards, SHOP_CARD_ENTER_FROM);
    gsap.set(trailing, { opacity: 0, y: 12 });
  }, []);

  // Stripe scroll (infinite)
  useGSAP(() => {
    gsap.to(stripeRef.current, {
      backgroundPositionX: '+=60px',
      repeat: -1,
      duration: 3.5,
      ease: 'none',
    });
  }, []);

  // Entrance animation
  useGSAP(() => {
    const { cards, trailing } = getShopContentMotionTargets(contentRef.current);
    const tl = gsap.timeline();
    tl.to(headerRef.current, { opacity: 1, y: 0, duration: 0.34, ease: 'power2.out', force3D: true }, 0.05);
    tl.to(contentRef.current, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out', force3D: true }, 0.13);
    tl.to(cards, SHOP_CARD_ENTER_TO, 0.2);
    tl.to(trailing, { opacity: 1, y: 0, duration: 0.28, ease: 'power2.out' }, 0.46);
  }, []);

  useGSAP(() => {
    if (!hasAnimatedContentSwitchRef.current) {
      hasAnimatedContentSwitchRef.current = true;
      return;
    }

    if (!contentRef.current) return;
    const { cards, trailing } = getShopContentMotionTargets(contentRef.current);
    gsap.set(contentRef.current, { opacity: 1, y: 0, force3D: true });
    gsap.set(cards, SHOP_CARD_ENTER_FROM);
    gsap.set(trailing, { opacity: 0, y: 12 });

    const tl = gsap.timeline();

    if (!isRenderedGachaView) {
      tl.to(cards, SHOP_CARD_ENTER_TO, 0);
      tl.to(trailing, { opacity: 1, y: 0, duration: 0.28, ease: 'power2.out' }, 0.26);
    }
  }, [renderedView]);

  const handleViewChange = (nextView) => {
    if (nextView === activeView && nextView === renderedView) return;

    contentSwitchRef.current.rafIds.forEach(id => window.cancelAnimationFrame(id));
    contentSwitchRef.current.rafIds = [];
    contentSwitchRef.current.tween?.kill();
    contentSwitchRef.current.tween = null;
    setActiveView(nextView);

    if (nextView === renderedView) {
      if (contentRef.current) {
        gsap.killTweensOf(contentRef.current);
        gsap.to(contentRef.current, {
          opacity: 1,
          y: 0,
          duration: 0.18,
          ease: 'power2.out',
          overwrite: true,
        });
      }
      return;
    }

    if (contentRef.current) {
      gsap.killTweensOf(contentRef.current);
      contentSwitchRef.current.tween = gsap.to(contentRef.current, {
        opacity: 0,
        y: 8,
        duration: 0.12,
        ease: 'power1.out',
        overwrite: true,
        onComplete: () => {
          contentSwitchRef.current.tween = null;
          startTransition(() => {
            setRenderedView(nextView);
          });
        },
      });
      return;
    }

    startTransition(() => {
      setRenderedView(nextView);
    });
  };

  const handleBuy = (item) => {
    const owned = inventory?.[item.id] ?? 0;
    const equipment = isEquipmentItem(item);

    if (equipment && owned > 0) {
      const equipped = toggleEquipment(item.id);
      triggerFlash(item.id, equipped ? 'equipped' : 'unequipped');
      return;
    }

    const requirement = getPurchaseRequirementStatus(item, omamoriCollection);
    if (!requirement.met) {
      triggerFlash(item.id, 'broke');
      return;
    }

    if (coins < item.price) {
      triggerFlash(item.id, 'broke');
      return;
    }
    const ok = purchaseItem(item.id, item.price, {
      singlePurchase: equipment || item.purchaseLimit === 1,
      autoEquip: equipment && item.autoEquipOnPurchase !== false,
    });
    if (ok) triggerFlash(item.id, 'bought');
  };

  return (
    <div
      data-ui-click-sfx
      className="h-full"
      style={{
        background: isGachaView
          ? 'linear-gradient(180deg, #FFF7ED 0%, #F5F3FF 54%, #ECFDF5 100%)'
          : isEquipmentView
          ? 'linear-gradient(180deg, #FFF7ED 0%, #F5F3FF 58%, #ECFDF5 100%)'
          : '#F5F3FF',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div className="shop-page-scroll scroll-y">
        {/* Header */}
        <div
          ref={headerRef}
          style={{
            background: isGachaView
              ? 'linear-gradient(145deg, #EF4444 0%, #F59E0B 42%, var(--tp) 100%)'
              : isEquipmentView
              ? 'linear-gradient(145deg, #0F766E 0%, #14B8A6 45%, #F59E0B 100%)'
              : 'linear-gradient(155deg, var(--tp) 0%, var(--tp-from) 100%)',
            padding: '32px 20px 48px',
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
                rgba(255,255,255,0.12) 20px,
                rgba(255,255,255,0.12) 50px
              )`,
              backgroundSize: '60px 100%',
              pointerEvents: 'none',
            }}
          />
          <div className="shop-header-art" aria-hidden="true">
            <img
              src={sdShoppingImg}
              alt=""
              width={172}
              height={172}
              decoding="async"
              className={`shop-header-art__image shop-header-art__image--shopping ${isItemsView ? 'is-active' : ''}`}
            />
            <img
              src={windChimeImg}
              alt=""
              width={152}
              height={172}
              decoding="async"
              className={`shop-header-art__image shop-header-art__image--equipment ${isEquipmentView ? 'is-active' : ''}`}
            />
            <img
              src={omamoriImg}
              alt=""
              width={142}
              height={172}
              decoding="async"
              className={`shop-header-art__image shop-header-art__image--omamori ${isGachaView ? 'is-active' : ''}`}
            />
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 900, color: 'white', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8, position: 'relative', zIndex: 2 }}>
            <span className="shop-title-icon" aria-hidden="true">
              <img
                src={cartImg}
                alt=""
                width={32}
                height={32}
                decoding="async"
                className={isItemsView ? 'is-active' : ''}
              />
              <img
                src={roundFanImg}
                alt=""
                width={32}
                height={32}
                decoding="async"
                className={isEquipmentView ? 'is-active' : ''}
              />
              <img
                src={omamoriImg}
                alt=""
                width={32}
                height={32}
                decoding="async"
                className={isGachaView ? 'is-active' : ''}
              />
            </span>
            {pageTitle}
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 16, position: 'relative', zIndex: 2 }}>
            {pageSubtitle}
          </p>
          {/* Coin balance chip */}
          <div
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,0.18)',
              backdropFilter: 'blur(6px)',
              borderRadius: 20, padding: '6px 14px',
              border: '1.5px solid rgba(255,255,255,0.28)',
              position: 'relative',
              zIndex: 2,
            }}
          >
            <img src={coinImg} alt="金币" width={22} height={22} decoding="async" style={{ objectFit: 'contain' }} />
            <span style={{ fontWeight: 800, color: 'white', fontSize: 16 }}>{coins}</span>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>金币余额</span>
          </div>
        </div>

        <div ref={contentRef} aria-busy={activeView !== renderedView} style={{ margin: '-20px 16px 0', position: 'relative' }}>
          {isRenderedGachaView ? (
            <OmamoriGacha />
          ) : isRenderedEquipmentView ? (
            <>
              {SHOP_EQUIPMENT_ITEMS.map((item) => {
                const itemImg = resolveIcon(item.iconPath);
                const owned = (inventory?.[item.id] ?? 0) > 0;
                const requirement = getPurchaseRequirementStatus(item, omamoriCollection);
                return (
                  <EquipmentShopCard
                    key={item.id}
                    item={item}
                    itemImg={itemImg}
                    coinImg={coinImg}
                    owned={owned}
                    requirement={requirement}
                    canAfford={coins >= item.price}
                    equipped={owned && Boolean(equippedItems[item.id])}
                    flash={flash[item.id]}
                    onBuy={handleBuy}
                  />
                );
              })}

              <p data-shop-trailing style={{ textAlign: 'center', fontSize: 12, color: '#D97706', fontWeight: 600, margin: '8px 0 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, lineHeight: 1.35 }}>
                <img src={roundFanImg} alt="护身符" width={16} height={16} decoding="async" style={{ objectFit: 'contain' }} /> 护身符购买后，可切换装备状态
              </p>
            </>
          ) : isRenderedItemsView ? (
            <>
              {SHOP_CONSUMABLE_ITEMS.map((item) => {
                const itemImg = resolveIcon(item.iconPath);
                const owned = inventory?.[item.id] ?? 0;
                const requirement = getPurchaseRequirementStatus(item, omamoriCollection);
                return (
                  <ConsumableShopCard
                    key={item.id}
                    item={item}
                    itemImg={itemImg}
                    coinImg={coinImg}
                    owned={owned}
                    requirement={requirement}
                    canAfford={coins >= item.price}
                    flash={flash[item.id]}
                    onBuy={handleBuy}
                  />
                );
              })}

              <p data-shop-trailing style={{ textAlign: 'center', fontSize: 12, color: 'var(--tp-bdr)', fontWeight: 600, margin: '8px 0 22px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, lineHeight: 1.35 }}>
                <img src={bagImg} alt="背包" width={16} height={16} decoding="async" style={{ objectFit: 'contain' }} /> 消耗品购买后，在「我的 → 背包」中使用
              </p>
            </>
          ) : null}
        </div>
      </div>

      <div className="shop-view-switcher" role="tablist" aria-label="商店切换">
        <button
          type="button"
          role="tab"
          aria-selected={isItemsView}
          onClick={() => handleViewChange('items')}
          className={`btn-press ${isItemsView ? 'is-active' : ''}`}
        >
          <img src={cartImg} alt="" decoding="async" />
          <span>道具商店</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isEquipmentView}
          onClick={() => handleViewChange('equipment')}
          className={`btn-press ${isEquipmentView ? 'is-active' : ''}`}
        >
          <img src={roundFanImg} alt="" decoding="async" />
          <span>护身符</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isGachaView}
          onClick={() => handleViewChange('gacha')}
          className={`btn-press ${isGachaView ? 'is-active' : ''}`}
        >
          <img src={omamoriImg} alt="" decoding="async" />
          <span>御守 Gacha</span>
        </button>
      </div>
    </div>
  );
}
