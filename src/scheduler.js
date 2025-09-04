import cron from "node-cron";
import { Config } from "./config.js";
import { Logger } from "./logger.js";
import { ScreenshotScraper } from "./screenshot-scraper.js";
import { MenuFormatter } from "./formatter.js";
import { DiscordNotifier } from "./discord.js";

export class MenuScraperScheduler {
  constructor() {
    this.config = new Config();
    this.logger = new Logger();
    this.scraper = null;
    this.formatter = new MenuFormatter();
    this.discordNotifier = new DiscordNotifier(this.config.discordWebhookUrl);
    this.isRunning = false;
    this.scheduledTask = null;
  }

  async initialize() {
    try {
      this.logger.info("Initializing Menu Scraper Scheduler...");

      this.discordNotifier.validateWebhookUrl();
      this.logger.info("Discord webhook URL validated");

      this.scraper = new ScreenshotScraper({
        screenshotPath: "./screenshots",
        timeout: 60000,
      });
      await this.scraper.initialize();

      this.logger.info("Scheduler initialized successfully");
      return true;
    } catch (error) {
      this.logger.error("Failed to initialize scheduler:", error);
      throw error;
    }
  }

  start() {
    if (this.isRunning) {
      this.logger.warn("Scheduler is already running");
      return;
    }

    const cronExpression = this.config.scrapeSchedule;
    this.logger.info(
      `Starting scheduler with cron expression: ${cronExpression}`
    );

    if (!cron.validate(cronExpression)) {
      throw new Error(`Invalid cron expression: ${cronExpression}`);
    }

    this.scheduledTask = cron.schedule(
      cronExpression,
      async () => {
        await this.runScrapingJob();
      },
      {
        scheduled: false,
        timezone: "Europe/Bratislava",
      }
    );

    this.scheduledTask.start();
    this.isRunning = true;

    this.logger.info("Scheduler started successfully");

    const nextRun = this.getNextScheduledRun(cronExpression);
    this.logger.info(`Next scheduled run: ${nextRun}`);
  }

  stop() {
    if (this.scheduledTask) {
      this.scheduledTask.stop();
      this.scheduledTask = null;
    }
    this.isRunning = false;
    this.logger.info("Scheduler stopped");
  }

  async runScrapingJob() {
    if (this.isJobRunning) {
      this.logger.warn(
        "Scraping job is already running, skipping this execution"
      );
      return;
    }

    this.isJobRunning = true;
    this.logger.info("Starting scheduled scraping job");

    try {
      const results = await this.scraper.scrapeAllSites();

      if (results.length === 0) {
        this.logger.warn("No sites were scraped (none enabled?)");
        return;
      }

      const sessionSummary = this.logger.logScrapingSession(results);

      const messages = this.formatter.formatForDiscord(results);
      const screenshotPath =
        this.config.sitesConfig.globalSettings.screenshotPath ||
        "./screenshots";
      await this.discordNotifier.sendMenuUpdates(messages, screenshotPath);

      this.logger.info(
        `Scraping job completed successfully: ${this.formatter.formatLogSummary(
          results
        )}`
      );

      await this.logger.cleanupOldLogs();
    } catch (error) {
      this.logger.error("Scraping job failed:", error);
      await this.discordNotifier.sendErrorNotification(
        error,
        "Scheduled scraping job"
      );
    } finally {
      this.isJobRunning = false;
    }
  }

  async runOnce() {
    this.logger.info("Running one-time scraping job");
    await this.runScrapingJob();
  }

  async testWebhook() {
    this.logger.info("Testing Discord webhook");
    const success = await this.discordNotifier.sendTestMessage();
    return success;
  }

  getNextScheduledRun(cronExpression) {
    try {
      const task = cron.schedule(cronExpression, () => {}, {
        scheduled: false,
      });
      const nextDates = task.nextDates(1);
      return nextDates[0].toLocaleString();
    } catch (error) {
      return "Unable to calculate next run time";
    }
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      isJobRunning: this.isJobRunning || false,
      schedule: this.config.scrapeSchedule,
      enabledSites: this.config.getEnabledSites().map((site) => site.name),
      nextRun: this.isRunning
        ? this.getNextScheduledRun(this.config.scrapeSchedule)
        : null,
    };
  }

  async shutdown() {
    this.logger.info("Shutting down scheduler...");

    this.stop();

    if (this.scraper) {
      await this.scraper.close();
    }

    this.logger.info("Scheduler shutdown complete");
  }
}

process.on("SIGINT", async () => {
  console.log("\nReceived SIGINT, shutting down gracefully...");
  if (global.schedulerInstance) {
    await global.schedulerInstance.shutdown();
  }
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\nReceived SIGTERM, shutting down gracefully...");
  if (global.schedulerInstance) {
    await global.schedulerInstance.shutdown();
  }
  process.exit(0);
});
