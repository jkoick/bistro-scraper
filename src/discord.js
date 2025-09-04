import axios from 'axios';
import { Logger } from './logger.js';
import { readdir, unlink } from 'fs/promises';
import { join } from 'path';

export class DiscordNotifier {
  constructor(webhookUrl) {
    this.webhookUrl = webhookUrl;
    this.logger = new Logger();
    this.rateLimitDelay = 1000; // 1 second between messages
  }

  async sendMenuUpdates(messages, screenshotPath = './screenshots') {
    if (!messages || messages.length === 0) {
      this.logger.warn('No messages to send to Discord');
      return;
    }

    this.logger.info(`Sending ${messages.length} messages to Discord`);
    let allMessagesSent = true;
    
    for (let i = 0; i < messages.length; i++) {
      try {
        await this.sendMessage(messages[i]);
        this.logger.info(`Sent message ${i + 1}/${messages.length} to Discord`);
        
        if (i < messages.length - 1) {
          await this.delay(this.rateLimitDelay);
        }
      } catch (error) {
        allMessagesSent = false;
        this.logger.error(`Failed to send message ${i + 1} to Discord:`, error);
        
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'] || 5;
          this.logger.warn(`Rate limited, waiting ${retryAfter} seconds`);
          await this.delay(retryAfter * 1000);
          i--; // Retry the same message
        }
      }
    }

    if (allMessagesSent) {
      await this.cleanupScreenshots(screenshotPath);
    }
  }

  async sendMessage(messageData) {
    try {
      const response = await axios.post(this.webhookUrl, messageData, {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      if (response.status === 204) {
        return true;
      } else {
        throw new Error(`Unexpected response status: ${response.status}`);
      }
    } catch (error) {
      if (error.response) {
        throw new Error(`Discord API error: ${error.response.status} - ${error.response.data?.message || 'Unknown error'}`);
      } else if (error.request) {
        throw new Error('Failed to connect to Discord webhook');
      } else {
        throw new Error(`Request setup error: ${error.message}`);
      }
    }
  }

  async sendTestMessage() {
    const testMessage = {
      embeds: [{
        title: '🧪 Bistro Scraper Test',
        description: 'This is a test message to verify the Discord webhook is working correctly.',
        color: 0x0099ff,
        timestamp: new Date().toISOString(),
        footer: {
          text: 'Bistro Scraper Bot - Test Mode'
        }
      }]
    };

    try {
      await this.sendMessage(testMessage);
      this.logger.info('Test message sent successfully to Discord');
      return true;
    } catch (error) {
      this.logger.error('Failed to send test message to Discord:', error);
      return false;
    }
  }

  async sendErrorNotification(error, context = '') {
    const errorMessage = {
      embeds: [{
        title: '🚨 Bistro Scraper Error',
        description: `An error occurred while scraping menus${context ? ` (${context})` : ''}`,
        fields: [{
          name: 'Error Details',
          value: `\`\`\`${error.message}\`\`\``,
          inline: false
        }],
        color: 0xff0000,
        timestamp: new Date().toISOString(),
        footer: {
          text: 'Bistro Scraper Bot - Error Report'
        }
      }]
    };

    try {
      await this.sendMessage(errorMessage);
      this.logger.info('Error notification sent to Discord');
    } catch (notificationError) {
      this.logger.error('Failed to send error notification to Discord:', notificationError);
    }
  }

  validateWebhookUrl() {
    const webhookPattern = /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/;
    
    if (!this.webhookUrl) {
      throw new Error('Discord webhook URL is not configured');
    }
    
    if (!webhookPattern.test(this.webhookUrl)) {
      throw new Error('Invalid Discord webhook URL format');
    }
    
    return true;
  }

  async cleanupScreenshots(screenshotPath) {
    try {
      this.logger.info('Cleaning up screenshots after successful message sending');
      const files = await readdir(screenshotPath);
      const screenshotFiles = files.filter(file => file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg'));
      
      if (screenshotFiles.length === 0) {
        this.logger.info('No screenshots to clean up');
        return;
      }

      let deletedCount = 0;
      for (const file of screenshotFiles) {
        try {
          await unlink(join(screenshotPath, file));
          deletedCount++;
        } catch (error) {
          this.logger.warn(`Failed to delete screenshot ${file}:`, error.message);
        }
      }
      
      this.logger.info(`Successfully deleted ${deletedCount}/${screenshotFiles.length} screenshots`);
    } catch (error) {
      this.logger.warn('Failed to cleanup screenshots:', error.message);
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}