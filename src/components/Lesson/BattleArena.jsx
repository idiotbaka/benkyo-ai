import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { MAX_HEARTS } from '../../store/userStore';
import { useIcon, useIconResolver } from '../../lib/icons';

gsap.registerPlugin(useGSAP);

const BATTLE_IMAGE_PATHS = {
  idle: {
    player: 'sd/sd2_battle_idle.png',
    enemy: 'sd/sd2_enemy_idle.png',
  },
  correct: {
    player: 'sd/sd2_battle_attack.png',
    enemy: 'sd/sd2_enemy_damaged.png',
  },
  wrong: {
    player: 'sd/sd2_battle_damaged.png',
    enemy: 'sd/sd2_enemy_attack.png',
  },
};

function HeartRow({ hearts }) {
  const heartImg = useIcon('ui/heart.png');
  const heartYellowImg = useIcon('ui/heart_yellow.png');
  const totalSlots = Math.max(MAX_HEARTS, hearts);

  return (
    <div className="flex gap-0.5">
      {Array.from({ length: totalSlots }).map((_, i) => {
        const filled = i < hearts;
        const isTemp = i >= MAX_HEARTS;

        return (
          <img
            key={i}
            src={isTemp ? heartYellowImg : heartImg}
            alt="heart"
            width={18}
            height={18}
            style={{
              objectFit: 'contain',
              filter: filled ? 'none' : 'grayscale(1)',
              opacity: filled ? 1 : 0.3,
              transition: 'all 0.3s',
            }}
          />
        );
      })}
    </div>
  );
}

export default function BattleArena({
  battleState = 'idle',
  hearts,
  enemyHp,
  enemyHpRef,
  shouldSlide = true,
  showHearts = true,
  showUmbrellaShield = false,
  showSakuraPetalShield = false,
}) {
  const resolveIcon = useIconResolver();
  const umbrellaImg = useIcon('item/umbrella.png');
  const sakuraPetalImg = useIcon('item/sakura_petal.png');
  const imagePaths = BATTLE_IMAGE_PATHS[battleState] ?? BATTLE_IMAGE_PATHS.idle;
  const images = {
    player: resolveIcon(imagePaths.player),
    enemy: resolveIcon(imagePaths.enemy),
  };
  const shieldImg = showSakuraPetalShield ? sakuraPetalImg : umbrellaImg;
  const showShield = showUmbrellaShield || showSakuraPetalShield;
  const playerPositionRef = useRef(null);
  const enemyPositionRef = useRef(null);

  useGSAP(() => {
    const playerX = shouldSlide && battleState === 'correct' ? 58 : 0;
    const enemyX = shouldSlide && battleState === 'wrong' ? -58 : 0;

    gsap.to(playerPositionRef.current, {
      xPercent: playerX,
      duration: 0.38,
      ease: battleState === 'correct' ? 'power2.out' : 'back.out(1.4)',
      overwrite: 'auto',
    });
    gsap.to(enemyPositionRef.current, {
      xPercent: enemyX,
      duration: 0.38,
      ease: battleState === 'wrong' ? 'power2.out' : 'back.out(1.4)',
      overwrite: 'auto',
    });
  }, { dependencies: [battleState, shouldSlide] });

  return (
    <div className="relative basis-[29%] min-h-[128px] max-h-[168px] shrink-0 overflow-hidden rounded-2xl border border-[#EDE9FE] bg-gradient-to-b from-[#FAF7FF] to-[#F3EEFF]">
      {showHearts && (
        <div className="absolute left-[8%] top-3 z-20 drop-shadow-sm">
          <HeartRow hearts={hearts} />
        </div>
      )}
      <div className="absolute right-[6%] top-3 z-20 w-[39%]">
        <div className="mb-0.5 text-[0.6rem] font-black italic tracking-wider text-[#DC2626] drop-shadow-sm">HP</div>
        <div className="h-2.5 overflow-hidden rounded-full bg-[#FECACA] shadow-sm ring-1 ring-[#FCA5A5]">
          <div
            ref={enemyHpRef}
            className="h-full rounded-full bg-gradient-to-r from-[var(--tp-from)] to-[var(--tp)]"
            style={{ width: `${enemyHp}%` }}
          />
        </div>
      </div>
      <div
        className={`battle-umbrella-shield ${showShield ? 'battle-umbrella-shield--active' : ''} ${showSakuraPetalShield ? 'battle-umbrella-shield--sakura' : ''}`}
        aria-hidden="true"
      >
        <img
          src={shieldImg}
          alt=""
          className="battle-umbrella-shield__image"
          decoding="async"
        />
      </div>
      <div className="absolute bottom-3 left-[8%] right-[8%] h-3 rounded-[50%] bg-[#DDD6FE]/45 blur-sm" />
      <div
        ref={playerPositionRef}
        className="pointer-events-none absolute bottom-0 left-[3%] z-10 h-[clamp(104px,25vw,152px)] w-[42%]"
      >
        <img
          src={images.player}
          alt="角色"
          className="battle-combat-hop h-full w-full select-none object-contain object-bottom"
        />
      </div>
      <div
        ref={enemyPositionRef}
        className="pointer-events-none absolute bottom-0 right-[3%] z-10 h-[clamp(104px,25vw,152px)] w-[42%]"
      >
        <img
          src={images.enemy}
          alt="敌人"
          className="battle-combat-hop battle-combat-hop--enemy h-full w-full select-none object-contain object-bottom"
        />
      </div>
    </div>
  );
}
