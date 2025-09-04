#!/usr/bin/env node

import { MenuScraperScheduler } from './scheduler.js';
import { Logger } from './logger.js';

const logger = new Logger();

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'start';

  const scheduler = new MenuScraperScheduler();
  global.schedulerInstance = scheduler;

  try {
    await scheduler.initialize();

    switch (command) {
      case 'start':
        logger.info('Starting Bistro Scraper in scheduled mode');
        scheduler.start();
        
        logger.info('Scheduler is running. Press Ctrl+C to stop.');
        logger.info(`Status: ${JSON.stringify(scheduler.getStatus(), null, 2)}`);
        
        process.stdin.resume();
        break;

      case 'run-once':
        logger.info('Running Bistro Scraper once');
        await scheduler.runOnce();
        await scheduler.shutdown();
        break;

      case 'test-webhook':
        logger.info('Testing Discord webhook');
        const success = await scheduler.testWebhook();
        if (success) {
          logger.info('Webhook test successful');
        } else {
          logger.error('Webhook test failed');
          process.exit(1);
        }
        await scheduler.shutdown();
        break;

      case 'status':
        const status = scheduler.getStatus();
        console.log(JSON.stringify(status, null, 2));
        await scheduler.shutdown();
        break;

      case 'help':
        showHelp();
        await scheduler.shutdown();
        break;

      default:
        logger.error(`Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }

  } catch (error) {
    logger.error('Application failed to start:', error);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
Bistro Scraper - Automated Menu Scraping Tool

Usage: node src/index.js [command]

Commands:
  start          Start the scheduler (default)
  run-once       Run scraping once and exit
  test-webhook   Test Discord webhook connection
  status         Show current configuration status
  help           Show this help message

Environment Setup:
  1. Copy .env.example to .env
  2. Set DISCORD_WEBHOOK_URL in .env
  3. Configure sites in config/sites.json
  4. Run: npm install
  5. Start: npm start

Examples:
  npm start                    # Start scheduler
  npm run scrape              # Run once (via package.json script)
  node src/index.js test-webhook  # Test Discord webhook
  `);
}

// Run main function when file is executed directly
main().catch(error => {
  console.error('Unhandled error in main:', error);
  process.exit(1);
});