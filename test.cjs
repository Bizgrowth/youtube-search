const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  // Set viewport to a typical desktop size
  await page.setViewportSize({ width: 1440, height: 900 });

  // Go to the local dev server
  await page.goto('http://localhost:5174/');
  
  // Wait a bit for the page to load
  await page.waitForTimeout(1000);

  // Type in the search query
  await page.fill('#search-query', 'AI Tutorial');
  
  // Select 'Most Viewed' from Secondary Rank
  await page.selectOption('#secondary-sort', 'mostViewed');
  
  // Press Enter to trigger search
  await page.press('#search-query', 'Enter');
  
  // Wait for loader to disappear or for results to show
  // (We'll just wait a static 3 seconds for the API to respond)
  await page.waitForTimeout(3000);
  
  // Take a full page screenshot
  await page.screenshot({ path: 'youtube_search_premium_ui.png', fullPage: true });

  await browser.close();
})();
