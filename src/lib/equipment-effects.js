import { OMAMORI_GACHA_COST } from '../data/omamoriGacha';

export const EQUIPMENT_IDS = {
  ROUND_FAN: 'equip_round_fan',
  EMA: 'equip_ema',
};

export const ROUND_FAN_GACHA_COST = 160;
export const EMA_STAR_FLOOR = 2;

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

export function applyEmaStarFloor(stars, equippedItems) {
  const normalizedStars = Math.max(0, Number(stars) || 0);
  if (!isEquipmentEquipped(equippedItems, EQUIPMENT_IDS.EMA) || normalizedStars <= 0) {
    return normalizedStars;
  }
  return Math.min(3, Math.max(EMA_STAR_FLOOR, normalizedStars));
}
