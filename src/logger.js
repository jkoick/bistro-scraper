import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export class Logger {
  constructor() {
    this.logDir = './logs';
    this.logFile = join(this.logDir, `scraper_${new Date().toISOString().split('T')[0]}.log`);
    this.ensureLogDirectory();
  }

  ensureLogDirectory() {
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true });
    }
  }

  formatMessage(level, message, error = null) {
    const timestamp = new Date().toISOString();
    let logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;
    
    if (error) {
      logMessage += `\n  Error: ${error.message}`;
      if (error.stack) {
        logMessage += `\n  Stack: ${error.stack}`;
      }
    }
    
    return logMessage;
  }

  writeLog(level, message, error = null) {
    const formattedMessage = this.formatMessage(level, message, error);
    
    try {
      appendFileSync(this.logFile, formattedMessage + '\n');
    } catch (writeError) {
      console.error('Failed to write to log file:', writeError.message);
    }
    
    if (level === 'error' || level === 'warn') {
      console.error(formattedMessage);
    } else {
      console.log(formattedMessage);
    }
  }

  info(message) {
    this.writeLog('info', message);
  }

  warn(message, error = null) {
    this.writeLog('warn', message, error);
  }

  error(message, error = null) {
    this.writeLog('error', message, error);
  }

  debug(message) {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true') {
      this.writeLog('debug', message);
    }
  }

  logScrapingSession(results) {
    const summary = {
      timestamp: new Date().toISOString(),
      totalSites: results.length,
      successfulSites: results.filter(r => r.success).length,
      failedSites: results.filter(r => !r.success).length,
      totalMenuItems: results
        .filter(r => r.success)
        .reduce((sum, r) => sum + (r.menuData?.items?.length || 0), 0),
      sites: results.map(r => ({
        name: r.name,
        success: r.success,
        itemCount: r.menuData?.items?.length || 0,
        error: r.error || null
      }))
    };

    this.info(`Scraping session completed: ${JSON.stringify(summary, null, 2)}`);
    return summary;
  }

  async cleanupOldLogs(daysToKeep = 30) {
    try {
      const fs = await import('fs/promises');
      const files = await fs.readdir(this.logDir);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      for (const file of files) {
        if (file.endsWith('.log')) {
          const filePath = join(this.logDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
            this.info(`Deleted old log file: ${file}`);
          }
        }
      }
    } catch (error) {
      this.warn('Failed to cleanup old logs:', error);
    }
  }
}