import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import useDailyTaskStore, { DAILY_TASK_EVENTS } from './dailyTaskStore';
import useBadgeStore from './badgeStore';
import { getHeartRegenMs, rollCheckInCoins } from '../lib/equipment-effects';

const toDateStr = (d = new Date()) => d.toISOString().slice(0, 10);

export const MAX_HEARTS   = 3;
export const REGEN_MS     = 5 * 60 * 1000; // 5 minutes per heart
const COFFEE_EXTENSION_MS = 10 * 60 * 1000;

const getActiveHeartRegenMs = (equippedItems) => getHeartRegenMs(equippedItems, REGEN_MS);
const getStoredHeartRegenMs = (value) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : REGEN_MS;
};

const getHeartRegenSchedulePatch = (state, equippedItems, now = Date.now()) => {
  const regenMs = getActiveHeartRegenMs(equippedItems);
  const { hearts, nextHeartAt } = state;

  if (hearts >= MAX_HEARTS) {
    return { nextHeartAt: null, heartRegenMs: regenMs };
  }

  if (!nextHeartAt) {
    return { heartRegenMs: regenMs };
  }

  const scheduledRegenMs = getStoredHeartRegenMs(state.heartRegenMs);
  const remaining = nextHeartAt - now;

  if (regenMs < scheduledRegenMs && remaining > regenMs) {
    return { nextHeartAt: now + regenMs, heartRegenMs: regenMs };
  }

  return { heartRegenMs: regenMs };
};

const useUserStore = create(
  persist(
    (set, get) => ({
      profile: null,
      currentStreak: 0,
      lastActiveDate: null,

      // ── Heart system ──────────────────────────────────
      hearts: MAX_HEARTS,
      nextHeartAt: null, // timestamp when the next heart will regenerate
      heartRegenMs: REGEN_MS,

      // ── Coin system ───────────────────────────────────
      coins: 0,

      // ── XP boost system ───────────────────────────
      xpBoost: null, // { multiplier: 2|3, expiresAt: timestamp } | null
      coinBoost: null, // { multiplier: 2|3, expiresAt: timestamp } | null

      // ── Inventory (backpack) ─────────────────────────
      inventory: { xp2x_15: 0, xp3x_15: 0, coin2x_15: 0, coin3x_15: 0, giftbox1: 0, giftbox2: 0, giftbox3: 0, coffee: 0, sweets_set: 0, cake: 0 },
      equippedItems: {},
      lastCoffeeUsedDate: null,

      // ── Omamori collection ───────────────────────────
      omamoriCollection: {},
      omamoriViewedDetails: {},

      // ── Learning profile (persisted from onboarding wizard) ──
      learningProfile: null, // { level, pace, purpose, style } | null

      setProfile(data) {
        set({ profile: { ...data, createdAt: Date.now() } });
      },

      setLearningProfile(data) {
        set({ learningProfile: data });
      },

      updateProfile(partial) {
        set(s => ({ profile: { ...s.profile, ...partial } }));
      },

      checkStreak() {
        const today = toDateStr();
        const { lastActiveDate, currentStreak } = get();
        if (lastActiveDate === today) return;
        const yesterday = toDateStr(new Date(Date.now() - 864e5));
        set({
          currentStreak: lastActiveDate === yesterday ? currentStreak + 1 : 1,
          lastActiveDate: today,
        });
      },

      // Call whenever hearts might have regenerated (app open, page focus, etc.)
      syncHearts() {
        const { hearts, nextHeartAt, heartRegenMs, equippedItems } = get();
        const regenMs = getActiveHeartRegenMs(equippedItems);
        if (hearts >= MAX_HEARTS || !nextHeartAt) {
          if (heartRegenMs !== regenMs || nextHeartAt) {
            set({ heartRegenMs: regenMs, nextHeartAt: hearts >= MAX_HEARTS ? null : nextHeartAt });
          }
          return;
        }
        const now = Date.now();
        const scheduledRegenMs = getStoredHeartRegenMs(heartRegenMs);
        let effectiveNextHeartAt = nextHeartAt;
        if (regenMs < scheduledRegenMs && nextHeartAt - now > regenMs) {
          effectiveNextHeartAt = now + regenMs;
        }
        if (now < effectiveNextHeartAt) {
          if (effectiveNextHeartAt !== nextHeartAt || heartRegenMs !== regenMs) {
            set({ nextHeartAt: effectiveNextHeartAt, heartRegenMs: regenMs });
          }
          return;
        }
        const gained = Math.min(
          MAX_HEARTS - hearts,
          Math.floor((now - effectiveNextHeartAt) / regenMs) + 1
        );
        const newHearts = hearts + gained;
        set({
          hearts: newHearts,
          nextHeartAt: newHearts >= MAX_HEARTS ? null : effectiveNextHeartAt + gained * regenMs,
          heartRegenMs: regenMs,
        });
      },

      // Deduct one heart and start regen timer if not already running
      deductHeart() {
        const { hearts, nextHeartAt, heartRegenMs, equippedItems } = get();
        if (hearts <= 0) return;
        const newHearts = hearts - 1;
        const regenMs = getActiveHeartRegenMs(equippedItems);
        const now = Date.now();
        let nextRegenAt = nextHeartAt ?? now + regenMs;
        if (nextHeartAt && regenMs < getStoredHeartRegenMs(heartRegenMs) && nextHeartAt - now > regenMs) {
          nextRegenAt = now + regenMs;
        }
        set({
          hearts: newHearts,
          // Only (re)start regen when dipping below MAX_HEARTS.
          // If hearts are still >= MAX_HEARTS (temp hearts being consumed), keep null.
          nextHeartAt: newHearts < MAX_HEARTS ? nextRegenAt : null,
          heartRegenMs: regenMs,
        });
      },

      addCoins(amount) {
        if (amount <= 0) return;
        useBadgeStore.getState().addCoinsEarned(amount);
        set(s => ({ coins: s.coins + amount }));
      },

      addBoostedCoins(amount) {
        const baseAmount = Math.max(0, Number(amount) || 0);
        if (baseAmount <= 0) return 0;
        const { coinBoost } = get();
        const multiplier = coinBoost && Date.now() < coinBoost.expiresAt ? coinBoost.multiplier : 1;
        const finalAmount = Math.round(baseAmount * multiplier);
        get().addCoins(finalAmount);
        return finalAmount;
      },

      spendCoins(amount) {
        const cost = Math.max(0, Number(amount) || 0);
        if (cost <= 0) return false;
        const { coins } = get();
        if (coins < cost) return false;
        set({ coins: coins - cost });
        return true;
      },

      recordOmamoriDraw(itemId) {
        if (!itemId) return 0;
        let nextCount = 0;
        set(s => {
          const current = s.omamoriCollection?.[itemId] ?? 0;
          nextCount = current + 1;
          return {
            omamoriCollection: {
              ...(s.omamoriCollection ?? {}),
              [itemId]: nextCount,
            },
          };
        });
        return nextCount;
      },

      markOmamoriDetailViewed(itemId) {
        if (!itemId) return false;
        set(s => ({
          omamoriViewedDetails: {
            ...(s.omamoriViewedDetails ?? {}),
            [itemId]: true,
          },
        }));
        return true;
      },

      grantReward(reward) {
        const amount = Math.max(0, Number(reward?.amount) || 0);
        if (amount <= 0) return false;

        if (reward.type === 'coins') {
          useBadgeStore.getState().addCoinsEarned(amount);
          set(s => ({ coins: s.coins + amount }));
          return true;
        }

        if (reward.type === 'item' && reward.itemId) {
          set(s => ({
            inventory: {
              ...s.inventory,
              [reward.itemId]: (s.inventory?.[reward.itemId] ?? 0) + amount,
            },
          }));
          return true;
        }

        return false;
      },

      // Perform daily check-in; returns coins awarded (0 if already done today)
      checkIn() {
        const today = toDateStr();
        if (get().lastCheckIn === today) return 0;
        const amount = rollCheckInCoins(get().equippedItems);
        useBadgeStore.getState().addCoinsEarned(amount);
        set(s => ({ coins: s.coins + amount, lastCheckIn: today }));
        return amount;
      },

      // Check if the boost has expired and clear it
      syncXpBoost() {
        const { xpBoost, coinBoost } = get();
        const now = Date.now();
        const next = {};
        if (xpBoost && now >= xpBoost.expiresAt) next.xpBoost = null;
        if (coinBoost && now >= coinBoost.expiresAt) next.coinBoost = null;
        if (Object.keys(next).length > 0) set(next);
      },

      // Activate an XP card; returns true on success
      useXpCard(multiplier) {
        const { xpBoost, coinBoost, inventory } = get();
        if (xpBoost !== null || coinBoost !== null) return false; // another boost is already active
        const itemId = multiplier === 2 ? 'xp2x_15' : 'xp3x_15';
        const count = inventory?.[itemId] ?? 0;
        if (count <= 0) return false;
        set({
          xpBoost: { multiplier, expiresAt: Date.now() + 15 * 60 * 1000 },
          inventory: { ...inventory, [itemId]: count - 1 },
        });
        return true;
      },

      useCoinCard(multiplier) {
        const { xpBoost, coinBoost, inventory } = get();
        if (xpBoost !== null || coinBoost !== null) return false;
        const itemId = multiplier === 2 ? 'coin2x_15' : 'coin3x_15';
        const count = inventory?.[itemId] ?? 0;
        if (count <= 0) return false;
        set({
          coinBoost: { multiplier, expiresAt: Date.now() + 15 * 60 * 1000 },
          inventory: { ...inventory, [itemId]: count - 1 },
        });
        return true;
      },

      debugActivateXpBoost(multiplier = 2) {
        const normalized = Number(multiplier) === 3 ? 3 : 2;
        const expiresAt = Date.now() + 15 * 60 * 1000;
        set({
          xpBoost: {
            multiplier: normalized,
            expiresAt,
          },
          coinBoost: null,
        });
        return {
          multiplier: normalized,
          expiresAt,
        };
      },

      debugActivateCoinBoost(multiplier = 2) {
        const normalized = Number(multiplier) === 3 ? 3 : 2;
        const expiresAt = Date.now() + 15 * 60 * 1000;
        set({
          coinBoost: {
            multiplier: normalized,
            expiresAt,
          },
          xpBoost: null,
        });
        return {
          multiplier: normalized,
          expiresAt,
        };
      },

      debugAddCoins(amount = 1000) {
        const added = Math.max(1, Math.floor(Number(amount) || 1000));
        let nextCoins = 0;
        set(s => {
          nextCoins = s.coins + added;
          return { coins: nextCoins };
        });
        return {
          ok: true,
          added,
          coins: nextCoins,
        };
      },

      // Use one Cake item: adds 3 hearts (may exceed MAX_HEARTS, max 5).
      // Only allowed when hearts < MAX_HEARTS (not already full/over-full).
      useCake() {
        const { hearts, inventory } = get();
        if (hearts >= MAX_HEARTS) return false;
        const cakeCount = inventory?.cake ?? 0;
        if (cakeCount <= 0) return false;
        set({
          hearts: hearts + 3,
          inventory: { ...inventory, cake: cakeCount - 1 },
          nextHeartAt: null, // hearts will be >= MAX_HEARTS now; pause regen
        });
        useBadgeStore.getState().recordCakeEaten(1);
        useDailyTaskStore.getState().recordEvent(DAILY_TASK_EVENTS.CAKE_USED, 1);
        return true;
      },

      useCoffee() {
        get().syncXpBoost();
        const today = toDateStr();
        const { inventory, xpBoost, coinBoost, lastCoffeeUsedDate } = get();
        if (lastCoffeeUsedDate === today) return false;
        const coffeeCount = inventory?.coffee ?? 0;
        if (coffeeCount <= 0) return false;

        const now = Date.now();
        if (xpBoost && now < xpBoost.expiresAt) {
          set({
            xpBoost: { ...xpBoost, expiresAt: xpBoost.expiresAt + COFFEE_EXTENSION_MS },
            inventory: { ...inventory, coffee: coffeeCount - 1 },
            lastCoffeeUsedDate: today,
          });
          return true;
        }

        if (coinBoost && now < coinBoost.expiresAt) {
          set({
            coinBoost: { ...coinBoost, expiresAt: coinBoost.expiresAt + COFFEE_EXTENSION_MS },
            inventory: { ...inventory, coffee: coffeeCount - 1 },
            lastCoffeeUsedDate: today,
          });
          return true;
        }

        return false;
      },

      useSweetsSet() {
        const { hearts, inventory } = get();
        if (hearts >= MAX_HEARTS) return false;
        const sweetsCount = inventory?.sweets_set ?? 0;
        if (sweetsCount <= 0) return false;
        set({
          hearts: 5,
          inventory: { ...inventory, sweets_set: sweetsCount - 1 },
          nextHeartAt: null,
        });
        return true;
      },

      useGiftbox(itemId, reward) {
        if (!['giftbox1', 'giftbox2', 'giftbox3'].includes(itemId)) return false;
        const { inventory } = get();
        const count = inventory?.[itemId] ?? 0;
        if (count <= 0 || !reward) return false;
        set({
          inventory: {
            ...inventory,
            [itemId]: count - 1,
          },
        });
        return get().grantReward(reward);
      },

      toggleEquipment(itemId) {
        if (!itemId) return false;
        get().syncHearts();
        const { inventory, equippedItems } = get();
        if ((inventory?.[itemId] ?? 0) <= 0) return false;
        const nextEquipped = !(equippedItems?.[itemId] ?? false);
        const nextEquippedItems = {
          ...(equippedItems ?? {}),
          [itemId]: nextEquipped,
        };
        set({
          equippedItems: nextEquippedItems,
          ...getHeartRegenSchedulePatch(get(), nextEquippedItems),
        });
        return nextEquipped;
      },

      // Restore one heart (used when AI overturns a wrong answer)
      restoreHeart() {
        const { hearts, nextHeartAt } = get();
        const newHearts = hearts + 1;
        set({
          hearts: newHearts,
          nextHeartAt: newHearts >= MAX_HEARTS ? null : nextHeartAt,
        });
      },

      // Purchase an item from the shop; returns true on success
      purchaseItem(itemId, price, options = {}) {
        get().syncHearts();
        const { coins, inventory, equippedItems } = get();
        if (coins < price) return false;
        if (options.singlePurchase && (inventory?.[itemId] ?? 0) > 0) return false;
        const nextEquippedItems = options.autoEquip
          ? {
            ...(equippedItems ?? {}),
            [itemId]: true,
          }
          : equippedItems;
        set({
          coins: coins - price,
          inventory: {
            ...inventory,
            [itemId]: options.singlePurchase ? 1 : (inventory?.[itemId] ?? 0) + 1,
          },
          ...(options.autoEquip ? { equippedItems: nextEquippedItems } : {}),
          ...(options.autoEquip ? getHeartRegenSchedulePatch(get(), nextEquippedItems) : {}),
        });
        return true;
      },
    }),
    {
      name: 'benkyo-ai-user',
      // Persist all relevant fields (profile, streak, hearts)
      partialize: (s) => ({
        profile: s.profile,
        currentStreak: s.currentStreak,
        lastActiveDate: s.lastActiveDate,
        hearts: s.hearts,
        nextHeartAt: s.nextHeartAt,
        heartRegenMs: s.heartRegenMs,
        coins: s.coins,
        inventory: s.inventory,
        equippedItems: s.equippedItems,
        omamoriCollection: s.omamoriCollection,
        omamoriViewedDetails: s.omamoriViewedDetails,
        xpBoost: s.xpBoost,
        coinBoost: s.coinBoost,
        lastCoffeeUsedDate: s.lastCoffeeUsedDate,
        lastCheckIn: s.lastCheckIn,
        learningProfile: s.learningProfile,
      }),
    }
  )
);

export default useUserStore;
