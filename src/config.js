import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import dotenv from "dotenv";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class Config {
  constructor() {
    this.loadSitesConfig();
    this.loadEnvironmentConfig();
  }

  loadSitesConfig() {
    try {
      const configPath = join(__dirname, "../config/sites.json");
      const configData = readFileSync(configPath, "utf8");
      const rawConfig = JSON.parse(configData);

      if (rawConfig.settings && rawConfig.sites[0].cookieScript !== undefined) {
        this.sitesConfig = this.parseCleanConfig(rawConfig);
      } else {
        this.sitesConfig = rawConfig;
      }
    } catch (error) {
      console.error("Error loading sites configuration:", error.message);
      throw new Error("Failed to load sites configuration");
    }
  }

  parseCleanConfig(cleanConfig) {
    return {
      sites: cleanConfig.sites.map((site) => ({
        name: site.name,
        url: site.url,
        enabled: site.enabled,
        customScript: site.cookieScript,
        waitForSelector: 'main, [role="main"]',
        screenshots: true,
        emoji: site.emoji,
        color: site.color,
      })),
      globalSettings: {
        ...cleanConfig.settings,
        screenshotPath: cleanConfig.settings.screenshotPath,
      },
      formatting: {
        emojis: cleanConfig.sites.reduce(
          (acc, site) => {
            acc[site.name] = site.emoji;
            return acc;
          },
          { default: cleanConfig.settings.defaults.emoji }
        ),
        colors: cleanConfig.sites.reduce(
          (acc, site) => {
            acc[site.name] = site.color;
            return acc;
          },
          { default: cleanConfig.settings.defaults.color }
        ),
      },
    };
  }

  loadEnvironmentConfig() {
    this.discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
    this.scrapeSchedule = process.env.SCRAPE_SCHEDULE || "30 11 * * 1-5";
    this.pageTimeout = parseInt(process.env.PAGE_TIMEOUT) || 30000;

    if (!this.discordWebhookUrl) {
      console.error("DISCORD_WEBHOOK_URL is required in .env file");
      throw new Error("Missing Discord webhook URL configuration");
    }
  }

  getEnabledSites() {
    return this.sitesConfig.sites.filter((site) => site.enabled);
  }

  getGlobalSettings() {
    return {
      ...this.sitesConfig.globalSettings,
      timeout: this.pageTimeout,
    };
  }

  getFormattingConfig() {
    return (
      this.sitesConfig.formatting || {
        emojis: {
          default: "🏪",
        },
        colors: {
          default: "0x3498db",
        },
      }
    );
  }
}
