import { OMAMORI_GACHA_COST } from '../data/omamoriGacha';

export const EQUIPMENT_IDS = {
  ROUND_FAN: 'equip_round_fan',
  EMA: 'equip_ema',
  UMBRELLA: 'equip_umbrella',
  WIND_CHIME: 'equip_wind_chime',
  SAKURA_PETAL: 'equip_sakura_petal',
  LUCKY_CAT: 'equip_lucky_cat',
  TENGU_MASK: 'equip_tengu_mask',
  DARUMA: 'equip_daruma',
  MINI_FUJI: 'equip_mini_fuji',
};

export const ROUND_FAN_GACHA_COST = 160;
export const EMA_STAR_FLOOR = 2;
export const WIND_CHIME_HEART_REGEN_MS = 60 * 1000;
export const PERFECT_CLEAR_BONUS_COINS = 10;
export const LUCKY_CAT_PERFECT_CLEAR_BONUS_COINS = 60;
export const CHECK_IN_COIN_MIN = 60;
export const CHECK_IN_COIN_MAX = 120;
export const MINI_FUJI_CHECK_IN_MULTIPLIER = 5;

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

export function getCheckInCoinMultiplier(equippedItems) {
  return isEquipmentEquipped(equippedItems, EQUIPMENT_IDS.MINI_FUJI)
    ? MINI_FUJI_CHECK_IN_MULTIPLIER
    : 1;
}

export function getCheckInCoinRange(equippedItems) {
  const multiplier = getCheckInCoinMultiplier(equippedItems);
  return {
    min: CHECK_IN_COIN_MIN * multiplier,
    max: CHECK_IN_COIN_MAX * multiplier,
  };
}

export function rollCheckInCoins(equippedItems) {
  const baseAmount = Math.floor(Math.random() * (CHECK_IN_COIN_MAX - CHECK_IN_COIN_MIN + 1)) + CHECK_IN_COIN_MIN;
  return baseAmount * getCheckInCoinMultiplier(equippedItems);
}

export function hasMiniFujiCheckInBonus(equippedItems) {
  return isEquipmentEquipped(equippedItems, EQUIPMENT_IDS.MINI_FUJI);
}

export function applyEmaStarFloor(stars, equippedItems) {
  const normalizedStars = Math.max(0, Number(stars) || 0);
  if (!isEquipmentEquipped(equippedItems, EQUIPMENT_IDS.EMA) || normalizedStars <= 0) {
    return normalizedStars;
  }
  return Math.min(3, Math.max(EMA_STAR_FLOOR, normalizedStars));
}

export function getPerfectClearBonusCoins(stars, equippedItems) {
  if (stars !== 3) return 0;
  return isEquipmentEquipped(equippedItems, EQUIPMENT_IDS.LUCKY_CAT)
    ? LUCKY_CAT_PERFECT_CLEAR_BONUS_COINS
    : PERFECT_CLEAR_BONUS_COINS;
}

export function hasLuckyCatPerfectBonus(equippedItems) {
  return isEquipmentEquipped(equippedItems, EQUIPMENT_IDS.LUCKY_CAT);
}

export function getTenguMarkedWrongOptionIndex(options, isCorrectOption, equippedItems) {
  if (!isEquipmentEquipped(equippedItems, EQUIPMENT_IDS.TENGU_MASK) || !Array.isArray(options)) {
    return -1;
  }

  const wrongOptionIndexes = options
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => !isCorrectOption(option))
    .map(({ index }) => index);

  if (wrongOptionIndexes.length === 0) return -1;
  return wrongOptionIndexes[Math.floor(Math.random() * wrongOptionIndexes.length)];
}

export function getXpStars(stars, equippedItems) {
  const normalizedStars = Math.max(0, Number(stars) || 0);
  if (normalizedStars <= 0) return 0;
  return isEquipmentEquipped(equippedItems, EQUIPMENT_IDS.DARUMA) ? 3 : normalizedStars;
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
