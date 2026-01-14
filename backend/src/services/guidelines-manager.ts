/**
 * Trading Guidelines Manager
 * Loads, validates, and manages trading guidelines from YAML configuration files
 */

import { promises as fs } from 'fs';
import { watch, FSWatcher } from 'chokidar';
import path from 'path';
import * as yaml from 'js-yaml';
import { LoggingService } from './logging-service';
import {
  TradingGuidelines,
  GuidelinesValidationResult,
  GuidelinesManagerConfig
} from '@shared/types';

export class GuidelinesManagerError extends Error {
  constructor(message: string, public readonly code: string, public readonly filePath?: string) {
    super(message);
    this.name = 'GuidelinesManagerError';
  }
}

export class GuidelinesManager {
  private logger: LoggingService;
  private config: GuidelinesManagerConfig;
  private currentGuidelines: TradingGuidelines | null = null;
  private fileWatcher: FSWatcher | null = null;
  private changeCallbacks: Array<(guidelines: TradingGuidelines) => void> = [];
  private lastValidGuidelines: TradingGuidelines | null = null;

  constructor(logger: LoggingService, config: GuidelinesManagerConfig) {
    this.logger = logger;
    this.config = config;

    this.logger.info('Guidelines Manager initialized', {
      filePath: config.guidelinesFilePath,
      watchForChanges: config.watchForChanges
    });
  }

  /**
   * Load guidelines from the configured file
   */
  async loadGuidelines(): Promise<TradingGuidelines> {
    const startTime = Date.now();
    
    try {
      this.logger.info('Loading trading guidelines', { 
        filePath: this.config.guidelinesFilePath 
      });

      // Check if file exists
      const filePath = path.resolve(this.config.guidelinesFilePath);
      
      try {
        await fs.access(filePath);
      } catch (error) {
        throw new GuidelinesManagerError(
          `Guidelines file not found: ${filePath}`,
          'FILE_NOT_FOUND',
          filePath
        );
      }

      // Read file content
      const fileContent = await fs.readFile(filePath, 'utf-8');
      
      // Parse guidelines from YAML
      const guidelines = await this.parseGuidelinesFromYaml(fileContent, filePath);
      
      // Validate guidelines if configured
      if (this.config.validateOnLoad) {
        const validation = this.validateGuidelines(guidelines);
        if (!validation.isValid) {
          this.logger.warn('Guidelines validation failed', {
            errors: validation.errors,
            warnings: validation.warnings,
            missingRequiredSections: validation.missingRequiredSections
          });
          
          // If we have last valid guidelines, use those instead
          if (this.lastValidGuidelines) {
            this.logger.info('Using last valid guidelines due to validation failure');
            return this.lastValidGuidelines;
          }
          
          throw new GuidelinesManagerError(
            `Guidelines validation failed: ${validation.errors.join(', ')}`,
            'VALIDATION_FAILED',
            filePath
          );
        }
      }

      // Backup if configured
      if (this.config.backupOnLoad) {
        await this.backupGuidelines(guidelines);
      }

      // Store as current and last valid
      this.currentGuidelines = guidelines;
      this.lastValidGuidelines = guidelines;

      // Set up file watching if configured
      if (this.config.watchForChanges && !this.fileWatcher) {
        this.setupFileWatcher();
      }

      const loadTime = Date.now() - startTime;
      this.logger.info('Guidelines loaded successfully', {
        version: guidelines.version,
        loadTime,
        sectionsLoaded: Object.keys(guidelines).length
      });

      return guidelines;

    } catch (error) {
      const loadTime = Date.now() - startTime;
      this.logger.error('Failed to load guidelines', error as Error, {
        filePath: this.config.guidelinesFilePath,
        loadTime
      });

      if (error instanceof GuidelinesManagerError) {
        throw error;
      }

      throw new GuidelinesManagerError(
        `Failed to load guidelines: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'LOAD_FAILED',
        this.config.guidelinesFilePath
      );
    }
  }

  /**
   * Reload guidelines from file
   */
  async reloadGuidelines(): Promise<TradingGuidelines> {
    this.logger.info('Reloading trading guidelines');
    
    const guidelines = await this.loadGuidelines();
    
    // Notify all registered callbacks
    this.changeCallbacks.forEach(callback => {
      try {
        callback(guidelines);
      } catch (error) {
        this.logger.error('Error in guidelines change callback', error as Error);
      }
    });

    return guidelines;
  }

  /**
   * Get current loaded guidelines
   */
  getCurrentGuidelines(): TradingGuidelines | null {
    return this.currentGuidelines;
  }

  /**
   * Validate guidelines structure and content
   */
  validateGuidelines(guidelines: TradingGuidelines): GuidelinesValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const missingRequiredSections: string[] = [];

    try {
      // Check required top-level sections
      const requiredSections = ['stockSelection', 'entrySignals', 'exitCriteria', 'riskManagement'];
      
      for (const section of requiredSections) {
        if (!guidelines[section as keyof TradingGuidelines]) {
          missingRequiredSections.push(section);
          errors.push(`Missing required section: ${section}`);
        }
      }

      // Validate stock selection criteria
      if (guidelines.stockSelection) {
        const { liquidityRequirements, volatilityMetrics, priceRange } = guidelines.stockSelection;
        
        if (liquidityRequirements) {
          if (liquidityRequirements.minimumAverageDailyVolume <= 0) {
            errors.push('Minimum average daily volume must be positive');
          }
          if (liquidityRequirements.minimumMarketCap <= 0) {
            errors.push('Minimum market cap must be positive');
          }
          if (liquidityRequirements.maxBidAskSpreadPercent <= 0 || liquidityRequirements.maxBidAskSpreadPercent > 100) {
            errors.push('Max bid-ask spread percent must be between 0 and 100');
          }
        }

        if (volatilityMetrics) {
          if (volatilityMetrics.atrRange.min >= volatilityMetrics.atrRange.max) {
            errors.push('ATR range minimum must be less than maximum');
          }
          if (volatilityMetrics.betaRange.min >= volatilityMetrics.betaRange.max) {
            errors.push('Beta range minimum must be less than maximum');
          }
        }

        if (priceRange) {
          if (priceRange.minPrice >= priceRange.maxPrice) {
            errors.push('Price range minimum must be less than maximum');
          }
          if (priceRange.minPrice <= 0) {
            errors.push('Minimum price must be positive');
          }
        }
      }

      // Validate risk management rules
      if (guidelines.riskManagement?.portfolioRules) {
        const rules = guidelines.riskManagement.portfolioRules;
        
        if (rules.maxDailyLossPercent <= 0 || rules.maxDailyLossPercent > 100) {
          errors.push('Max daily loss percent must be between 0 and 100');
        }
        if (rules.maxDrawdownPercent <= 0 || rules.maxDrawdownPercent > 100) {
          errors.push('Max drawdown percent must be between 0 and 100');
        }
        if (rules.maxPositionSizePercent <= 0 || rules.maxPositionSizePercent > 100) {
          errors.push('Max position size percent must be between 0 and 100');
        }
        if (rules.riskPerTradePercent <= 0 || rules.riskPerTradePercent > 100) {
          errors.push('Risk per trade percent must be between 0 and 100');
        }
        if (rules.maxOpenPositions <= 0) {
          errors.push('Max open positions must be positive');
        }
      }

      // Validate entry signals
      if (guidelines.entrySignals?.longEntries) {
        guidelines.entrySignals.longEntries.forEach((signal, index) => {
          if (!signal.name || signal.name.trim().length === 0) {
            errors.push(`Long entry signal ${index + 1} must have a name`);
          }
          if (signal.riskRewardRatio <= 0) {
            errors.push(`Long entry signal "${signal.name}" must have positive risk/reward ratio`);
          }
          if (signal.volumeRequirement <= 0) {
            errors.push(`Long entry signal "${signal.name}" must have positive volume requirement`);
          }
        });
      }

      // Add warnings for missing optional sections
      if (!guidelines.entrySignals?.shortEntries || guidelines.entrySignals.shortEntries.length === 0) {
        warnings.push('No short entry signals defined');
      }
      
      if (!guidelines.exitCriteria?.trailingStops) {
        warnings.push('No trailing stop rules defined');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        missingRequiredSections
      };

    } catch (error) {
      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      return {
        isValid: false,
        errors,
        warnings,
        missingRequiredSections
      };
    }
  }

  /**
   * Watch guidelines file for changes
   */
  watchGuidelinesFile(callback: (guidelines: TradingGuidelines) => void): void {
    this.changeCallbacks.push(callback);
    
    if (!this.fileWatcher && this.config.watchForChanges) {
      this.setupFileWatcher();
    }
  }

  /**
   * Stop watching guidelines file
   */
  stopWatching(): void {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
      this.logger.info('Stopped watching guidelines file');
    }
  }

  /**
   * Get specific guidelines sections
   */
  getStockSelectionCriteria(): TradingGuidelines['stockSelection'] | null {
    return this.currentGuidelines?.stockSelection || null;
  }

  getEntrySignalRules(): TradingGuidelines['entrySignals'] | null {
    return this.currentGuidelines?.entrySignals || null;
  }

  getExitCriteriaRules(): TradingGuidelines['exitCriteria'] | null {
    return this.currentGuidelines?.exitCriteria || null;
  }

  getRiskManagementRules(): TradingGuidelines['riskManagement'] | null {
    return this.currentGuidelines?.riskManagement || null;
  }

  /**
   * Parse guidelines from YAML content
   */
  private async parseGuidelinesFromYaml(content: string, filePath: string): Promise<TradingGuidelines> {
    try {
      // Parse YAML content
      const parsed = yaml.load(content) as any;
      
      if (!parsed) {
        throw new Error('Failed to parse YAML content');
      }

      // Convert to TradingGuidelines structure
      const guidelines: TradingGuidelines = {
        stockSelection: parsed.stockSelection || {},
        entrySignals: parsed.entrySignals || {},
        exitCriteria: parsed.exitCriteria || {},
        riskManagement: parsed.riskManagement || {},
        lastUpdated: parsed.lastUpdated ? new Date(parsed.lastUpdated) : new Date(),
        version: parsed.version || '1.0.0',
        filePath
      };

      return guidelines;

    } catch (error) {
      throw new GuidelinesManagerError(
        `Failed to parse guidelines from YAML: ${error instanceof Error ? error.message : 'Unknown error'}`,
        'PARSE_FAILED',
        filePath
      );
    }
  }

  /**
   * Setup file watcher for guidelines file
   */
  private setupFileWatcher(): void {
    try {
      this.fileWatcher = watch(this.config.guidelinesFilePath, {
        persistent: true,
        ignoreInitial: true
      });

      this.fileWatcher.on('change', async () => {
        this.logger.info('Guidelines file changed, reloading...');
        
        try {
          await this.reloadGuidelines();
        } catch (error) {
          this.logger.error('Failed to reload guidelines after file change', error as Error);
        }
      });

      this.fileWatcher.on('error', (error) => {
        this.logger.error('File watcher error', error);
      });

      this.logger.info('File watcher setup for guidelines file');

    } catch (error) {
      this.logger.error('Failed to setup file watcher', error as Error);
    }
  }

  /**
   * Backup current guidelines
   */
  private async backupGuidelines(guidelines: TradingGuidelines): Promise<void> {
    try {
      const backupPath = `${guidelines.filePath}.backup.${Date.now()}.json`;
      const backupContent = JSON.stringify(guidelines, null, 2);
      
      await fs.writeFile(backupPath, backupContent, 'utf-8');
      
      this.logger.info('Guidelines backed up', { backupPath });
    } catch (error) {
      this.logger.warn('Failed to backup guidelines', { error: error instanceof Error ? error.message : 'Unknown error' });
    }
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    this.stopWatching();
    this.changeCallbacks = [];
    this.currentGuidelines = null;
    this.lastValidGuidelines = null;
    
    this.logger.info('Guidelines Manager disposed');
  }
}

/**
 * Factory function to create guidelines manager instances
 */
export function createGuidelinesManager(
  logger: LoggingService, 
  config?: Partial<GuidelinesManagerConfig>
): GuidelinesManager {
  const defaultConfig: GuidelinesManagerConfig = {
    guidelinesFilePath: 'artifacts/swing_trading_guidelines.yaml',
    watchForChanges: true,
    backupOnLoad: true,
    validateOnLoad: true
  };

  const finalConfig = { ...defaultConfig, ...config };
  return new GuidelinesManager(logger, finalConfig);
}

// Re-export types for convenience
export type {
  TradingGuidelines,
  GuidelinesManagerConfig,
  GuidelinesValidationResult
};
