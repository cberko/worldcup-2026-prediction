import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.SIM_APP_URL || "http://localhost:3300";
const dir = new URL("./screens/", import.meta.url).pathname;
mkdirSync(dir, { recursive: true });

const browser = await chromium.launch();

async function shoot(name, url, { viewport = { width: 1366, height: 900 }, click, wait = 1200 } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle" }).catch(() => {});
  if (click) {
    await page.getByText(click, { exact: false }).first().click().catch(() => {});
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(wait);
  await page.screenshot({ path: `${dir}${name}.png`, fullPage: true });
  console.log("✓", name);
  await ctx.close();
}

await shoot("01-matchpicks-upcoming", "/");
await shoot("02-matchpicks-all", "/", { click: "All matches" });
await shoot("03-tournament", "/tournament");
await shoot("04-tournament-mobile", "/tournament", { viewport: { width: 390, height: 844 } });
await shoot("05-tournament-leaderboard", "/tournament/leaderboard");
await shoot("06-leaderboard", "/leaderboard");
await shoot("07-results-bracket", "/bracket");

await browser.close();
console.log("screens →", dir);
