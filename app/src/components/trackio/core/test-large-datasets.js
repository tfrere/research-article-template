// Test utilities for Large Dataset Support
// Run in browser console to validate sampling behavior

/**
 * Test suite for large dataset sampling
 */
export const LargeDatasetTests = {
  
  /**
   * Test basic sampling functionality
   */
  testBasicSampling() {
    console.log('🧪 Testing basic sampling functionality...');
    
    // Generate a dataset that should trigger sampling
    if (window.trackioInstance) {
      const result = window.trackioInstance.generateMassiveDataset(1000, 2);
      console.log('✅ Basic sampling test completed:', result);
      return result;
    } else {
      console.error('❌ trackioInstance not found');
      return null;
    }
  },

  /**
   * Test massive dataset performance
   */
  testMassiveDataset() {
    console.log('🧪 Testing massive dataset (10K points)...');
    
    if (window.trackioInstance) {
      const startTime = performance.now();
      const result = window.trackioInstance.generateMassiveDataset(10000, 3);
      const endTime = performance.now();
      
      console.log(`✅ Massive dataset test completed in ${(endTime - startTime).toFixed(2)}ms`);
      console.log('📊 Result:', result);
      return { result, duration: endTime - startTime };
    } else {
      console.error('❌ trackioInstance not found');
      return null;
    }
  },

  /**
   * Test sampling strategies
   */
  async testSamplingStrategies() {
    console.log('🧪 Testing different sampling strategies...');
    
    const { AdaptiveSampler } = await import('./adaptive-sampler.js');
    
    // Generate test data
    const testData = Array.from({ length: 1000 }, (_, i) => ({
      step: i + 1,
      value: Math.sin(i * 0.01) + Math.random() * 0.1
    }));

    const strategies = ['uniform', 'smart', 'lod'];
    const results = {};

    strategies.forEach(strategy => {
      const sampler = new AdaptiveSampler({ 
        maxPoints: 400, 
        targetPoints: 100,
        adaptiveStrategy: strategy 
      });
      
      const startTime = performance.now();
      const result = sampler.sampleSeries(testData, strategy);
      const endTime = performance.now();
      
      results[strategy] = {
        originalLength: testData.length,
        sampledLength: result.data.length,
        compressionRatio: result.compressionRatio,
        duration: endTime - startTime,
        strategy: result.strategy
      };
      
      console.log(`📊 ${strategy}: ${result.data.length} points (${(result.compressionRatio * 100).toFixed(1)}% retained) in ${(endTime - startTime).toFixed(2)}ms`);
    });

    console.log('✅ Strategy comparison test completed');
    return results;
  },

  /**
   * Performance benchmark across different dataset sizes
   */
  async benchmarkPerformance() {
    console.log('🧪 Running performance benchmark...');
    
    const { AdaptiveSampler } = await import('./adaptive-sampler.js');
    const sampler = new AdaptiveSampler();
    
    const sizes = [500, 1000, 2000, 5000, 10000];
    const results = [];

    for (const size of sizes) {
      console.log(`🔄 Testing ${size} points...`);
      
      // Generate test data
      const testData = Array.from({ length: size }, (_, i) => ({
        step: i + 1,
        value: Math.sin(i * 0.001) + Math.cos(i * 0.003) + Math.random() * 0.05
      }));

      // Measure sampling performance
      const startTime = performance.now();
      const result = sampler.sampleSeries(testData);
      const endTime = performance.now();

      const testResult = {
        originalSize: size,
        sampledSize: result.data.length,
        compressionRatio: result.compressionRatio,
        duration: endTime - startTime,
        pointsPerMs: result.data.length / (endTime - startTime)
      };

      results.push(testResult);
      console.log(`📊 ${size} → ${result.data.length} points (${(result.compressionRatio * 100).toFixed(1)}%) in ${(endTime - startTime).toFixed(2)}ms`);
    }

    console.log('✅ Performance benchmark completed');
    console.table(results);
    return results;
  },

  /**
   * Test feature preservation
   */
  async testFeaturePreservation() {
    console.log('🧪 Testing feature preservation...');
    
    const { AdaptiveSampler } = await import('./adaptive-sampler.js');
    const sampler = new AdaptiveSampler({ preserveFeatures: true });
    
    // Generate data with clear features (peaks, valleys, inflection points)
    const testData = [];
    for (let i = 0; i < 1000; i++) {
      let value = 0;
      
      // Add some peaks and valleys
      value += Math.sin(i * 0.02) * 2;           // Main oscillation
      value += Math.sin(i * 0.1) * 0.5;          // Faster oscillation
      value += Math.cos(i * 0.005) * 1.5;        // Slow trend
      
      // Add sharp peaks at specific points
      if (i === 200 || i === 600 || i === 800) {
        value += 3;
      }
      
      // Add noise
      value += (Math.random() - 0.5) * 0.1;
      
      testData.push({ step: i + 1, value });
    }

    const result = sampler.sampleSeries(testData);
    const features = result.features;

    console.log('🎯 Feature detection results:');
    console.log(`   Peaks found: ${features?.peaks?.length || 0}`);
    console.log(`   Valleys found: ${features?.valleys?.length || 0}`);
    console.log(`   Inflection points: ${features?.inflectionPoints?.length || 0}`);
    console.log(`   Compression: ${testData.length} → ${result.data.length} (${(result.compressionRatio * 100).toFixed(1)}%)`);

    // Check if our artificial peaks are preserved
    const preservedPeaks = [200, 600, 800].filter(peakStep => 
      result.sampledIndices.some(idx => Math.abs(idx - peakStep) <= 2)
    );
    
    console.log(`🎯 Artificial peaks preserved: ${preservedPeaks.length}/3`);
    console.log('✅ Feature preservation test completed');
    
    return { result, features, preservedPeaks };
  },

  /**
   * Run all tests
   */
  async runAllTests() {
    console.log('🚀 Running complete large dataset test suite...');
    
    const results = {
      basicSampling: this.testBasicSampling(),
      massiveDataset: this.testMassiveDataset(),
      samplingStrategies: await this.testSamplingStrategies(),
      performanceBenchmark: await this.benchmarkPerformance(),
      featurePreservation: await this.testFeaturePreservation()
    };

    console.log('🎉 All tests completed!');
    console.log('📋 Full test results:', results);
    
    return results;
  }
};

/**
 * Quick test function for browser console
 */
export function testLargeDatasets() {
  return LargeDatasetTests.runAllTests();
}

/**
 * Expose to global scope for easy testing
 */
if (typeof window !== 'undefined') {
  window.LargeDatasetTests = LargeDatasetTests;
  window.testLargeDatasets = testLargeDatasets;
}

// Example usage in browser console:
// testLargeDatasets()
// LargeDatasetTests.testMassiveDataset()
// LargeDatasetTests.benchmarkPerformance()
