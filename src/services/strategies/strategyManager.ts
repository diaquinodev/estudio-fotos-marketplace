import { ImageGenerationStrategy, ImageGenerationParams, ImageEditParams, StrategyInfo } from './types';
import { GeminiStrategy } from './geminiStrategy';

export class ImageGenerationManager {
  private static instance: ImageGenerationManager;
  private strategies: Map<string, ImageGenerationStrategy> = new Map();
  private activeStrategyId: string = 'gemini';
  private listeners: Array<(strategy: StrategyInfo) => void> = [];

  private constructor() {
    this.registerStrategy(new GeminiStrategy());
    this.activeStrategyId = 'gemini';
  }

  public static getInstance(): ImageGenerationManager {
    if (!ImageGenerationManager.instance) {
      ImageGenerationManager.instance = new ImageGenerationManager();
    }
    return ImageGenerationManager.instance;
  }

  public registerStrategy(strategy: ImageGenerationStrategy) {
    this.strategies.set(strategy.info.id, strategy);
  }

  public getAvailableStrategies(): StrategyInfo[] {
    return Array.from(this.strategies.values()).map(s => s.info);
  }

  public getActiveStrategy(): ImageGenerationStrategy {
    const strategy = this.strategies.get(this.activeStrategyId);
    if (!strategy) {
      return this.strategies.get('gemini')!;
    }
    return strategy;
  }

  public getActiveStrategyInfo(): StrategyInfo {
    return this.getActiveStrategy().info;
  }

  public setStrategy(strategyId: string): boolean {
    if (this.strategies.has(strategyId)) {
      this.activeStrategyId = strategyId;
      const info = this.getActiveStrategyInfo();
      this.listeners.forEach(fn => fn(info));
      return true;
    }
    return false;
  }

  public subscribe(fn: (strategy: StrategyInfo) => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  public async generateImage(
    params: ImageGenerationParams,
    onProgress?: (status: string) => void
  ): Promise<string> {
    const strategy = this.getActiveStrategy();
    return await strategy.generateImage(params, onProgress);
  }

  public async editImage(
    params: ImageEditParams,
    onProgress?: (status: string) => void
  ): Promise<string> {
    const strategy = this.getActiveStrategy();
    return await strategy.editImage(params, onProgress);
  }
}

export const imageGenerationManager = ImageGenerationManager.getInstance();
