import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import useUserStore from '../../store/userStore';
import {
  OMAMORI_GACHA_COST,
  OMAMORI_ITEMS,
  OMAMORI_RARITY_ORDER,
  drawOmamori,
  getOmamoriEffect,
  getOmamoriLore,
  getOmamoriRarity,
} from '../../data/omamoriGacha';
import { useIcon, useIconResolver } from '../../lib/icons';
import { playSoundEffect, SOUND_EFFECT_TYPES } from '../../lib/sound-effects';
import { createGachaGiftboxReward } from '../../lib/giftbox-rewards';
import { getOmamoriGachaCost, hasOmamoriGachaDiscount } from '../../lib/equipment-effects';
import RewardModal from '../UI/RewardModal';

gsap.registerPlugin(useGSAP);

const REEL_ITEM_COUNT = 48;
const REEL_TARGET_INDEX = 42;
const COLLECTION_GRID_DELAY_MS = 0;
const REEL_ACCEL_DURATION = 1;
const REEL_CRUISE_DURATION = 2;
const REEL_DECEL_DURATION = 2;
const REEL_ACCEL_DISTANCE_WEIGHT = REEL_ACCEL_DURATION / 2;
const REEL_CRUISE_DISTANCE_WEIGHT = REEL_CRUISE_DURATION;
const REEL_DECEL_DISTANCE_WEIGHT = REEL_DECEL_DURATION / 4;
const COLLECTION_CARD_ENTER_FROM = {
  opacity: 0,
  y: 14,
  force3D: true,
};
const COLLECTION_CARD_ENTER_TO = {
  opacity: 1,
  y: 0,
  duration: 0.34,
  ease: 'power2.out',
  stagger: 0.045,
  force3D: true,
};
function CoinPrice({ coinImg, cost, discounted = false, iconSize = 20 }) {
  return (
    <span className={`omamori-price ${discounted ? 'omamori-price--discounted' : ''}`}>
      <img src={coinImg} alt="" width={iconSize} height={iconSize} decoding="async" />
      {discounted && <del>{OMAMORI_GACHA_COST}</del>}
      <span>{cost}</span>
    </span>
  );
}

function buildResultReel(result) {
  return Array.from({ length: REEL_ITEM_COUNT }, (_, index) => {
    const item = index === REEL_TARGET_INDEX ? result : drawOmamori();
    return {
      ...item,
      reelKey: `${index}-${item.id}-${Math.random().toString(36).slice(2, 8)}`,
    };
  });
}

function preloadImage(src) {
  if (!src) return Promise.resolve();

  return new Promise((resolve) => {
    const image = new Image();
    image.decoding = 'async';
    image.onload = resolve;
    image.onerror = resolve;
    image.src = src;
    if (typeof image.decode === 'function') {
      image.decode().then(resolve).catch(resolve);
    }
  });
}

export default function OmamoriGacha() {
  const coins = useUserStore(s => s.coins);
  const spendCoins = useUserStore(s => s.spendCoins);
  const markOmamoriDetailViewed = useUserStore(s => s.markOmamoriDetailViewed);
  const omamoriCollection = useUserStore(s => s.omamoriCollection ?? {});
  const omamoriViewedDetails = useUserStore(s => s.omamoriViewedDetails ?? {});
  const equippedItems = useUserStore(s => s.equippedItems ?? {});
  const coinImg = useIcon('item/coin.png');
  const gachaIntroImg = useIcon('sd/gacha-intro.png');
  const resolveIcon = useIconResolver();
  const [phase, setPhase] = useState('idle');
  const [result, setResult] = useState(null);
  const [notice, setNotice] = useState(null);
  const [selectedOmamori, setSelectedOmamori] = useState(null);
  const [stageImageReady, setStageImageReady] = useState(false);
  const [stageEntered, setStageEntered] = useState(false);
  const [showCollectionGrid, setShowCollectionGrid] = useState(false);

  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const noticeRef = useRef(null);
  const lineupRef = useRef(null);
  const hasAnimatedCollectionRef = useRef(false);

  const gachaCost = getOmamoriGachaCost(equippedItems);
  const hasRoundFanDiscount = hasOmamoriGachaDiscount(equippedItems);
  const canAfford = coins >= gachaCost;
  const isDrawing = phase !== 'idle';
  const [reelItems, setReelItems] = useState([]);
  const [drawKey, setDrawKey] = useState(0);

  const collectionItems = useMemo(() => {
    const rank = new Map(OMAMORI_RARITY_ORDER.map((rarity, index) => [rarity, index]));
    return [...OMAMORI_ITEMS]
      .map(item => {
        const count = omamoriCollection[item.id] ?? 0;
        const owned = count > 0;
        return {
          ...item,
          count,
          owned,
          isNew: owned && !omamoriViewedDetails[item.id],
          lore: getOmamoriLore(item.id),
        };
      })
      .sort((a, b) => {
        if (a.owned !== b.owned) return a.owned ? -1 : 1;
        return rank.get(a.rarity) - rank.get(b.rarity);
      });
  }, [omamoriCollection, omamoriViewedDetails]);

  const collectionStats = useMemo(() => {
    const owned = collectionItems.filter(item => item.owned).length;
    const total = collectionItems.reduce((sum, item) => sum + item.count, 0);
    return { owned, total };
  }, [collectionItems]);

  useGSAP(() => {
    gsap.set(lineupRef.current, { opacity: 0, y: 16, force3D: true });
  }, []);

  useEffect(() => {
    let cancelled = false;
    preloadImage(gachaIntroImg).then(() => {
      if (!cancelled) setStageImageReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [gachaIntroImg]);

  useGSAP(() => {
    if (!stageImageReady) return undefined;

    const tl = gsap.timeline();
    tl.to(lineupRef.current, { opacity: 1, y: 0, duration: 0.34, ease: 'power2.out', force3D: true }, 0.12);
    tl.call(() => setStageEntered(true));

    return () => tl.kill();
  }, [stageImageReady]);

  useEffect(() => {
    if (!stageEntered) return undefined;

    let idleCancel = null;
    let frameId = null;
    const delayId = window.setTimeout(() => {
      if (typeof window.requestIdleCallback === 'function') {
        const idleId = window.requestIdleCallback(() => setShowCollectionGrid(true), { timeout: 600 });
        idleCancel = () => window.cancelIdleCallback?.(idleId);
        return;
      }

      frameId = window.requestAnimationFrame(() => setShowCollectionGrid(true));
    }, COLLECTION_GRID_DELAY_MS);

    return () => {
      window.clearTimeout(delayId);
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      idleCancel?.();
    };
  }, [stageEntered]);

  useGSAP(() => {
    if (!showCollectionGrid) return;

    const cards = lineupRef.current?.querySelectorAll('[data-omamori-collection]');
    if (!cards?.length) return;

    if (hasAnimatedCollectionRef.current) {
      gsap.set(cards, { opacity: 1, y: 0, force3D: true });
      return;
    }

    hasAnimatedCollectionRef.current = true;
    gsap.fromTo(cards, COLLECTION_CARD_ENTER_FROM, COLLECTION_CARD_ENTER_TO);
  }, [showCollectionGrid]);

  useGSAP(() => {
    if (!stageImageReady) return undefined;

    const lanterns = rootRef.current?.querySelectorAll('[data-omamori-lantern]');

    const tween = gsap.to(lanterns, {
      opacity: 0.38,
      scale: 1.12,
      repeat: -1,
      yoyo: true,
      duration: 1.35,
      ease: 'sine.inOut',
      stagger: 0.16,
    });

    return () => tween.kill();
  }, [stageImageReady]);

  const showInsufficientCoins = () => {
    setNotice('金币不足');
    gsap.fromTo(
      noticeRef.current ?? stageRef.current,
      { x: -6 },
      { x: 6, repeat: 5, yoyo: true, duration: 0.055, ease: 'sine.inOut', onComplete: () => gsap.set(noticeRef.current ?? stageRef.current, { x: 0 }) }
    );
  };

  const showStageInsufficientCoins = () => {
    if (phase !== 'idle') return;
    showInsufficientCoins();
  };

  const prepareDraw = () => {
    if (!canAfford) {
      showInsufficientCoins();
      return;
    }

    const nextResult = drawOmamori();
    const resultWithState = { ...nextResult, isNew: false };
    setNotice(null);
    setResult(resultWithState);
    setReelItems(buildResultReel(resultWithState));
    setDrawKey(key => key + 1);
    setPhase('ready');
  };

  const handleDraw = () => {
    if (isDrawing) return;
    prepareDraw();
  };

  const handleDrawAgain = () => {
    prepareDraw();
  };

  const closeResult = () => {
    setResult(null);
    setReelItems([]);
    setPhase('idle');
  };

  const openOmamoriDetail = (item) => {
    if (!item.owned) return;
    markOmamoriDetailViewed(item.id);
    setSelectedOmamori(item);
  };

  const closeOmamoriDetail = () => {
    setSelectedOmamori(null);
  };

  return (
    <div ref={rootRef} className="omamori-gacha" data-ui-click-sfx aria-busy={!stageImageReady}>
      <section ref={stageRef} className={`omamori-stage omamori-stage--${phase} ${stageImageReady ? 'omamori-stage--image-ready' : 'omamori-stage--preloading'}`}>
        <div
          className="omamori-stage__aura"
          aria-hidden="true"
        >
          <div
            className="omamori-stage__intro"
            style={stageImageReady ? { backgroundImage: `url(${gachaIntroImg})` } : undefined}
          />
          <div className="omamori-stage__glow" />
          <div className="omamori-stage__beams">
            {Array.from({ length: 4 }).map((_, index) => (
              <span key={index} />
            ))}
          </div>
          <div className="omamori-stage__sparkles">
            {Array.from({ length: 26 }).map((_, index) => (
              <span key={index} />
            ))}
          </div>
        </div>
        <div className="omamori-lanterns" aria-hidden="true">
          {Array.from({ length: 12 }).map((_, index) => (
            <span key={index} data-omamori-lantern style={{ '--i': index }} />
          ))}
        </div>

        <div className="omamori-stage__topline">
          <span>御守・護身符 Gacha</span>
          <span>
            <img src={coinImg} alt="" width={16} height={16} decoding="async" />
            1回 {gachaCost}
          </span>
        </div>

        <button
          type="button"
          onClick={handleDraw}
          data-sfx={SOUND_EFFECT_TYPES.WORD_SELECTED}
          className="btn-press omamori-draw-button"
          disabled={isDrawing}
        >
          <span>抽取一次</span>
          <CoinPrice coinImg={coinImg} cost={gachaCost} discounted={hasRoundFanDiscount} />
        </button>

        <div ref={noticeRef} className={`omamori-notice ${notice ? 'omamori-notice--show' : ''}`}>
          {notice ?? ' '}
        </div>
      </section>

      <section ref={lineupRef} className="omamori-lineup">
        <div className="omamori-section-title">
          <span>御守收藏</span>
          <span>{collectionStats.owned}/{OMAMORI_ITEMS.length} 種・累计 {collectionStats.total} 枚</span>
        </div>
        <p className="omamori-section-hint">点击御守，查看它的含义与文化小知识。</p>

        {!showCollectionGrid && (
          <div className="omamori-lineup-loading" role="status" aria-live="polite">
            <span>加载中</span>
            <span className="omamori-lineup-loading__dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </div>
        )}

        {showCollectionGrid && (
          <div className="omamori-lineup-grid">
            {collectionItems.map(item => {
              const rarity = getOmamoriRarity(item.rarity);
              return (
                <button
                  type="button"
                  key={item.id}
                  data-omamori-collection
                  data-sfx={item.owned ? SOUND_EFFECT_TYPES.WORD_SELECTED : 'none'}
                  disabled={!item.owned}
                  onClick={() => openOmamoriDetail(item)}
                  className={`omamori-collection-item omamori-collection-item--${item.rarity.toLowerCase()} ${item.owned ? 'omamori-collection-item--owned' : 'omamori-collection-item--locked'} ${item.isNew ? 'omamori-collection-item--new' : ''}`}
                  style={{ '--rarity-color': rarity.color, '--rarity-bg': rarity.bg, '--rarity-glow': rarity.glow }}
                  aria-label={`${item.name}，${item.rarity}，累计${item.count}枚`}
                >
                  <div className="omamori-collection-item__figure">
                    <img src={resolveIcon(item.iconPath)} alt={item.name} loading="lazy" decoding="async" />
                    <div className="omamori-collection-item__rarity">{item.rarity}</div>
                  </div>
                  <span className="omamori-collection-item__meta">
                    {item.isNew && <span className="omamori-collection-item__new">New</span>}
                    <span className="omamori-collection-item__count">累计{item.count}枚</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {phase !== 'idle' && result && (
        <GachaResultModal
          key={drawKey}
          result={result}
          reelItems={reelItems}
          targetIndex={REEL_TARGET_INDEX}
          coinImg={coinImg}
          canDrawAgain={canAfford}
          gachaCost={gachaCost}
          discounted={hasRoundFanDiscount}
          spendCoins={spendCoins}
          onInsufficientCoins={showStageInsufficientCoins}
          onClose={closeResult}
          onDrawAgain={handleDrawAgain}
        />
      )}

      {selectedOmamori && (
        <OmamoriDetailModal
          key={selectedOmamori.id}
          item={selectedOmamori}
          onClose={closeOmamoriDetail}
        />
      )}
    </div>
  );
}

function GachaResultModal({ result, reelItems, targetIndex, coinImg, canDrawAgain, gachaCost, discounted, spendCoins, onInsufficientCoins, onClose, onDrawAgain }) {
  const resultIcon = useIcon(result.iconPath);
  const resolveIcon = useIconResolver();
  const recordOmamoriDraw = useUserStore(s => s.recordOmamoriDraw);
  const grantReward = useUserStore(s => s.grantReward);
  const overlayRef = useRef(null);
  const cardRef = useRef(null);
  const reelViewportRef = useRef(null);
  const reelTrackRef = useRef(null);
  const reelTargetRef = useRef(null);
  const particleRef = useRef(null);
  const btnsRef = useRef(null);
  const rollTimelineRef = useRef(null);
  const hasRecordedResultRef = useRef(false);
  const [drawState, setDrawState] = useState('ready');
  const [isNewResult, setIsNewResult] = useState(false);
  const [giftboxReward, setGiftboxReward] = useState(null);
  const [modalNotice, setModalNotice] = useState(null);
  const [reelImagesReady, setReelImagesReady] = useState(false);
  const rarity = getOmamoriRarity(result.rarity);
  const neutralRarity = getOmamoriRarity('N');
  const isRolling = drawState === 'rolling';
  const settled = drawState === 'settled';
  const modalRarity = settled ? rarity : neutralRarity;

  useGSAP(() => {
    const overlay = overlayRef.current;
    const card = cardRef.current;
    const viewport = reelViewportRef.current;
    const track = reelTrackRef.current;
    const particles = particleRef.current;
    const buttons = btnsRef.current;

    gsap.set(overlay, { opacity: 0 });
    gsap.set(card, { opacity: 0, y: 34, scale: 0.96, rotate: 0, force3D: true });
    gsap.set(viewport, { opacity: 0, y: 6, force3D: true });
    gsap.set(buttons, { opacity: 1, y: 0, force3D: true });

    const startX = viewport ? Math.min(72, viewport.offsetWidth * 0.24) : 48;
    gsap.set(track, { x: startX, force3D: true });

    const tl = gsap.timeline();
    tl.to(overlay, { opacity: 1, duration: 0.18 });
    tl.to(card, {
      opacity: 1,
      y: 0,
      scale: 1,
      rotate: 0,
      duration: 0.34,
      ease: 'power3.out',
      force3D: true,
    }, '-=0.03');

    return () => {
      tl.kill();
      rollTimelineRef.current?.kill();
      particles.replaceChildren();
    };
  }, [result.id, result.rarity, resultIcon]);

  const reelItemsWithIcons = useMemo(() => {
    return reelItems.map(item => ({ ...item, iconSrc: resolveIcon(item.iconPath) }));
  }, [reelItems, resolveIcon]);

  useEffect(() => {
    if (!reelItemsWithIcons.length) return undefined;

    const viewport = reelViewportRef.current;
    let cancelled = false;
    Promise.all(reelItemsWithIcons.map(item => preloadImage(item.iconSrc))).then(() => {
      if (cancelled) return;
      setReelImagesReady(true);
      gsap.to(viewport, { opacity: 1, y: 0, duration: 0.22, ease: 'power2.out', force3D: true });
    });

    return () => {
      cancelled = true;
    };
  }, [reelItemsWithIcons]);

  const burstParticles = () => {
    const particles = particleRef.current;
    if (!particles) return;
    const particleCount = result.rarity === 'SSR' ? 30 : result.rarity === 'SR' ? 24 : 18;
    for (let i = 0; i < particleCount; i += 1) {
      const el = document.createElement('img');
      el.src = resultIcon;
      el.alt = '';
      el.style.cssText = `
        position: absolute;
        left: calc(50% - 10px);
        top: 224px;
        width: ${10 + Math.random() * 12}px;
        height: ${14 + Math.random() * 16}px;
        object-fit: contain;
        pointer-events: none;
        z-index: 1;
      `;
      particles.appendChild(el);

      const angle = (i / particleCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.42;
      const dist = 78 + Math.random() * 90;
      gsap.fromTo(
        el,
        { x: 0, y: 0, scale: 0, opacity: 0.9, rotate: 0 },
        {
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist - 18,
          scale: 1,
          rotate: (Math.random() - 0.5) * 260,
          opacity: 0,
          duration: 1.12 + Math.random() * 0.48,
          delay: i * 0.018,
          ease: 'power2.out',
          onComplete: () => el.remove(),
        }
      );
    }
  };

  const startRoll = () => {
    if (drawState !== 'ready') return;
    if (!reelImagesReady || !reelItemsWithIcons.length) return;

    if (!spendCoins(gachaCost)) {
      setModalNotice('金币不足');
      onInsufficientCoins?.();
      gsap.fromTo(
        btnsRef.current,
        { x: -6 },
        { x: 6, repeat: 5, yoyo: true, duration: 0.055, ease: 'sine.inOut', onComplete: () => gsap.set(btnsRef.current, { x: 0 }) }
      );
      return;
    }

    const viewport = reelViewportRef.current;
    const track = reelTrackRef.current;
    const target = reelTargetRef.current;
    const buttons = btnsRef.current;
    if (!viewport || !track || !target) return;

    const startX = Math.min(72, viewport.offsetWidth * 0.24);
    const targetCenter = target.offsetLeft + target.offsetWidth / 2;
    const endX = viewport.offsetWidth / 2 - targetCenter;
    const travel = endX - startX;
    const distanceWeight = REEL_ACCEL_DISTANCE_WEIGHT + REEL_CRUISE_DISTANCE_WEIGHT + REEL_DECEL_DISTANCE_WEIGHT;
    const accelX = startX + travel * (REEL_ACCEL_DISTANCE_WEIGHT / distanceWeight);
    const cruiseX = startX + travel * ((REEL_ACCEL_DISTANCE_WEIGHT + REEL_CRUISE_DISTANCE_WEIGHT) / distanceWeight);

    setDrawState('rolling');
    setModalNotice(null);
    gsap.set(track, { x: startX, force3D: true });
    gsap.to(buttons, { opacity: 0, y: 12, duration: 0.18, ease: 'power2.out', force3D: true });

    rollTimelineRef.current?.kill();
    rollTimelineRef.current = gsap.timeline({
      onComplete: () => {
        if (!hasRecordedResultRef.current) {
          hasRecordedResultRef.current = true;
          setIsNewResult(recordOmamoriDraw(result.id) === 1);
        }
        setDrawState('settled');
        burstParticles();
        const isRare = result.rarity === 'SSR' || result.rarity === 'SR';
        if (isRare) {
          const reward = createGachaGiftboxReward();
          grantReward(reward);
          setGiftboxReward(reward);
        }
        playSoundEffect(isRare ? SOUND_EFFECT_TYPES.LEVEL_COMPLETE : SOUND_EFFECT_TYPES.ANSWER_CORRECT);
        gsap.to(buttons, { opacity: 1, y: 0, duration: 0.24, ease: 'power2.out', force3D: true });
      },
    });
    rollTimelineRef.current
      .to(track, { x: accelX, duration: REEL_ACCEL_DURATION, ease: 'power2.in', force3D: true })
      .to(track, { x: cruiseX, duration: REEL_CRUISE_DURATION, ease: 'none', force3D: true })
      .to(track, { x: endX, duration: REEL_DECEL_DURATION, ease: 'power4.out', force3D: true });
  };

  const dismiss = (after) => {
    const tl = gsap.timeline({ onComplete: after });
    tl.to(cardRef.current, { opacity: 0, y: 30, scale: 0.96, duration: 0.2, ease: 'power2.in', force3D: true });
    tl.to(overlayRef.current, { opacity: 0, duration: 0.16 }, '-=0.08');
  };

  return createPortal(
    <div
      ref={overlayRef}
      data-ui-click-sfx
      className={`omamori-result-overlay omamori-result-overlay--${settled ? result.rarity.toLowerCase() : 'n'}`}
      style={{ '--rarity-color': modalRarity.color, '--rarity-bg': modalRarity.bg, '--rarity-glow': modalRarity.glow }}
    >
      <div ref={cardRef} className="omamori-result-card">
        <div ref={particleRef} className="omamori-result-particles" />
        <div className="omamori-result-card__shine" />
        <div className={`omamori-result-new-slot ${settled && isNewResult ? 'omamori-result-new-slot--show' : ''}`}>
          <span>New!!</span>
        </div>
        <div className="omamori-result-label">{settled ? '抽選結果' : isRolling ? '御守抽選中' : '御守抽選'}</div>

        <div className="omamori-result-reel">
          <div className="omamori-result-reel__marker" />
          {!reelImagesReady && (
            <div className="omamori-result-reel__placeholder" aria-live="polite">
              御守を並べています
            </div>
          )}
          <div ref={reelViewportRef} className="omamori-result-reel__viewport">
            <div ref={reelTrackRef} className="omamori-result-reel__track">
              {reelItemsWithIcons.map((item, index) => {
                const itemRarity = getOmamoriRarity(item.rarity);
                const isTarget = index === targetIndex;
                const displayRarity = isTarget && !settled ? neutralRarity : itemRarity;
                return (
                  <div
                    key={item.reelKey ?? `${index}-${item.id}`}
                    ref={isTarget ? reelTargetRef : null}
                    className={`omamori-result-reel__item omamori-result-reel__item--${item.rarity.toLowerCase()} ${isTarget ? 'omamori-result-reel__item--target' : ''} ${settled && isTarget ? 'omamori-result-reel__item--settled' : ''}`}
                    style={{ '--rarity-color': displayRarity.color, '--rarity-bg': displayRarity.bg, '--rarity-glow': displayRarity.glow }}
                  >
                    <div className="omamori-result-reel__figure" style={{ '--omamori-mask': `url(${item.iconSrc})` }}>
                      <img src={item.iconSrc} alt={item.name} decoding="async" />
                    </div>
                    <span className="omamori-result-reel__rarity">{item.rarity}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <h2>{settled ? result.name : isRolling ? '運命の御守を選んでいます' : '御守を迎えましょう'}</h2>
        <p>{settled ? '御守・護身符' : isRolling ? '金色の光が導いています' : '心を込めて、抽選札を引きます'}</p>
        <div className="omamori-result-rate">
          {settled ? `${result.rarity} 排出率 ${rarity.rate}%` : isRolling ? '横スクロール抽選中' : `1回 ${gachaCost}`}
        </div>
        <div className={`omamori-result-notice ${modalNotice ? 'omamori-result-notice--show' : ''}`}>
          {modalNotice ?? ' '}
        </div>

        <div ref={btnsRef} className={`omamori-result-actions ${settled ? 'omamori-result-actions--settled' : 'omamori-result-actions--ready'}`}>
          {!settled && (
            <button
              type="button"
              onClick={startRoll}
              disabled={isRolling || !reelImagesReady}
              data-sfx={SOUND_EFFECT_TYPES.WORD_SELECTED}
              className="btn-press omamori-result-button omamori-result-button--start"
            >
              {reelImagesReady ? '开始抽取' : '御守準備中'}
            </button>
          )}
          {settled && (
            <>
              <button type="button" onClick={() => dismiss(onClose)} className="btn-press omamori-result-button omamori-result-button--ghost">
                收下
              </button>
              <button
                type="button"
                onClick={() => dismiss(onDrawAgain)}
                disabled={!canDrawAgain}
                data-sfx={SOUND_EFFECT_TYPES.WORD_SELECTED}
                className="btn-press omamori-result-button omamori-result-button--draw"
              >
                <span>{canDrawAgain ? '再抽一次' : '金币不足'}</span>
                <CoinPrice coinImg={coinImg} cost={gachaCost} discounted={discounted} iconSize={18} />
              </button>
            </>
          )}
        </div>
      </div>
      {giftboxReward && (
        <RewardModal
          reward={giftboxReward}
          title="获得礼物！"
          subtitle="奖励已放入背包"
          sourceLabel="惊喜奖励"
          zIndex={190}
          onDismiss={() => setGiftboxReward(null)}
        />
      )}
    </div>,
    document.body
  );
}

function OmamoriDetailModal({ item, onClose }) {
  const resolveIcon = useIconResolver();
  const overlayRef = useRef(null);
  const imageRef = useRef(null);
  const panelRef = useRef(null);
  const rarity = getOmamoriRarity(item.rarity);
  const effect = getOmamoriEffect(item.id);

  useGSAP(() => {
    const overlay = overlayRef.current;
    const image = imageRef.current;
    const panel = panelRef.current;

    gsap.set(overlay, { opacity: 0 });
    gsap.set(image, { opacity: 0, y: 54, scale: 0.92, rotate: 0, force3D: true });
    gsap.set(panel, { opacity: 0, y: 28, force3D: true });

    const tl = gsap.timeline();
    tl.to(overlay, { opacity: 1, duration: 0.18, ease: 'power2.out' });
    tl.to(image, { opacity: 1, y: 0, scale: 1, rotate: 0, duration: 0.42, ease: 'power3.out', force3D: true }, 0.06);
    tl.to(panel, { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out', force3D: true }, 0.26);

    return () => tl.kill();
  }, [item.id]);

  const dismiss = () => {
    const tl = gsap.timeline({ onComplete: onClose });
    tl.to(panelRef.current, { opacity: 0, y: 28, duration: 0.2, ease: 'power2.in' });
    tl.to(imageRef.current, { opacity: 0, y: 56, scale: 0.84, rotate: 0, duration: 0.22, ease: 'power2.in', force3D: true }, '-=0.12');
    tl.to(overlayRef.current, { opacity: 0, duration: 0.16, ease: 'power2.in' }, '-=0.08');
  };

  return createPortal(
    <div
      ref={overlayRef}
      data-ui-click-sfx
      className={`omamori-detail-overlay omamori-detail-overlay--${item.rarity.toLowerCase()}`}
      style={{ '--rarity-color': rarity.color, '--rarity-bg': rarity.bg, '--rarity-glow': rarity.glow }}
      role="dialog"
      aria-modal="true"
      aria-label={`${item.name} の御守詳細`}
    >
      <div className="omamori-detail-overlay__glow" aria-hidden="true" />
      <div className="omamori-detail-hero" aria-hidden="true">
        <div className="omamori-detail-hero__halo" />
        <img ref={imageRef} className="omamori-detail-image" src={resolveIcon(item.iconPath)} alt="" decoding="async" />
      </div>

      <section ref={panelRef} className="omamori-detail-panel">
        <div className="omamori-detail-panel__shine" aria-hidden="true" />
        <div className="omamori-detail-heading">
          <span className="omamori-detail-rarity">{item.rarity}</span>
          <span className="omamori-detail-count">{item.count > 0 ? `累计${item.count}枚` : '未获得'}</span>
        </div>
        <h2>{item.name}</h2>
        <p className="omamori-detail-subtitle">御守・護身符</p>
        <p className="omamori-detail-lore">{item.lore}</p>
        {effect && (
          <div className="omamori-detail-effect" aria-label={`御守特效：${effect.label}`}>
            <span className="omamori-detail-effect__label">特效</span>
            <span className="omamori-detail-effect__text">{effect.label}</span>
          </div>
        )}
        <button type="button" onClick={dismiss} className="btn-press omamori-detail-close">
          关闭
        </button>
      </section>
    </div>,
    document.body
  );
}
