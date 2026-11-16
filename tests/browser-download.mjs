import { chromium } from "playwright";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { stat } from "node:fs/promises";

const html = await readFile(new URL("../index.html", import.meta.url));
const server = createServer((req, res) => {
  if (req.url === "/" || req.url === "/index.html") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(html);
  } else {
    res.writeHead(404);
    res.end("Not found");
  }
});
await new Promise(resolve => server.listen(4173, "127.0.0.1", resolve));

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("http://127.0.0.1:4173/", { waitUntil: "domcontentloaded" });

  await page.locator("#message").fill("Tee yksinkertainen 40 mm kuutio. Kaikkien sivujen pitää olla 40 mm.");
  await page.locator("#send").click();
  try {
    await page.waitForFunction(() => {
      const button = document.querySelector("#downloadStl");
      return button && !button.disabled;
    }, null, { timeout: 180000 });
  } catch {
    const status = await page.locator("#modelNotice").textContent().catch(() => "");
    const chat = await page.locator("#chat").innerText().catch(() => "");
    throw new Error("AI-mallia ei saatu ladattavaksi. Tila: " + status + " Keskustelu: " + chat.slice(-1500) + " Selainvirheet: " + errors.join(" | "));
  }

  for (const [format, selector] of [["stl", "#downloadStl"], ["3mf", "#download3mf"]]) {
    let download;
    try {
      const pendingDownload = page.waitForEvent("download", { timeout: 45000 });
      await page.locator(selector).click();
      download = await pendingDownload;
    } catch (error) {
      const status = await page.locator("#modelNotice").textContent().catch(() => "");
      const buttonState = await page.locator(selector).isDisabled().catch(() => true);
      throw new Error(format.toUpperCase() + " failed to download. Page status: " + status + "; button disabled: " + buttonState + "; browser errors: " + errors.join(" | ") + "; reason: " + error.message);
    }
    const path = await download.path();
    if (!path) throw new Error(format.toUpperCase() + " download did not produce a file");
    const file = await stat(path);
    if (file.size < 100) throw new Error(format.toUpperCase() + " file was too small: " + file.size);
    if (!download.suggestedFilename().toLowerCase().endsWith("." + format)) {
      throw new Error("Unexpected filename: " + download.suggestedFilename());
    }
    console.log(format.toUpperCase() + " browser download passed: " + download.suggestedFilename() + " (" + file.size + " bytes)");
  }

  if (errors.length) console.log("Browser console messages: " + errors.join(" | "));
  await context.close();
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
