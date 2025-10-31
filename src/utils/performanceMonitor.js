import React from 'react';

/**
 * Performance monitoring utility for network visualization
 */
class PerformanceMonitor {
  constructor() {
    this.marks = {};
    this.measures = {};
    this.enabled = true; // Set to false in production
  }

  /**
   * Start timing a specific operation
   */
  start(label) {
    if (!this.enabled) return;
    
    this.marks[label] = performance.now();
    console.log(`⏱️ [START] ${label}`);
  }

  /**
   * End timing and log the duration
   */
  end(label) {
    if (!this.enabled || !this.marks[label]) return;
    
    const duration = performance.now() - this.marks[label];
    this.measures[label] = duration;
    
    const emoji = duration > 1000 ? '🔴' : duration > 500 ? '🟡' : '🟢';
    console.log(`${emoji} [END] ${label}: ${duration.toFixed(2)}ms`);
    
    delete this.marks[label];
    return duration;
  }

  /**
   * Log memory usage (if available)
   */
  logMemory() {
    if (!this.enabled) return;
    
    if (performance.memory) {
      const used = performance.memory.usedJSHeapSize / 1048576;
      const total = performance.memory.totalJSHeapSize / 1048576;
      const limit = performance.memory.jsHeapSizeLimit / 1048576;
      
      console.log(`💾 Memory: ${used.toFixed(1)}MB / ${total.toFixed(1)}MB (limit: ${limit.toFixed(1)}MB)`);
    }
  }

  /**
   * Get a summary of all measurements
   */
  getSummary() {
    if (!this.enabled) return null;
    
    const summary = Object.entries(this.measures)
      .sort((a, b) => b[1] - a[1])
      .map(([label, duration]) => ({
        label,
        duration: duration.toFixed(2),
        status: duration > 1000 ? 'slow' : duration > 500 ? 'medium' : 'fast'
      }));
    
    return summary;
  }

  /**
   * Log a detailed performance report
   */
  report() {
    if (!this.enabled) return;
    
    console.group('📊 Performance Report');
    
    const summary = this.getSummary();
    if (summary && summary.length > 0) {
      console.table(summary);
      
      const total = Object.values(this.measures).reduce((a, b) => a + b, 0);
      console.log(`Total measured time: ${total.toFixed(2)}ms`);
    } else {
      console.log('No measurements recorded');
    }
    
    this.logMemory();
    console.groupEnd();
  }

  /**
   * Clear all measurements
   */
  reset() {
    this.marks = {};
    this.measures = {};
  }
}

// Create singleton instance
const monitor = new PerformanceMonitor();

// Export convenience functions
export const perfStart = (label) => monitor.start(label);
export const perfEnd = (label) => monitor.end(label);
export const perfReport = () => monitor.report();
export const perfReset = () => monitor.reset();
export const perfMemory = () => monitor.logMemory();

export default monitor;

/**
 * React Hook for performance monitoring
 */
export const usePerformanceMonitor = (componentName) => {
  React.useEffect(() => {
    perfStart(`${componentName} mount`);
    
    return () => {
      perfEnd(`${componentName} mount`);
      if (componentName === 'NetworkGraph') {
        // Log report when main component unmounts
        perfReport();
      }
    };
  }, [componentName]);
  
  return {
    start: (label) => perfStart(`${componentName}: ${label}`),
    end: (label) => perfEnd(`${componentName}: ${label}`),
    report: perfReport
  };
};

/**
 * Wrap async functions with performance monitoring
 */
export const withPerformanceMonitoring = (fn, label) => {
  return async (...args) => {
    perfStart(label);
    try {
      const result = await fn(...args);
      perfEnd(label);
      return result;
    } catch (error) {
      perfEnd(label);
      throw error;
    }
  };
};

/**
 * Monitor fetch requests
 */
export const monitoredFetch = (url, options) => {
  const filename = url.split('/').pop();
  perfStart(`Fetch: ${filename}`);
  
  return fetch(url, options)
    .then(response => {
      perfEnd(`Fetch: ${filename}`);
      return response;
    })
    .catch(error => {
      perfEnd(`Fetch: ${filename}`);
      throw error;
    });
};