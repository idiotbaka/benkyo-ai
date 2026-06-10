import { OMAMORI_GACHA_COST } from '../data/omamoriGacha';

export const EQUIPMENT_IDS = {
  ROUND_FAN: 'equip_round_fan',
  EMA: 'equip_ema',
  UMBRELLA: 'equip_umbrella',
  WIND_CHIME: 'equip_wind_chime',
  SAKURA_PETAL: 'equip_sakura_petal',
};

export const ROUND_FAN_GACHA_COST = 160;
export const EMA_STAR_FLOOR = 2;
export const WIND_CHIME_HEART_REGEN_MS = 60 * 1000;

export function isEquipmentEquipped(equippedItems, itemId) {
  return Boolean(equippedItems?.[itemId]);
}

export function getOmamoriGachaCost(equippedItems) {
  return isEquipmentEquipped(equippedItems, EQUIPMENT_IDS.ROUND_FAN)
    ? ROUND_FAN_GACHA_COST
    : OMAMORI_GACHA_COST;
}

export function hasOmamoriGachaDiscount(equippedItems) {
  return getOmamoriGachaCost(equippedItems) < OMAMORI_GACHA_COST;
}

export function getHeartRegenMs(equippedItems, defaultRegenMs) {
  return isEquipmentEquipped(equippedItems, EQUIPMENT_IDS.WIND_CHIME)
    ? WIND_CHIME_HEART_REGEN_MS
    : defaultRegenMs;
}

export function applyEmaStarFloor(stars, equippedItems) {
  const normalizedStars = Math.max(0, Number(stars) || 0);
  if (!isEquipmentEquipped(equippedItems, EQUIPMENT_IDS.EMA) || normalizedStars <= 0) {
    return normalizedStars;
  }
  return Math.min(3, Math.max(EMA_STAR_FLOOR, normalizedStars));
}

export function canUseUmbrellaShield(lesson, question, equippedItems) {
  return Boolean(
    lesson &&
    question &&
    !lesson.isPractice &&
    !question._isReview &&
    !lesson.umbrellaShieldUsed &&
    isEquipmentEquipped(equippedItems, EQUIPMENT_IDS.UMBRELLA)
  );
}

export function canUseSakuraPetalShield(lesson, question, equippedItems) {
  return Boolean(
    lesson &&
    question?.type &&
    lesson.practiceType === 'wrong-review' &&
    isEquipmentEquipped(equippedItems, EQUIPMENT_IDS.SAKURA_PETAL)
  );
}
