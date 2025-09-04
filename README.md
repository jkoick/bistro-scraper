# Bistro Scraper 🍽️

An automated web scraper that monitors local food ordering sites and sends daily menu updates to Discord via webhook. Built with Playwright MCP to bypass bot protection.

## Features

- 🕐 **Scheduled Scraping**: Runs automatically before lunch time (configurable)
- 🤖 **Bot Protection Bypass**: Uses Playwright MCP to handle dynamic content and bot detection
- 📱 **Discord Integration**: Sends formatted menu updates to Discord channels via webhooks
- 🔧 **Flexible Configuration**: Easy JSON-based configuration for multiple sites
- 📸 **Screenshot Support**: Optional screenshot capture for debugging
- 🪵 **Comprehensive Logging**: Detailed logs with automatic cleanup
- 🔄 **Error Handling**: Retry logic and error notifications
- ⚡ **Multiple Run Modes**: Scheduled, one-time, and test modes
- 🖼️ **Screenshot-Based Extraction**: New AI-ready approach using visual analysis instead of fragile CSS selectors

## Quick Start

### 1. Installation

```bash
npm install
```

### 2. Configuration

Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` and set your Discord webhook URL:
```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN
```

### 3. Configure Sites

Edit `config/sites.json` to add your local food ordering sites:

```json
{
  "sites": [
    {
      "name": "Local Bistro",
      "url": "https://localbistro.com/menu",
      "enabled": true,
      "selectors": {
        "menuItems": ".menu-item",
        "itemName": ".item-title",
        "itemPrice": ".price",
        "itemDescription": ".description"
      },
      "waitForSelector": ".menu-container",
      "screenshots": true
    }
  ]
}
```

### 4. Test Setup

Test your Discord webhook:
```bash
npm start test-webhook
```

Run a one-time scrape:
```bash
npm run scrape
```

### 5. Start Scheduled Mode

```bash
npm start
```

## Usage

### Commands

```bash
# Start scheduler (runs continuously)
npm start

# Run scraping once and exit  
npm run scrape

# Test new screenshot-based scraper
npm run test-screenshot

# Test Discord webhook
node src/index.js test-webhook

# Check configuration status
node src/index.js status

# Show help
node src/index.js help
```

### Site Configuration

Each site in `config/sites.json` supports:

- **name**: Display name for the restaurant
- **url**: URL to scrape
- **enabled**: Whether to include in scraping runs
- **selectors**: CSS selectors for menu elements
- **waitForSelector**: Element to wait for before scraping
- **screenshots**: Whether to take screenshots
- **customScript**: Custom JavaScript to run on the page
- **timeout**: Page timeout in milliseconds

### CSS Selectors

Configure these selectors to match the target site:

- `menuItems`: Container for each menu item
- `itemName`: Menu item name/title
- `itemPrice`: Price element
- `itemDescription`: Description text
- `category`: Menu category headers

### Example Site Configurations

**Basic Configuration:**
```json
{
  "name": "Simple Menu Site",
  "url": "https://restaurant.com/menu",
  "enabled": true,
  "selectors": {
    "menuItems": ".menu-item",
    "itemName": "h3",
    "itemPrice": ".price"
  },
  "waitForSelector": ".menu"
}
```

**Advanced Configuration with Custom Script:**
```json
{
  "name": "Protected Site",
  "url": "https://delivery-site.com/daily-menu",
  "enabled": true,
  "selectors": {
    "menuItems": "[data-testid='menu-item']",
    "itemName": ".item-name",
    "itemPrice": ".item-price",
    "itemDescription": ".item-desc"
  },
  "waitForSelector": "[data-testid='menu-loaded']",
  "customScript": "await page.click('.accept-cookies'); await page.waitForTimeout(1000); await page.click('.show-menu');",
  "screenshots": true,
  "timeout": 45000
}
```

## Environment Variables

```env
# Required
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# Optional
SCRAPE_SCHEDULE=30 11 * * 1-5  # 11:30 AM weekdays
PAGE_TIMEOUT=30000             # 30 second timeout
USER_AGENT=Mozilla/5.0...      # Custom user agent
DEBUG=true                     # Enable debug logging
```

## Discord Setup

1. Go to your Discord server settings
2. Navigate to Integrations → Webhooks
3. Create a new webhook
4. Copy the webhook URL to your `.env` file

## Scheduling

Default schedule is 11:30 AM on weekdays (`30 11 * * 1-5`). 

Cron format: `minute hour day month dayOfWeek`
- `0 12 * * *` - Daily at noon
- `30 11 * * 1-5` - 11:30 AM weekdays only
- `0 11,17 * * 1-5` - 11 AM and 5 PM weekdays

## Troubleshooting

### Common Issues

**Sites returning 403/bot detection:**
- Sites are using Playwright which mimics real browsers
- Try adjusting the `userAgent` in config
- Add delays with `customScript`: `await page.waitForTimeout(3000);`
- Enable screenshots to see what the scraper sees

**No menu items found:**
- Check CSS selectors match the site structure
- Use browser dev tools to inspect elements
- Enable screenshots to debug
- Try the site in a real browser first

**Discord messages not sending:**
- Verify webhook URL format
- Test with `npm start test-webhook`
- Check Discord server permissions
- Review logs in `./logs/` directory

### Debugging

Enable debug mode:
```env
DEBUG=true
```

Check logs:
```bash
tail -f logs/scraper_$(date +%Y-%m-%d).log
```

Take screenshots:
```json
{
  "screenshots": true,
  "screenshotPath": "./debug-screenshots"
}
```

## Screenshot-Based Scraping 🖼️

We've introduced a new screenshot-based approach that's more reliable than CSS selectors:

### Why Screenshot-Based?

- **Future-Proof**: Works regardless of HTML structure changes
- **Visual Accuracy**: Captures exactly what users see
- **AI-Ready**: Screenshots can be analyzed by vision models
- **Reduced Maintenance**: No need to update complex selectors when sites change
- **Manual Review**: Screenshots provide visual confirmation of scraping

### Usage

```bash
# Test the screenshot scraper
npm run test-screenshot
```

### How It Works

1. **Navigate**: Goes to the restaurant website
2. **Handle Cookies**: Executes custom scripts (like cookie acceptance)
3. **Wait**: Waits for content to load
4. **Capture**: Takes full-page screenshot
5. **Extract**: Uses DOM parsing as fallback, ready for AI integration
6. **Save**: Stores screenshots for manual review or AI analysis

### AI Integration Ready

The screenshot approach is designed for future integration with:
- OpenAI Vision API
- Google Cloud Vision
- Azure Computer Vision
- Custom ML models

Screenshots are saved in `./screenshots/` directory for analysis.

## File Structure

```
├── src/
│   ├── index.js              # Main entry point
│   ├── scheduler.js          # Scheduling logic
│   ├── scraper.js            # Web scraping with Playwright
│   ├── screenshot-scraper.js # NEW: Screenshot-based scraper
│   ├── formatter.js          # Discord message formatting
│   ├── discord.js            # Discord webhook integration
│   ├── config.js             # Configuration management
│   └── logger.js             # Logging system
├── config/
│   └── sites.json            # Site configurations
├── logs/                     # Generated log files
├── screenshots/              # Generated screenshots
├── test-screenshot-scraper.js # Screenshot scraper test
└── .env                      # Environment variables
```

## License

MIT License - feel free to modify and use for your needs!