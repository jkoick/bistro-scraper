#!/usr/bin/env node

import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { Logger } from "./logger.js";
import { Config } from "./config.js";

export class ScreenshotScraper {
  constructor(config = {}) {
    this.logger = new Logger();
    this.config = config;
    this.siteConfig = new Config();
    this.browser = null;
    this.page = null;
    this.screenshotDir = config.screenshotPath || "./screenshots";
  }

  async initialize() {
    try {
      this.logger.info("Initializing screenshot-based scraper...");

      if (!fs.existsSync(this.screenshotDir)) {
        fs.mkdirSync(this.screenshotDir, { recursive: true });
      }

      this.browser = await chromium.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-dev-shm-usage",
          "--disable-blink-features=AutomationControlled",
          "--disable-web-security",
          "--disable-features=VizDisplayCompositor",
        ],
      });

      // Create new context with user agent and larger viewport for better stealth and visibility
      const context = await this.browser.newContext({
        userAgent:
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        viewport: { width: 1280, height: 1024 }, // Increased height for better menu visibility
      });

      this.page = await context.newPage();

      // Add stealth measures
      await this.page.addInitScript(() => {
        Object.defineProperty(navigator, "webdriver", {
          get: () => undefined,
        });

        // Remove automation indicators
        delete window.chrome.runtime.onConnect;
        delete window.chrome.runtime.onMessage;
      });

      this.logger.info("Screenshot scraper initialized successfully");
      return true;
    } catch (error) {
      this.logger.error("Failed to initialize screenshot scraper:", error);
      return false;
    }
  }

  async scrapeRestaurant(site) {
    try {
      this.bestDailyMenuViewport = null;

      this.logger.info(`Starting screenshot-based scraping for: ${site.name}`);

      await this.page.goto(site.url, {
        waitUntil: "domcontentloaded",
        timeout: this.config.timeout || 60000,
      });

      const isCloudflareProtected = await this.handleCloudflareProtection();
      if (isCloudflareProtected) {
        this.logger.info(
          "Cloudflare protection detected, waiting for verification..."
        );
        await this.page.waitForTimeout(15000);

        try {
          await this.page.goto(site.url, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
          });
        } catch (error) {
          this.logger.warn(
            "Failed to navigate after Cloudflare verification, proceeding..."
          );
        }
      }

      try {
        await this.page.waitForTimeout(3000);

        const cookieSelectors = [
          'button:has-text("Súhlasím")',
          'button:has-text("Prijať všetky")',
          'button:has-text("Prijať")',
          'button:has-text("Accept all")',
          'button:has-text("Accept")',
          'button:has-text("Akceptovať")',
          'button:has-text("OK")',
          '[id*="cookie"] button:first-of-type',
          '[class*="cookie"] button:first-of-type',
          '[data-testid*="cookie"] button',
          '[class*="consent"] button:first-of-type',
          'button[class*="accept"]',
          'button[id*="accept"]',
        ];

        let cookieAccepted = false;
        for (const selector of cookieSelectors) {
          try {
            const cookieButton = await this.page.locator(selector).first();
            if (await cookieButton.isVisible({ timeout: 2000 })) {
              await cookieButton.click();
              this.logger.info(
                `Cookie banner accepted using selector: ${selector}`
              );
              await this.page.waitForTimeout(3000);
              cookieAccepted = true;
              break;
            }
          } catch (e) {}
        }

        if (!cookieAccepted) {
          try {
            const dialogButtons = await this.page
              .locator(
                '[role="dialog"] button, .modal button, [class*="popup"] button'
              )
              .all();
            if (dialogButtons.length > 0) {
              await dialogButtons[0].click();
              this.logger.info("Cookie banner accepted via dialog button");
              await this.page.waitForTimeout(3000);
              cookieAccepted = true;
            }
          } catch (e) {}
        }

        if (!cookieAccepted) {
          this.logger.info("No cookie banner found or already accepted");
        }
      } catch (error) {
        this.logger.warn("Cookie handling failed:", error.message);
      }

      if (site.customScript) {
        try {
          this.logger.info(`Executing custom script for ${site.name}`);
          await eval(`(async () => { ${site.customScript} })()`);
        } catch (error) {
          this.logger.warn("Custom script failed:", error.message);
        }
      }

      if (site.waitForSelector) {
        await this.page.waitForSelector(site.waitForSelector, {
          timeout: 10000,
        });
      }

      if (true) {
        try {
          await this.page.evaluate(() => {
            return new Promise((resolve) => {
              let totalHeight = 0;
              const distance = 100;
              const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight) {
                  clearInterval(timer);
                  window.scrollTo(0, 0);
                  resolve();
                }
              }, 100);
            });
          });

          await this.page.waitForTimeout(2000);
          this.logger.info("Scrolled to load all daily menu items");
        } catch (error) {
          this.logger.warn("Scrolling failed:", error.message);
        }
      }

      const timestamp = new Date()
        .toISOString()
        .replace(/:/g, "-")
        .split(".")[0];
      const screenshots = [];
      let allDailyMenuItems = [];

      if (true) {
        this.logger.info("Taking progressive screenshots for lazy loading...");

        const viewportHeight = await this.page.evaluate(
          () => window.innerHeight
        );
        const totalHeight = await this.page.evaluate(
          () => document.body.scrollHeight
        );
        const scrollSteps = Math.ceil(totalHeight / viewportHeight);

        this.logger.info(
          `Page height: ${totalHeight}px, Viewport: ${viewportHeight}px, Steps: ${scrollSteps}`
        );

        await this.page.evaluate(() => window.scrollTo(0, 0));
        await this.page.waitForTimeout(2000);

        for (let step = 0; step < Math.min(scrollSteps, 3); step++) {
          const scrollY = step * viewportHeight;

          await this.page.evaluate((y) => window.scrollTo(0, y), scrollY);
          await this.page.waitForTimeout(2000);

          const stepScreenshotPath = path.join(
            this.screenshotDir,
            `${site.name}-${timestamp}-step${step + 1}.png`
          );
          await this.page.screenshot({
            path: stepScreenshotPath,
            type: "png",
          });

          screenshots.push(stepScreenshotPath);
          this.logger.info(
            `Screenshot ${step + 1}/${Math.min(scrollSteps, 3)} saved: step${
              step + 1
            }.png`
          );

          const dailyMenuInfo = await this.page.evaluate((currentStep) => {
            const dailyMenuSection = [
              ...document.querySelectorAll(
                'section, div, article, main, [role="region"]'
              ),
            ].find((el) => {
              if (!el.textContent) return false;

              const text = el.textContent.toLowerCase();

              const excludePatterns = [
                "obľúbené",
                "oblubene",
                "populárne",
                "popular",
                "favorites",
                "burger central",
                "domáca slovenská klasika",
                "hlavné jedlá",
              ];

              if (excludePatterns.some((pattern) => text.includes(pattern))) {
                return false;
              }

              const dailyMenuPatterns = [
                /denné menu (pondelok|utorok|streda|štvrtok|piatok|sobota|nedeľa)/i,
                /daily menu (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
                /denne menu (pondelok|utorok|streda|štvrtok|piatok|sobota|nedeľa)/i,
              ];

              return (
                dailyMenuPatterns.some((pattern) => pattern.test(text)) ||
                (text.includes("denné menu") &&
                  text.includes("položiek") &&
                  !excludePatterns.some((pattern) => text.includes(pattern)))
              );
            });

            if (dailyMenuSection) {
              const rect = dailyMenuSection.getBoundingClientRect();
              const isVisible = rect.top >= 0 && rect.top <= window.innerHeight;

              if (isVisible) {
                const menuItems = dailyMenuSection.querySelectorAll("li");
                const visibleItems = [...menuItems].filter((item) => {
                  const itemRect = item.getBoundingClientRect();
                  const itemText = item.textContent?.trim() || "";
                  return (
                    itemRect.top >= 0 &&
                    itemRect.top <= window.innerHeight &&
                    itemText.includes("€") &&
                    itemText.length > 20
                  );
                });

                return {
                  visible: true,
                  totalItems: menuItems.length,
                  visibleItems: visibleItems.length,
                  sampleText: dailyMenuSection.textContent.substring(0, 200),
                  stepNumber: currentStep,
                };
              }
            }

            return {
              visible: false,
              totalItems: 0,
              visibleItems: 0,
              stepNumber: currentStep,
            };
          }, step + 1);

          if (dailyMenuInfo.visible) {
            this.logger.info(
              `Daily menu found in viewport ${step + 1}: ${
                dailyMenuInfo.visibleItems
              }/${dailyMenuInfo.totalItems} items visible`
            );

            if (
              !this.bestDailyMenuViewport ||
              dailyMenuInfo.visibleItems >
                this.bestDailyMenuViewport.visibleItems
            ) {
              this.bestDailyMenuViewport = {
                ...dailyMenuInfo,
                scrollY: scrollY,
                stepNumber: step + 1,
              };
            }
          }

          const viewportItems = await this.extractItemsFromCurrentViewport(
            site.name,
            step + 1
          );
          if (viewportItems.length > 0) {
            allDailyMenuItems.push(...viewportItems);
            this.logger.info(
              `Extracted ${viewportItems.length} items from viewport ${
                step + 1
              }`
            );
          } else {
            this.logger.info(`No items found in viewport ${step + 1}`);
          }
        }

        await this.page.evaluate(() => window.scrollTo(0, 0));
        await this.page.waitForTimeout(2000);
      }

      const mainScreenshotPath = path.join(
        this.screenshotDir,
        `${site.name}-${timestamp}.png`
      );
      await this.page.screenshot({
        path: mainScreenshotPath,
        fullPage: true,
        type: "png",
      });
      screenshots.push(mainScreenshotPath);

      const screenshotPath = mainScreenshotPath;
      this.logger.info(`Screenshots saved: ${screenshots.length} images`);

      let menuData =
        allDailyMenuItems.length > 0
          ? allDailyMenuItems
          : await this.extractMenuFromScreenshot(
              screenshotPath,
              site,
              this.bestDailyMenuViewport
            );

      this.logger.info(`Final menu data: ${menuData.length} items collected`);

      return {
        success: true,
        restaurant: site.name,
        url: site.url,
        scrapedAt: new Date().toISOString(),
        screenshotPath,
        menuData,
        itemCount: menuData.length,
      };
    } catch (error) {
      this.logger.error(`Screenshot scraping failed for ${site.name}:`, error);
      return {
        success: false,
        restaurant: site.name,
        error: error.message,
      };
    }
  }

  async extractItemsFromCurrentViewport(siteName, viewportNumber) {
    return await this.page.evaluate(
      ({ siteName, viewportNumber }) => {
        const extractedItems = [];

        const dailyMenuSelectors = [
          ...["section", "div", "article", "main", '[role="region"]'].map(
            (tag) => {
              const elements = [...document.querySelectorAll(tag)];
              return elements.find((el) => {
                if (!el.textContent) return false;

                const text = el.textContent.toLowerCase();

                const excludePatterns = [
                  "obľúbené",
                  "oblubene",
                  "populárne",
                  "popular",
                  "favorites",
                  "burger central",
                  "domáca slovenská klasika",
                  "hlavné jedlá",
                ];

                if (excludePatterns.some((pattern) => text.includes(pattern))) {
                  return false;
                }

                const dailyMenuPatterns = [
                  /denné menu (pondelok|utorak|streda|štvrtok|piatok|sobota|nedeľa)/i,
                  /daily menu (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
                  /denne menu (pondelok|utorok|streda|štvrtok|piatok|sobota|nedeľa)/i,
                ];

                return (
                  dailyMenuPatterns.some((pattern) => pattern.test(text)) ||
                  (text.includes("denné menu") &&
                    text.includes("položiek") &&
                    !excludePatterns.some((pattern) => text.includes(pattern)))
                );
              });
            }
          ),
        ].filter(Boolean);

        let dailyMenuSection = null;
        for (const selector of dailyMenuSelectors) {
          if (typeof selector === "string") {
            dailyMenuSection = document.querySelector(selector);
          } else {
            dailyMenuSection = selector;
          }
          if (dailyMenuSection) break;
        }

        if (dailyMenuSection) {
          const menuItems = dailyMenuSection.querySelectorAll("li");

          const visibleItems = [...menuItems].filter((item) => {
            const rect = item.getBoundingClientRect();
            return (
              rect.top >= 0 &&
              rect.top <= window.innerHeight &&
              rect.height > 10
            );
          });

          visibleItems.forEach((item, index) => {
            try {
              const itemText = item.textContent?.trim() || "";

              if (
                itemText.length < 15 ||
                itemText.includes("Denné menu") ||
                itemText.includes("položiek") ||
                itemText.includes("Zobraz viac") ||
                !itemText.includes("€")
              ) {
                return;
              }

              if (itemText.includes("€")) {
                let cleanText = itemText.replace(/\s+/g, " ").trim();

                const priceMatch = cleanText.match(/(\d+,\d+\s*€)/);
                if (!priceMatch) {
                  return;
                }

                const firstPriceIndex = cleanText.indexOf(priceMatch[0]);
                let name = cleanText.substring(0, firstPriceIndex).trim();

                name = name.replace(
                  /^(Samostatná polievka:\s*|Polievka [0-9]:\s*|Menu [0-9]:\s*)/i,
                  ""
                );
                name = name.replace(/od$/, "");
                name = name.replace(/[,.]od$/, "");
                name = name.replace(/\.od$/, "");
                name = name.replace(/[,.]$/, "");
                name = name.trim();

                const pricePattern = /(od\s+)?(\d+,\d+)\s*€/;
                const priceMatch2 = cleanText.match(pricePattern);
                const price = priceMatch2
                  ? priceMatch2[1]
                    ? `od ${priceMatch2[2]} €`
                    : `${priceMatch2[2]} €`
                  : "N/A";

                let description = cleanText.substring(
                  firstPriceIndex + priceMatch[0].length
                );
                description = description.replace(/popis jedla.*$/i, "");
                description = description.replace(/\d+,\d+\s*€.*$/g, "");
                description = description.replace(/\d+,\d+kg.*$/g, "");
                description = description.replace(/\d+,\d+l.*$/g, "");
                description = description.trim() || "Daily menu item";

                if (name && name.length > 3 && !name.includes("€")) {
                  extractedItems.push({
                    name: name,
                    price: price,
                    category:
                      dailyMenuSection.textContent.match(
                        /(Denné menu [a-záčďéíĺľňóôŕšťúýž]+|Daily menu|Menu dňa)/i
                      )?.[0] || "Daily Menu",
                    description: description,
                    screenshot: true,
                    source: "daily-menu-section",
                    viewport: viewportNumber,
                  });
                }
              }
            } catch (e) {}
          });
        }

        return extractedItems;
      },
      { siteName, viewportNumber }
    );
  }

  async extractMenuFromScreenshot(screenshotPath, site, bestViewport = null) {
    try {
      const menuItems = [];

      if (bestViewport && site.name === "Central Pub") {
        this.logger.info(
          `Scrolling to best daily menu viewport: step ${bestViewport.stepNumber} with ${bestViewport.visibleItems} items`
        );
        await this.page.evaluate(
          (y) => window.scrollTo(0, y),
          bestViewport.scrollY
        );
        await this.page.waitForTimeout(2000);
      }

      const items = await this.page.evaluate(
        ({ siteName, viewport }) => {
          const extractedItems = [];

          if (!window.lastConsoleMessages) {
            window.lastConsoleMessages = [];
          }
          const originalLog = console.log;
          console.log = function (...args) {
            window.lastConsoleMessages.push(args.join(" "));
            originalLog.apply(console, args);
          };

          if (true) {
            console.log("Looking for daily menu in", siteName, "...");

            const dailyMenuSelectors = [
              ...["section", "div", "article", "main", '[role="region"]'].map(
                (tag) => {
                  const elements = [...document.querySelectorAll(tag)];
                  return elements.find((el) => {
                    if (!el.textContent) return false;

                    const text = el.textContent.toLowerCase();

                    const excludePatterns = [
                      "obľúbené",
                      "oblubene",
                      "populárne",
                      "popular",
                      "favorites",
                      "burger central",
                      "domáca slovenská klasika",
                      "hlavné jedlá",
                    ];

                    if (
                      excludePatterns.some((pattern) => text.includes(pattern))
                    ) {
                      return false;
                    }

                    const dailyMenuPatterns = [
                      /denné menu (pondelok|utorok|streda|štvrtok|piatok|sobota|nedeľa)/i,
                      /daily menu (monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i,
                      /denne menu (pondelok|utorok|streda|štvrtok|piatok|sobota|nedeľa)/i,
                    ];

                    return (
                      dailyMenuPatterns.some((pattern) => pattern.test(text)) ||
                      (text.includes("denné menu") &&
                        text.includes("položiek") &&
                        !excludePatterns.some((pattern) =>
                          text.includes(pattern)
                        ))
                    );
                  });
                }
              ),
            ].filter(Boolean);

            let dailyMenuSection = null;
            for (const selector of dailyMenuSelectors) {
              if (typeof selector === "string") {
                dailyMenuSection = document.querySelector(selector);
              } else {
                dailyMenuSection = selector;
              }
              if (dailyMenuSection) break;
            }

            if (dailyMenuSection) {
              console.log(
                "Found daily menu section:",
                dailyMenuSection.className || dailyMenuSection.tagName
              );
              console.log(
                "Section text preview:",
                dailyMenuSection.textContent.substring(0, 150)
              );

              const menuItems = dailyMenuSection.querySelectorAll("li");
              console.log(
                "Found",
                menuItems.length,
                "daily menu items in section"
              );

              const visibleItems = [...menuItems].filter((item) => {
                const rect = item.getBoundingClientRect();
                return (
                  rect.top >= 0 &&
                  rect.top <= window.innerHeight &&
                  rect.height > 10
                );
              });

              console.log("Visible daily menu items:", visibleItems.length);

              visibleItems.forEach((item, index) => {
                try {
                  const itemText = item.textContent?.trim() || "";
                  console.log(
                    `Processing visible item ${index + 1}:`,
                    itemText.substring(0, 80)
                  );

                  if (
                    itemText.length < 5 ||
                    itemText.includes("Denné menu") ||
                    itemText.includes("položiek") ||
                    itemText.includes("Zobraz viac") ||
                    !itemText.includes("€")
                  ) {
                    console.log("  -> Skipping (header/short/no price)");
                    return;
                  }

                  if (itemText.includes("€")) {
                    console.log("  -> Processing item with price");

                    let cleanText = itemText.replace(/\s+/g, " ").trim();
                    console.log("  -> Cleaned text:", cleanText);

                    const priceMatch = cleanText.match(/(\d+,\d+\s*€)/);
                    if (!priceMatch) {
                      console.log("  -> No price pattern found");
                      return;
                    }

                    const firstPriceIndex = cleanText.indexOf(priceMatch[0]);
                    let name = cleanText.substring(0, firstPriceIndex).trim();

                    name = name.replace(
                      /^(Samostatná polievka:\s*|Polievka [0-9]:\s*|Menu [0-9]:\s*)/i,
                      ""
                    );
                    name = name.replace(/od$/, "");
                    name = name.replace(/[,.]od$/, "");
                    name = name.replace(/\.od$/, "");
                    name = name.replace(/[,.]$/, "");
                    name = name.trim();

                    const pricePattern = /(od\s+)?(\d+,\d+)\s*€/;
                    const priceMatch2 = cleanText.match(pricePattern);
                    const price = priceMatch2
                      ? priceMatch2[1]
                        ? `od ${priceMatch2[2]} €`
                        : `${priceMatch2[2]} €`
                      : "N/A";

                    let description = cleanText.substring(
                      firstPriceIndex + priceMatch[0].length
                    );
                    description = description.replace(/popis jedla.*$/i, "");
                    description = description.replace(/\d+,\d+\s*€.*$/g, "");
                    description = description.replace(/\d+,\d+kg.*$/g, "");
                    description = description.replace(/\d+,\d+l.*$/g, "");
                    description = description.trim() || "Denne menu item";

                    if (name && name.length > 3 && !name.includes("€")) {
                      console.log(
                        "✓ Extracted daily menu item:",
                        name,
                        "|",
                        price
                      );
                      extractedItems.push({
                        name: name,
                        price: price,
                        category:
                          dailyMenuSection.textContent.match(
                            /(Denné menu [a-záčďéíĺľňóôŕšťúýž]+|Daily menu|Menu dňa)/i
                          )?.[0] || "Daily Menu",
                        description: description,
                        screenshot: true,
                        source: "daily-menu-section",
                        viewport: viewport ? viewport.stepNumber : "unknown",
                      });
                    } else {
                      console.log(
                        "  -> Rejected item - name too short or contains €:",
                        name
                      );
                    }
                  }
                } catch (e) {
                  console.log("Error processing daily menu item:", e);
                }
              });

              console.log(
                "Daily menu extraction complete. Found",
                extractedItems.length,
                "items"
              );
            } else {
              console.log(
                "Daily menu section not found, searching for alternative patterns..."
              );

              const allElements = document.querySelectorAll("*");
              for (const element of allElements) {
                if (
                  element.textContent &&
                  element.textContent.includes("Denné menu streda")
                ) {
                  console.log(
                    "Found alternative daily menu container:",
                    element.tagName,
                    element.className
                  );
                  break;
                }
              }
            }
          }

          if (extractedItems.length === 0) {
            console.log(
              'No daily menu section found - returning empty results to show "No daily menu available" message'
            );
          }

          return extractedItems;
        },
        { siteName: site.name, viewport: bestViewport }
      );

      const logs = await this.page.evaluate(() => {
        return window.lastConsoleMessages || [];
      });

      if (logs.length > 0) {
        this.logger.info("Browser console logs:");
        logs.forEach((log) => this.logger.info("  " + log));
      }

      this.logger.info(
        `Extracted ${items.length} menu items from DOM (${
          items[0]?.source || "unknown source"
        })`
      );

      if (site.name === "Central Pub" && items.length > 0) {
        this.logger.info("Central Pub items extracted:");
        items.forEach((item, index) => {
          this.logger.info(
            `  ${index + 1}. ${item.name} (${item.category}) - ${item.price} [${
              item.source
            }]`
          );
        });
      }

      return items;
    } catch (error) {
      this.logger.error("Failed to extract menu from screenshot:", error);
      return [
        {
          name: "Screenshot Analysis Required",
          price: "N/A",
          category: "Manual Review",
          description: `Screenshot saved at ${screenshotPath} - requires manual or AI analysis`,
          screenshot: true,
        },
      ];
    }
  }

  async close() {
    try {
      if (this.page) {
        await this.page.close();
      }
      if (this.browser) {
        await this.browser.close();
      }
      this.logger.info("Screenshot scraper closed successfully");
    } catch (error) {
      this.logger.error("Error closing screenshot scraper:", error);
    }
  }

  async handleCloudflareProtection() {
    try {
      const cloudflareDetected = await this.page.evaluate(() => {
        const title = document.title?.toLowerCase() || "";
        const bodyText = document.body?.textContent?.toLowerCase() || "";

        const indicators = [
          "verifying you are human",
          "checking your browser",
          "cloudflare",
          "please wait while we check your browser",
          "this may take a few seconds",
        ];

        return indicators.some(
          (indicator) =>
            title.includes(indicator) || bodyText.includes(indicator)
        );
      });

      if (cloudflareDetected) {
        await this.page.waitForTimeout(5000);

        const stillProtected = await this.page.evaluate(() => {
          const bodyText = document.body?.textContent?.toLowerCase() || "";
          return (
            bodyText.includes("verifying you are human") ||
            bodyText.includes("checking your browser")
          );
        });

        return stillProtected;
      }

      return false;
    } catch (error) {
      this.logger.warn(
        "Error checking for Cloudflare protection:",
        error.message
      );
      return false;
    }
  }

  async analyzeScreenshotWithAI(screenshotPath) {
    const prompt = `
    Analyze this restaurant menu screenshot and extract all menu items in JSON format.
    For each item, provide:
    - name: the dish name
    - price: the price (keep original format)  
    - category: the menu section/category
    - description: any description text (if visible)
    
    Return as an array of objects.
    `;

    return {
      menuItems: [],
      message:
        "AI analysis not implemented yet - screenshot saved for manual review",
    };
  }

  async scrapeAllSites() {
    const sites = this.siteConfig.getEnabledSites();
    if (sites.length === 0) {
      this.logger.warn("No enabled sites found in configuration");
      return [];
    }

    this.logger.info(
      `Starting to scrape ${sites.length} enabled sites using screenshot-based scraper`
    );
    const results = [];

    for (const site of sites) {
      try {
        this.logger.info(`Scraping site: ${site.name}`);
        const siteData = await this.scrapeRestaurant(site);

        const formattedResult = {
          name: site.name,
          url: site.url,
          success: siteData.success,
          scrapedAt: siteData.scrapedAt,
          itemCount: siteData.itemCount,
          menuData: {
            items: siteData.menuData,
            totalCount: siteData.itemCount,
          },
          screenshotPath: siteData.screenshotPath,
        };

        if (!siteData.success) {
          formattedResult.error = siteData.error;
        }

        results.push(formattedResult);
        this.logger.info(
          `Successfully scraped ${site.name}: ${siteData.itemCount} items`
        );
      } catch (error) {
        this.logger.error(`Failed to scrape ${site.name}:`, error);
        results.push({
          name: site.name,
          url: site.url,
          error: error.message,
          success: false,
          scrapedAt: new Date().toISOString(),
          itemCount: 0,
          menuData: {
            items: [],
            totalCount: 0,
          },
        });
      }
    }

    return results;
  }
}

export default ScreenshotScraper;
