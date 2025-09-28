'use client';

interface PerformanceMetrics {
  renderTime: number;
  audioLatency: number;
  memoryUsage: number;
  timestamp: number;
}

interface PerformanceThresholds {
  maxRenderTime: number; // 16ms for 60fps
  maxAudioLatency: number; // 50ms
  maxMemoryIncrease: number; // 10MB
}

class HeartbeatPerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private thresholds: PerformanceThresholds;
  private baselineMemory: number = 0;
  private isMonitoring: boolean = false;

  constructor() {
    this.thresholds = {
      maxRenderTime: parseFloat(process.env.NEXT_PUBLIC_HEARTBEAT_MAX_RENDER_TIME || '16'),
      maxAudioLatency: parseFloat(process.env.NEXT_PUBLIC_HEARTBEAT_MAX_AUDIO_LATENCY || '50'),
      maxMemoryIncrease: parseFloat(process.env.NEXT_PUBLIC_HEARTBEAT_MAX_MEMORY_MB || '10')
    };

    this.initializeBaseline();
  }

  private initializeBaseline() {
    if (typeof window !== 'undefined' && 'performance' in window) {
      // @ts-ignore - memory property may not be available in all browsers
      this.baselineMemory = (performance as any).memory?.usedJSHeapSize || 0;
    }
  }

  startMonitoring() {
    if (process.env.NODE_ENV === 'development') {
      this.isMonitoring = true;
      console.log('Heartbeat performance monitoring started');
    }
  }

  stopMonitoring() {
    this.isMonitoring = false;
    if (process.env.NODE_ENV === 'development') {
      console.log('Heartbeat performance monitoring stopped');
      this.logSummary();
    }
  }

  recordRenderTime(startTime: number): void {
    if (!this.isMonitoring) return;

    const renderTime = performance.now() - startTime;
    this.recordMetric({ renderTime });

    if (renderTime > this.thresholds.maxRenderTime) {
      console.warn(`Heartbeat render time exceeded threshold: ${renderTime.toFixed(2)}ms > ${this.thresholds.maxRenderTime}ms`);
    }
  }

  recordAudioLatency(startTime: number): void {
    if (!this.isMonitoring) return;

    const audioLatency = performance.now() - startTime;
    this.recordMetric({ audioLatency });

    if (audioLatency > this.thresholds.maxAudioLatency) {
      console.warn(`Heartbeat audio latency exceeded threshold: ${audioLatency.toFixed(2)}ms > ${this.thresholds.maxAudioLatency}ms`);
    }
  }

  recordMemoryUsage(): void {
    if (!this.isMonitoring || typeof window === 'undefined') return;

    try {
      // @ts-ignore - memory property may not be available in all browsers
      const currentMemory = (performance as any).memory?.usedJSHeapSize || 0;
      const memoryIncrease = (currentMemory - this.baselineMemory) / (1024 * 1024); // Convert to MB

      this.recordMetric({ memoryUsage: memoryIncrease });

      if (memoryIncrease > this.thresholds.maxMemoryIncrease) {
        console.warn(`Heartbeat memory usage exceeded threshold: ${memoryIncrease.toFixed(2)}MB > ${this.thresholds.maxMemoryIncrease}MB`);
      }
    } catch (error) {
      // Memory API not available - graceful fallback
    }
  }

  private recordMetric(partialMetric: Partial<Omit<PerformanceMetrics, 'timestamp'>>) {
    const metric: PerformanceMetrics = {
      renderTime: 0,
      audioLatency: 0,
      memoryUsage: 0,
      timestamp: Date.now(),
      ...partialMetric
    };

    this.metrics.push(metric);

    // Keep only last 100 metrics to prevent memory bloat
    if (this.metrics.length > 100) {
      this.metrics = this.metrics.slice(-100);
    }
  }

  getAverageMetrics(): Partial<PerformanceMetrics> {
    if (this.metrics.length === 0) return {};

    const totals = this.metrics.reduce(
      (acc, metric) => ({
        renderTime: acc.renderTime + metric.renderTime,
        audioLatency: acc.audioLatency + metric.audioLatency,
        memoryUsage: acc.memoryUsage + metric.memoryUsage
      }),
      { renderTime: 0, audioLatency: 0, memoryUsage: 0 }
    );

    return {
      renderTime: totals.renderTime / this.metrics.length,
      audioLatency: totals.audioLatency / this.metrics.length,
      memoryUsage: totals.memoryUsage / this.metrics.length
    };
  }

  isPerformanceHealthy(): boolean {
    const averages = this.getAverageMetrics();

    return (
      (averages.renderTime || 0) <= this.thresholds.maxRenderTime &&
      (averages.audioLatency || 0) <= this.thresholds.maxAudioLatency &&
      (averages.memoryUsage || 0) <= this.thresholds.maxMemoryIncrease
    );
  }

  private logSummary(): void {
    if (this.metrics.length === 0) {
      console.log('No heartbeat performance metrics recorded');
      return;
    }

    const averages = this.getAverageMetrics();
    console.group('Heartbeat Performance Summary');
    console.log(`Metrics recorded: ${this.metrics.length}`);
    console.log(`Average render time: ${(averages.renderTime || 0).toFixed(2)}ms (threshold: ${this.thresholds.maxRenderTime}ms)`);
    console.log(`Average audio latency: ${(averages.audioLatency || 0).toFixed(2)}ms (threshold: ${this.thresholds.maxAudioLatency}ms)`);
    console.log(`Average memory increase: ${(averages.memoryUsage || 0).toFixed(2)}MB (threshold: ${this.thresholds.maxMemoryIncrease}MB)`);
    console.log(`Performance healthy: ${this.isPerformanceHealthy() ? '✓' : '✗'}`);
    console.groupEnd();
  }

  // Graceful degradation helper
  shouldReduceQuality(): boolean {
    const averages = this.getAverageMetrics();

    // Suggest quality reduction if performance is consistently poor
    return (
      (averages.renderTime || 0) > this.thresholds.maxRenderTime * 1.5 ||
      (averages.memoryUsage || 0) > this.thresholds.maxMemoryIncrease * 1.5
    );
  }

  // Get current performance status
  getPerformanceStatus(): 'good' | 'warning' | 'poor' {
    if (!this.isPerformanceHealthy()) {
      return this.shouldReduceQuality() ? 'poor' : 'warning';
    }
    return 'good';
  }

  dispose(): void {
    this.stopMonitoring();
    this.metrics = [];
  }
}

// Singleton instance
let performanceMonitorInstance: HeartbeatPerformanceMonitor | null = null;

export const getPerformanceMonitor = (): HeartbeatPerformanceMonitor => {
  if (!performanceMonitorInstance) {
    performanceMonitorInstance = new HeartbeatPerformanceMonitor();
  }
  return performanceMonitorInstance;
};

// Environment configuration helper
export const getHeartbeatConfig = () => ({
  enabled: process.env.NEXT_PUBLIC_HEARTBEAT_ENABLED !== 'false',
  audioEnabled: process.env.NEXT_PUBLIC_HEARTBEAT_AUDIO_ENABLED !== 'false',
  visualEnabled: process.env.NEXT_PUBLIC_HEARTBEAT_VISUAL_ENABLED !== 'false',
  defaultVolume: parseFloat(process.env.NEXT_PUBLIC_HEARTBEAT_DEFAULT_VOLUME || '0.3'),
  defaultIntensity: parseFloat(process.env.NEXT_PUBLIC_HEARTBEAT_DEFAULT_INTENSITY || '1.0'),
  performanceMonitoring: process.env.NEXT_PUBLIC_HEARTBEAT_PERFORMANCE_MONITORING === 'true'
});