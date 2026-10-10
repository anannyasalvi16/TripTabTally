import { test, expect } from '@playwright/test';
import { createAuthCookie } from './auth-helper';
import * as fs from 'fs';
import * as path from 'path';

const viewports = [
  { name: '320', width: 320, height: 600 },
  { name: '360', width: 360, height: 640 },
  { name: '820', width: 820, height: 1180 },
  { name: '1280', width: 1280, height: 800 },
  { name: '1920', width: 1920, height: 1080 },
  { name: '844x390_landscape', width: 844, height: 390 },
];

const pagesToTest = [
  { name: 'trips_home', path: '/trips' },
  { name: 'trip_ledger', path: '/trips/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' },
  { name: 'add_expense', path: '/trips/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/expenses/new' },
  { name: 'people', path: '/trips/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/people' },
  { name: 'budget', path: '/trips/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/budget' },
  { name: 'settle_up', path: '/trips/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/settle' },
  { name: 'profile', path: '/profile' },
  { name: 'login', path: '/login', unauth: true },
];

const screenshotsDir = path.join(process.cwd(), 'screenshots', 'step3');

test.beforeAll(() => {
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }
});

for (const vp of viewports) {
  test.describe(`Viewport ${vp.name} (${vp.width}x${vp.height})`, () => {
    test.use({ viewport: { width: vp.width, height: vp.height } });

    for (const pageItem of pagesToTest) {
      test(`${pageItem.name} visual and layout checks`, async ({ page, context }) => {
        if (!pageItem.unauth) {
          await context.addCookies([createAuthCookie()]);
        }

        await page.goto(pageItem.path, { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(500);

        // 1. Check for horizontal overflow
        const overflow = await page.evaluate(() => {
          const docEl = document.documentElement;
          const body = document.body;
          const scrollWidth = Math.max(docEl.scrollWidth, body.scrollWidth);
          const clientWidth = docEl.clientWidth;
          return {
            scrollWidth,
            clientWidth,
            hasOverflow: scrollWidth > clientWidth + 1,
          };
        });
        expect(overflow.hasOverflow, `Page ${pageItem.name} has horizontal overflow: scrollWidth=${overflow.scrollWidth}, clientWidth=${overflow.clientWidth}`).toBe(false);

        // 2. Check for box-shadow on visible elements
        const shadowViolations = await page.evaluate(() => {
          const elements = Array.from(document.querySelectorAll('*'));
          const violations: string[] = [];
          for (const el of elements) {
            const style = window.getComputedStyle(el);
            if (style.boxShadow && style.boxShadow !== 'none') {
              violations.push(`${el.tagName.toLowerCase()}.${el.className} has box-shadow: ${style.boxShadow}`);
            }
          }
          return violations;
        });
        expect(shadowViolations.length, `Box shadow found on ${pageItem.name}: ${shadowViolations.slice(0, 3).join(', ')}`).toBe(0);

        // 3. Check for border-radius on visible elements
        const radiusViolations = await page.evaluate(() => {
          const elements = Array.from(document.querySelectorAll('*'));
          const violations: string[] = [];
          for (const el of elements) {
            const style = window.getComputedStyle(el);
            const r = parseFloat(style.borderRadius);
            if (r > 0) {
              violations.push(`${el.tagName.toLowerCase()}.${el.className} has border-radius: ${style.borderRadius}`);
            }
          }
          return violations;
        });
        expect(radiusViolations.length, `Border radius found on ${pageItem.name}: ${radiusViolations.slice(0, 3).join(', ')}`).toBe(0);

        // 4. Check for emoji and em-dash
        const textContent = await page.evaluate(() => document.body.innerText || '');
        const emojiRegex = /[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
        expect(emojiRegex.test(textContent), `Emoji found on ${pageItem.name}`).toBe(false);
        expect(textContent.includes('—'), `Em dash (—) found on ${pageItem.name}`).toBe(false);

        // Capture screenshot
        const screenshotPath = path.join(screenshotsDir, `${pageItem.name}_${vp.width}x${vp.height}.png`);
        await page.screenshot({ path: screenshotPath, fullPage: true });
      });
    }
  });
}
