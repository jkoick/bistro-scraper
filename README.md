# Bistro Scraper 🍽️

An automated web scraper that monitors Slovak restaurant websites and sends daily menu updates to Discord via webhook. Uses Playwright for screenshot-based scraping with intelligent daily menu detection.

## Features

- 🕐 **Scheduled Scraping**: Automated runs with cron-based scheduling
- 🖼️ **Screenshot-Based Scraping**: Progressive screenshots with DOM analysis for reliable extraction
- 🎯 **Smart Daily Menu Detection**: Only extracts items from "Denné menu [day]" sections
- 📱 **Discord Integration**: Color-coded status messages with formatted menu updates
- 🔧 **Flexible Configuration**: JSON-based restaurant and global settings
- 📸 **Debug Screenshots**: Visual debugging for failed scrapes
- 🪵 **Comprehensive Logging**: Daily rotated logs with detailed error tracking
- 🔄 **Resilient Error Handling**: Retry logic and graceful degradation
- 🍪 **Cookie Banner Handling**: Custom scripts for site-specific interactions

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

Edit `config/sites.json` to add your restaurants:

```json
{
  "sites": [
    {
      "id": "local-bistro",
      "name": "Local Bistro",
      "url": "https://localbistro.com/menu",
      "enabled": true,
      "cookieScript": "await page.click('.accept-cookies');",
      "emoji": "🍽️",
      "color": "#3498db"
    }
  ],
  "settings": {
    "timeout": 30000,
    "retryAttempts": 3,
    "screenshotPath": "./screenshots",
    "userAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
  }
}
```

### 4. Test Setup

Test your Discord webhook:

```bash
node src/index.js test-webhook
```

Run a one-time scrape:

```bash
npm run scrape
```

Test screenshot scraper:

```bash
npm run test-screenshot
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

# Test screenshot-based scraper
npm run test-screenshot

# Test Discord webhook
node src/index.js test-webhook

# Check configuration status
node src/index.js status

# Show available commands
node src/index.js help
```

### Site Configuration

Each site in `config/sites.json` supports:

- **id**: Unique restaurant identifier
- **name**: Display name for Discord messages
- **url**: Restaurant menu URL to scrape
- **enabled**: Whether to include in scraping runs
- **cookieScript**: JavaScript for cookie banner handling
- **emoji**: Discord message emoji
- **color**: Discord embed color (hex format)

### Global Configuration

Global settings control scraper behavior:

- **timeout**: Page load timeout in milliseconds
- **retryAttempts**: Number of retry attempts for failed sites
- **screenshotPath**: Directory for debug screenshots
- **userAgent**: Browser user agent string

### Daily Menu Detection

The scraper specifically looks for sections containing:

- "Denné menu [day]" patterns in Slovak
- Ignores non-daily sections like "Obľúbené" or "Burger Central"
- Only extracts items from confirmed daily menu sections

### Discord Status Messages

Color-coded status messages:

- 🟠 **Orange**: "No daily menu available today"
- 🔴 **Red**: "Scraping Errors" (site failures)
- ✅ **Normal**: Menu items successfully found

## Environment Variables

```env
# Required
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/...

# Optional
SCRAPE_SCHEDULE=30 11 * * 1-5  # 11:30 AM weekdays
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

- Scraper uses Playwright with stealth configurations
- Adjust `userAgent` in global config if needed
- Add delays in `cookieScript`: `await page.waitForTimeout(3000);`

**No daily menu found:**

- Scraper only detects "Denné menu [day]" sections
- Check if restaurant uses different daily menu patterns
- Review screenshots in `./screenshots/` directory
- Verify site loads correctly in normal browser

**Discord messages not sending:**

- Verify webhook URL format in `.env`
- Test with `node src/index.js test-webhook`
- Check Discord server permissions
- Review logs in `./logs/` directory

### Debugging

Enable debug mode:

```env
DEBUG=true
```

Check daily logs:

```bash
tail -f logs/scraper_$(date +%Y-%m-%d).log
```

Screenshots are automatically saved to `./screenshots/` for failed scrapes.

## Screenshot-Based Scraping 🖼️

The scraper uses a progressive screenshot approach combined with intelligent DOM analysis:

### How It Works

1. **Navigate**: Goes to the restaurant website
2. **Handle Cookies**: Executes site-specific cookie scripts
3. **Progressive Capture**: Takes screenshots while analyzing DOM structure
4. **Smart Detection**: Identifies "Denné menu [day]" sections specifically
5. **Extract**: Pulls menu items only from daily menu sections
6. **Debug**: Saves screenshots for failed scrapes

### Key Benefits

- **Reliable Daily Menu Detection**: Focuses only on current day's offerings
- **Visual Debugging**: Screenshots show exactly what the scraper sees
- **Slovak Restaurant Optimized**: Handles local site patterns and cookie banners
- **Resilient**: Works despite HTML structure changes
- **Selective Extraction**: Ignores popular items, favorites, and permanent menu sections

Test the scraper:

```bash
npm run test-screenshot
```

## File Structure

```
├── src/
│   ├── index.js              # Main entry point and CLI commands
│   ├── scheduler.js          # Cron-based job scheduling
│   ├── screenshot-scraper.js # Primary screenshot-based scraper
│   ├── discord.js            # Discord webhook integration
│   ├── formatter.js          # Discord message formatting with status colors
│   ├── config.js             # Configuration management for sites and globals
│   └── logger.js             # File and console logging with daily rotation
├── config/
│   └── sites.json            # Restaurant configurations and global settings
├── logs/                     # Daily rotated log files
├── screenshots/              # Debug screenshots for failed scrapes
└── .env                      # Environment variables
```

## License

MIT License - feel free to modify and use for your needs!
