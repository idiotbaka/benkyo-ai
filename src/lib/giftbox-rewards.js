import { ITEM_DEFINITIONS } from '../data/shopItems';

const itemById = new Map(ITEM_DEFINITIONS.map(item => [item.id, item]));

function createItemReward(itemId) {
  const item = itemById.get(itemId);
  if (!item) return null;
  return {
    type: 'item',
    itemId,
    amount: 1,
    label: item.name,
    iconPath: item.iconPath,
  };
}

function createCoinReward(min, max) {
  const amount = Math.floor(Math.random() * (max - min + 1)) + min;
  return {
    type: 'coins',
    amount,
    label: '金币',
    iconPath: 'item/coin.png',
  };
}

function createItemRewardWithAmount(itemId, amount) {
  const reward = createItemReward(itemId);
  return reward ? { ...reward, amount } : null;
}

function pickWeighted(options) {
  const roll = Math.random();
  let cursor = 0;
  for (const option of options) {
    cursor += option.chance;
    if (roll < cursor) return option.itemId ? createItemReward(option.itemId) : null;
  }
  return null;
}

export function drawLessonGiftboxReward(stars) {
  if (stars === 3) {
    return pickWeighted([
      { itemId: 'giftbox2', chance: 0.7 },
      { itemId: 'giftbox1', chance: 0.3 },
    ]);
  }

  if (stars === 2) {
    return pickWeighted([
      { itemId: 'giftbox2', chance: 0.5 },
      { itemId: 'giftbox1', chance: 0.5 },
    ]);
  }

  if (stars === 1) {
    return pickWeighted([
      { itemId: 'giftbox1', chance: 0.7 },
      { itemId: null, chance: 0.3 },
    ]);
  }

  return null;
}

export function createListeningGiftboxReward() {
  return createItemReward('giftbox1');
}

export function drawWordReviewGiftboxReward() {
  return pickWeighted([
    { itemId: 'giftbox1', chance: 0.3 },
    { itemId: null, chance: 0.7 },
  ]);
}

export function createGachaGiftboxReward() {
  return createItemReward('giftbox3');
}

export function drawGiftboxOpenReward(giftboxId) {
  if (giftboxId === 'giftbox1') {
    return createCoinReward(40, 80);
  }

  if (giftboxId === 'giftbox2') {
    const rewards = [
      () => createItemReward('cake'),
      () => createItemReward('sweets_set'),
      () => createItemReward('coffee'),
      () => createItemReward('xp2x_15'),
      () => createItemReward('xp3x_15'),
      () => createItemReward('coin2x_15'),
      () => createCoinReward(80, 120),
    ];
    return rewards[Math.floor(Math.random() * rewards.length)]();
  }

  if (giftboxId === 'giftbox3') {
    const rewards = [
      () => createItemRewardWithAmount('sweets_set', 3),
      () => createItemRewardWithAmount('coin3x_15', 2),
      () => createCoinReward(300, 500),
    ];
    return rewards[Math.floor(Math.random() * rewards.length)]();
  }

  return null;
}