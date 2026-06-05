import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import useDailyTaskStore, { DAILY_TASK_EVENTS } from './dailyTaskStore';

const toDateStr = (d = new Date()) => d.toISOString().slice(0, 10);

export const MAX_HEARTS   = 3;
export const REGEN_MS     = 5 * 60 * 1000; // 5 minutes per heart

const useUserStore = create(
  persist(
    (set, get) => ({
      profile: null,
      currentStreak: 0,
      lastActiveDate: null,

      // ── Heart system ──────────────────────────────────
      hearts: MAX_HEARTS,
      nextHeartAt: null, // timestamp when the next heart will regenerate

      // ── Coin system ───────────────────────────────────
      coins: 0,

      // ── XP boost system ───────────────────────────
      xpBoost: null, // { multiplier: 2|3, expiresAt: timestamp } | null

      // ── Inventory (backpack) ─────────────────────────
      inventory: { xp2x_15: 0, xp3x_15: 0, cake: 0 },

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
        const { hearts, nextHeartAt } = get();
        if (hearts >= MAX_HEARTS || !nextHeartAt) return;
        const now = Date.now();
        if (now < nextHeartAt) return;
        const gained = Math.min(
          MAX_HEARTS - hearts,
          Math.floor((now - nextHeartAt) / REGEN_MS) + 1
        );
        const newHearts = hearts + gained;
        set({
          hearts: newHearts,
          nextHeartAt: newHearts >= MAX_HEARTS ? null : nextHeartAt + gained * REGEN_MS,
        });
      },

      // Deduct one heart and start regen timer if not already running
      deductHeart() {
        const { hearts, nextHeartAt } = get();
        if (hearts <= 0) return;
        const newHearts = hearts - 1;
        set({
          hearts: newHearts,
          // Only (re)start regen when dipping below MAX_HEARTS.
          // If hearts are still >= MAX_HEARTS (temp hearts being consumed), keep null.
          nextHeartAt: newHearts < MAX_HEARTS
            ? (nextHeartAt ?? Date.now() + REGEN_MS)
            : null,
        });
      },

      addCoins(amount) {
        if (amount <= 0) return;
        set(s => ({ coins: s.coins + amount }));
      },

      grantReward(reward) {
        const amount = Math.max(0, Number(reward?.amount) || 0);
        if (amount <= 0) return false;

        if (reward.type === 'coins') {
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
        const amount = Math.floor(Math.random() * 61) + 60; // 60~120
        set(s => ({ coins: s.coins + amount, lastCheckIn: today }));
        return amount;
      },

      // Check if the boost has expired and clear it
      syncXpBoost() {
        const { xpBoost } = get();
        if (!xpBoost) return;
        if (Date.now() >= xpBoost.expiresAt) set({ xpBoost: null });
      },

      // Activate an XP card; returns true on success
      useXpCard(multiplier) {
        const { xpBoost, inventory } = get();
        if (xpBoost !== null) return false; // another boost is already active
        const itemId = multiplier === 2 ? 'xp2x_15' : 'xp3x_15';
        const count = inventory?.[itemId] ?? 0;
        if (count <= 0) return false;
        set({
          xpBoost: { multiplier, expiresAt: Date.now() + 15 * 60 * 1000 },
          inventory: { ...inventory, [itemId]: count - 1 },
        });
        return true;
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
        useDailyTaskStore.getState().recordEvent(DAILY_TASK_EVENTS.CAKE_USED, 1);
        return true;
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
      purchaseItem(itemId, price) {
        const { coins, inventory } = get();
        if (coins < price) return false;
        set({
          coins: coins - price,
          inventory: { ...inventory, [itemId]: (inventory[itemId] ?? 0) + 1 },
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
        coins: s.coins,
        inventory: s.inventory,
        xpBoost: s.xpBoost,
        lastCheckIn: s.lastCheckIn,
        learningProfile: s.learningProfile,
      }),
    }
  )
);

export default useUserStore;
