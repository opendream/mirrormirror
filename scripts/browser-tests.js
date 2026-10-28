import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
let browser;
try {
  await server.listen();
  const address = server.httpServer.address();
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  await page.goto(`http://127.0.0.1:${address.port}/tests/browser-smoke.html`);
  await page.getByRole('button', { name: 'Run synthetic recording tests' }).click();
  await page.waitForFunction(() => /ALL CHECKS PASSED|FAIL:/.test(document.getElementById('results').textContent), null, { timeout: 90000 });
  const result = await page.locator('#results').innerText();
  console.log(result);
  if (!result.includes('ALL CHECKS PASSED')) {
    await mkdir('test-results', { recursive: true });
    await page.screenshot({ path: 'test-results/browser-failure.png', fullPage: true });
    process.exitCode = 1;
  }
} finally {
  await browser?.close();
  await server.close();
}
