import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const shots = path.join(__dirname, 'screenshots');

import fs from 'fs';
fs.mkdirSync(shots, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  executablePath: 'C:/Users/baka/AppData/Local/ms-playwright/chromium-1124/chrome-win/chrome.exe',
});
const page = await browser.newPage();
await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14 Pro

// ── 1. Home page ──
await page.goto('http://localhost:5173/', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(shots, '1-home.png') });
console.log('✅ Home page loaded');

// Check chapter banner exists
const banner = await page.locator('text=第一章').count();
console.log(banner > 0 ? '✅ Chapter banner visible' : '❌ Chapter banner missing');

// Check level nodes
const nodes = await page.locator('.level-node').count();
console.log(nodes > 0 ? `✅ Level nodes visible: ${nodes}` : '❌ No level nodes found');

// ── 2. Click Level 1 ──
await page.locator('.level-node').first().click();
await page.waitForTimeout(800);
await page.screenshot({ path: path.join(shots, '2-lesson-start.png') });
console.log('✅ Clicked Level 1');

// Check lesson screen loaded (progress bar)
const progressBar = await page.locator('.progress-track').count();
console.log(progressBar > 0 ? '✅ Lesson screen visible (progress bar)' : '❌ Progress bar missing');

// Check word options
const wordBtns = await page.locator('.word-btn').count();
console.log(wordBtns === 4 ? '✅ 4 word option buttons visible' : `❌ Expected 4 word buttons, got ${wordBtns}`);

// Check blank slot
const blankSlot = await page.locator('.blank-slot').count();
console.log(blankSlot > 0 ? '✅ Blank slot visible in sentence' : '❌ Blank slot missing');

// ── 3. Click correct answer (は) ──
const haBtn = page.locator('.word-btn', { hasText: 'は' }).first();
const haBtnCount = await haBtn.count();
if (haBtnCount > 0) {
  await haBtn.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(shots, '3-correct-answer.png') });
  console.log('✅ Clicked correct answer (は)');

  // Check feedback panel
  const feedbackPanel = await page.locator('text=よくできました').count();
  console.log(feedbackPanel > 0 ? '✅ Correct feedback panel shown' : '❌ Correct feedback panel missing');
} else {
  // は might not be on first question if shuffled, try first button
  const firstBtn = page.locator('.word-btn').first();
  await firstBtn.click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(shots, '3-answer.png') });
  console.log('✅ Clicked first answer (shuffled question order)');
}

// ── 4. Click つぎへ to advance ──
const nextBtn = page.locator('text=つぎへ →');
const nextCount = await nextBtn.count();
if (nextCount > 0) {
  await nextBtn.click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: path.join(shots, '4-next-question.png') });
  console.log('✅ Advanced to next question');
}

// ── 5. Test a wrong answer ──
// Find any visible word button that's NOT the answer
const allWordBtns = await page.locator('.word-btn').all();
if (allWordBtns.length >= 2) {
  // Click the last option (likely wrong)
  await allWordBtns[allWordBtns.length - 1].click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(shots, '5-wrong-answer.png') });
  console.log('✅ Tested wrong answer path');
  const wrongFeedback = await page.locator('text=惜しい').count();
  console.log(wrongFeedback > 0 ? '✅ Wrong feedback panel shown' : `⚠️ Wrong feedback might not show (shuffled questions, may have been correct)`);

  // Continue
  const nextBtn2 = page.locator('text=つぎへ →');
  if (await nextBtn2.count() > 0) await nextBtn2.click();
}

// ── 6. Go through all remaining questions ──
let questionsDone = 2;
while (questionsDone < 8) {
  await page.waitForTimeout(300);
  const btns = await page.locator('.word-btn').all();
  if (btns.length === 0) {
    // Maybe on complete screen
    break;
  }
  await btns[0].click();
  await page.waitForTimeout(500);
  const nb = page.locator('text=つぎへ →');
  if (await nb.count() > 0) await nb.click();
  questionsDone++;
}

await page.waitForTimeout(800);
await page.screenshot({ path: path.join(shots, '6-final.png') });

// Check completion screen
const completeText = await page.locator('text=よくできました').count() + await page.locator('text=完璧です').count() + await page.locator('text=がんばりました').count();
console.log(completeText > 0 ? '✅ Lesson complete screen visible' : '❌ Lesson complete screen not shown');

// Check stars
const xpText = await page.locator('text=XP').count();
console.log(xpText > 0 ? '✅ XP display visible' : '❌ XP missing on complete screen');

await page.screenshot({ path: path.join(shots, '7-complete.png') });
console.log(`\n📸 Screenshots saved to: ${shots}`);

await browser.close();
console.log('\n🎉 Verification complete');
