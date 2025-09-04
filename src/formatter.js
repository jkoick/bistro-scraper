import { Config } from './config.js';

export class MenuFormatter {
  constructor() {
    this.maxMessageLength = 2000;
    this.config = new Config();
    this.formattingConfig = this.config.getFormattingConfig();
  }

  formatForDiscord(scrapingResults) {
    const messages = [];

    const successfulSites = scrapingResults.filter((result) => result.success);
    const failedSites = scrapingResults.filter((result) => !result.success);

    for (const siteResult of successfulSites) {
      const siteMessages = this.formatSiteMenu(siteResult);
      messages.push(...siteMessages);
    }

    if (failedSites.length > 0) {
      const errorMessage = this.formatErrorSummary(failedSites);
      messages.push(errorMessage);
    }

    if (successfulSites.length === 0 && failedSites.length > 0) {
      messages.push({
        embeds: [
          {
            title: "❌ No Menus Available",
            description:
              "All sites failed to load. Please check the logs for more details.",
            color: 0xff0000,
            timestamp: new Date().toISOString(),
          },
        ],
      });
    }

    return messages;
  }

  formatSiteMenu(siteResult) {
    const messages = [];
    const { name, url, menuData } = siteResult;

    if (!menuData || menuData.items.length === 0) {
      messages.push({
        embeds: [
          {
            title: `🟠 ${name} - daily menu`,
            description: "No daily menu available today",
            url: url,
            color: 0xff9500, // Orange color for no menu available
            timestamp: new Date().toISOString(),
          },
        ],
      });
      return messages;
    }

    const restaurantEmoji = this.getRestaurantEmoji(name);
    const embed = {
      // Title includes "- daily menu" and keeps the URL for clickability
      title: `${restaurantEmoji} ${name} - daily menu`,
      url: url,
      // Keep ONLY the item count in the description
      description: `${menuData.items.length} items available`,
      color: this.getRestaurantColor(name),
      timestamp: new Date().toISOString(),
      fields: [],
      footer: {
        text: `Updated at ${new Date().toLocaleTimeString()}`,
      },
    };

    // Do NOT replace description with categories anymore

    const groupedItems = this.groupItemsByCategory(
      menuData.items,
      menuData.categories
    );

    let currentFieldLength = 0;

    for (const [category, items] of Object.entries(groupedItems)) {
      // Hide the old "🍽️ Daily Menu" header by using a zero-width space
      const categoryTitle = category === "uncategorized" ? "\u200b" : category;

      const itemsText = items.map((item) => this.formatMenuItem(item)).join("");

      const fieldData = {
        name: categoryTitle,
        value: itemsText || "No items available",
        inline: false,
      };

      if (
        currentFieldLength + fieldData.value.length >
        this.maxMessageLength - 500
      ) {
        messages.push({ embeds: [embed] });

        embed.fields = [];
        currentFieldLength = 0;
      }

      embed.fields.push(fieldData);
      currentFieldLength += fieldData.value.length;
    }

    if (embed.fields.length > 0) {
      messages.push({ embeds: [embed] });
    }

    return messages;
  }

  formatMenuItem(item) {
    let formatted = `**${item.name}**\n`;

    if (item.price && item.price !== "N/A" && item.price.trim() !== "") {
      formatted += `${item.price}\n\n`;
    } else {
      formatted += `\n`;
    }

    return formatted;
  }

  groupItemsByCategory(items, categories = []) {
    const grouped = { uncategorized: [] };

    categories.forEach((category) => {
      grouped[category] = [];
    });

    items.forEach((item) => {
      let assigned = false;

      for (const category of categories) {
        if (
          item.name.toLowerCase().includes(category.toLowerCase()) ||
          (item.description &&
            item.description.toLowerCase().includes(category.toLowerCase()))
        ) {
          grouped[category].push(item);
          assigned = true;
          break;
        }
      }

      if (!assigned) {
        grouped.uncategorized.push(item);
      }
    });

    Object.keys(grouped).forEach((key) => {
      if (grouped[key].length === 0) {
        delete grouped[key];
      }
    });

    return grouped;
  }

  formatErrorSummary(failedSites) {
    const errorList = failedSites
      .map((site) => `• **${site.name}**: ${site.error}`)
      .join("\n");

    return {
      embeds: [
        {
          title: "🔴 Scraping Errors",
          description: errorList,
          color: 0xff0000, // Red color for scraping errors
          timestamp: new Date().toISOString(),
        },
      ],
    };
  }

  getRestaurantEmoji(name) {
    const emojis = this.formattingConfig.emojis || {
      default: "🏪",
    };
    return emojis[name] || emojis.default;
  }

  getRestaurantColor(name) {
    const colors = this.formattingConfig.colors || {
      default: 0x3498db,
    };
    const colorValue = colors[name] || colors.default;
    return typeof colorValue === 'string' ? parseInt(colorValue, 16) : colorValue;
  }

  formatLogSummary(scrapingResults) {
    const total = scrapingResults.length;
    const successful = scrapingResults.filter((r) => r.success).length;
    const failed = total - successful;
    const totalItems = scrapingResults
      .filter((r) => r.success)
      .reduce((sum, r) => sum + (r.menuData?.items?.length || 0), 0);

    return `Scraping Summary: ${successful}/${total} sites successful, ${totalItems} total menu items found${
      failed > 0 ? `, ${failed} sites failed` : ""
    }`;
  }
}
