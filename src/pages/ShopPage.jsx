import { startTransition, useEffect, useRef, useState } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import useUserStore from '../store/userStore';
import { SHOP_ITEMS } from '../data/shopItems';
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

export default function ShopPage() {
  const coins = useUserStore(s => s.coins);
  const purchaseItem = useUserStore(s => s.purchaseItem);
  const inventory = useUserStore(s => s.inventory);
  const omamoriCollection = useUserStore(s => s.omamoriCollection ?? {});
  const [activeView, setActiveView] = useState('items');
  const [renderedView, setRenderedView] = useState('items');
  const bagImg = useIcon('ui/bag.png');
  const cartImg = useIcon('ui/shopping_cart.png');
  const coinImg = useIcon('item/coin.png');
  const sdShoppingImg = useIcon('sd/sd_shopping.png');
  const omamoriImg = useIcon('sd/sr-てんぐ.png');
  const gachaIntroImg = useIcon('sd/gacha-intro.png');
  const resolveIcon = useIconResolver();
  const [flash, triggerFlash] = useFlash();

  const headerRef = useRef(null);
  const contentRef = useRef(null);
  const stripeRef  = useRef(null);
  const contentSwitchRef = useRef({ rafIds: [] });
  const hasAnimatedContentSwitchRef = useRef(false);
  const isGachaView = activeView === 'gacha';
  const isRenderedGachaView = renderedView === 'gacha';

  useEffect(() => {
    const warmSrcs = [
      bagImg,
      cartImg,
      coinImg,
      sdShoppingImg,
      omamoriImg,
      gachaIntroImg,
      ...SHOP_ITEMS.map(item => resolveIcon(item.iconPath)),
      ...OMAMORI_ITEMS.map(item => resolveIcon(item.iconPath)),
    ];

    return warmImageQueue(warmSrcs);
  }, [bagImg, cartImg, coinImg, gachaIntroImg, omamoriImg, resolveIcon, sdShoppingImg]);

  useEffect(() => {
    const switchState = contentSwitchRef.current;
    return () => {
      switchState.rafIds.forEach(id => window.cancelAnimationFrame(id));
    };
  }, []);

  // FOUC prevention
  useGSAP(() => {
    const { cards, trailing } = getShopContentMotionTargets(contentRef.current);
    gsap.set([headerRef.current, contentRef.current], { opacity: 0, y: 16 });
    gsap.set(cards, { opacity: 0, y: 18, scale: 0.98 });
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
    tl.to(headerRef.current, { opacity: 1, y: 0, duration: 0.38, ease: 'back.out(1.8)' }, 0.05);
    tl.to(contentRef.current, { opacity: 1, y: 0, duration: 0.34, ease: 'back.out(1.7)' }, 0.13);
    tl.to(cards, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: 0.42,
      ease: 'back.out(1.8)',
      stagger: 0.06,
    }, 0.2);
    tl.to(trailing, { opacity: 1, y: 0, duration: 0.28, ease: 'power2.out' }, 0.46);
  }, []);

  useGSAP(() => {
    if (!hasAnimatedContentSwitchRef.current) {
      hasAnimatedContentSwitchRef.current = true;
      return;
    }

    if (!contentRef.current) return;
    const { cards, trailing } = getShopContentMotionTargets(contentRef.current);
    gsap.set(cards, { opacity: 0, y: 18, scale: 0.98 });
    gsap.set(trailing, { opacity: 0, y: 12 });

    const tl = gsap.timeline();
    tl.fromTo(
      contentRef.current,
      { opacity: 0, y: 12 },
      { opacity: 1, y: 0, duration: 0.34, ease: 'back.out(1.7)' }
    );

    if (!isRenderedGachaView) {
      tl.to(cards, {
        opacity: 1,
        y: 0,
        scale: 1,
        duration: 0.42,
        ease: 'back.out(1.8)',
        stagger: 0.06,
      }, 0.08);
      tl.to(trailing, { opacity: 1, y: 0, duration: 0.28, ease: 'power2.out' }, 0.34);
    }
  }, [renderedView]);

  const handleViewChange = (nextView) => {
    if (nextView === activeView && nextView === renderedView) return;

    contentSwitchRef.current.rafIds.forEach(id => window.cancelAnimationFrame(id));
    contentSwitchRef.current.rafIds = [];
    setActiveView(nextView);

    if (contentRef.current) {
      gsap.killTweensOf(contentRef.current);
      gsap.to(contentRef.current, {
        opacity: 0,
        y: 8,
        duration: 0.12,
        ease: 'power1.out',
      });
    }

    const firstFrame = window.requestAnimationFrame(() => {
      const secondFrame = window.requestAnimationFrame(() => {
        startTransition(() => {
          setRenderedView(nextView);
        });
      });
      contentSwitchRef.current.rafIds = [secondFrame];
    });

    contentSwitchRef.current.rafIds = [firstFrame];
  };

  const handleBuy = (item) => {
    const requirement = getPurchaseRequirementStatus(item, omamoriCollection);
    if (!requirement.met) {
      triggerFlash(item.id, 'broke');
      return;
    }

    if (coins < item.price) {
      triggerFlash(item.id, 'broke');
      return;
    }
    const ok = purchaseItem(item.id, item.price);
    if (ok) triggerFlash(item.id, 'bought');
  };

  return (
    <div
      data-ui-click-sfx
      className="h-full"
      style={{
        background: isGachaView
          ? 'linear-gradient(180deg, #FFF7ED 0%, #F5F3FF 54%, #ECFDF5 100%)'
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
              className={`shop-header-art__image shop-header-art__image--shopping ${!isGachaView ? 'is-active' : ''}`}
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
                className={!isGachaView ? 'is-active' : ''}
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
            {isGachaView ? '御守 Gacha' : '道具商店'}
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 16, position: 'relative', zIndex: 2 }}>
            {isGachaView ? '抽取可爱的御守，给学习路上添一点好运' : '消费金币，获得强力道具'}
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
          ) : (
            <>
              {SHOP_ITEMS.map((item) => {
                const itemImg = resolveIcon(item.iconPath);
                const owned = inventory?.[item.id] ?? 0;
                const requirement = getPurchaseRequirementStatus(item, omamoriCollection);
                const canAfford = coins >= item.price;
                const canBuy = requirement.met && canAfford;
                const f = flash[item.id];
                const blockedLabel = requirement.met ? '金币不足' : '条件不足';
                return (
                  <div
                    key={item.id}
                    data-shop-card
                    className="bg-white rounded-2xl mb-4 flex items-center gap-4"
                    style={{
                      padding: '16px',
                      boxShadow: '0 4px 20px rgba(91,79,233,0.10)',
                      border: f === 'bought'
                        ? '2px solid #22C55E'
                        : f === 'broke'
                        ? '2px solid #EF4444'
                        : '2px solid transparent',
                      transition: 'border-color 0.2s',
                    }}
                  >
                    {/* Icon */}
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

                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
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

                    {/* Buy button */}
                    <button
                      onClick={() => handleBuy(item)}
                      style={{
                        flexShrink: 0,
                        padding: '8px 16px',
                        borderRadius: 14,
                        fontWeight: 800,
                        fontSize: 14,
                        border: 'none',
                        cursor: canBuy ? 'pointer' : 'not-allowed',
                        transition: 'all 0.18s',
                        ...(f === 'bought'
                          ? { background: '#22C55E', color: 'white' }
                          : f === 'broke'
                          ? { background: '#FEE2E2', color: '#EF4444' }
                          : canBuy
                          ? { background: 'linear-gradient(135deg, var(--tp-from), var(--tp))', color: 'white', boxShadow: '0 3px 10px rgba(91,79,233,0.32)' }
                          : { background: '#F3F4F6', color: '#9CA3AF' }),
                      }}
                    >
                      {f === 'bought' ? '✓ 已购买' : f === 'broke' ? blockedLabel : '购买'}
                    </button>
                  </div>
                );
              })}

              {/* Bottom hint */}
              <p data-shop-trailing style={{ textAlign: 'center', fontSize: 12, color: 'var(--tp-bdr)', fontWeight: 600, marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <img src={bagImg} alt="背包" width={16} height={16} decoding="async" style={{ objectFit: 'contain' }} /> 购买后在「我的 → 背包」中使用
              </p>
            </>
          )}
        </div>
      </div>

      <div className="shop-view-switcher" role="tablist" aria-label="商店切换">
        <button
          type="button"
          role="tab"
          aria-selected={!isGachaView}
          onClick={() => handleViewChange('items')}
          className={`btn-press ${!isGachaView ? 'is-active' : ''}`}
        >
          <img src={cartImg} alt="" decoding="async" />
          <span>道具商店</span>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isGachaView}
          onClick={() => handleViewChange('gacha')}
          className={`btn-press ${isGachaView ? 'is-active' : ''}`}
        >
          <img src={omamoriImg} alt="" decoding="async" />
          <span>御守・護身符</span>
        </button>
      </div>
    </div>
  );
}
