// Load Chart.js from CDN
const script = document.createElement('script');
script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
script.onload = () => {
  // Dispatch event when Chart.js is loaded
  window.dispatchEvent(new Event('chartjs-loaded'));
};
document.head.appendChild(script);

// Ensure Chart.js is loaded before initializing charts
function ensureChartJs(callback) {
  if (window.Chart) {
    callback();
  } else {
    window.addEventListener('chartjs-loaded', callback);
  }
}

// Chart configuration
const chartConfig = {
  colors: {
    window: {
      bg: '#1976d2',
      border: '#1565c0'
    },
    state: {
      bg: '#388e3c',
      border: '#2e7d32'
    },
    ui: {
      bg: '#f57c00',
      border: '#ef6c00'
    }
  },
  defaults: {
    font: {
      family: 'system-ui, -apple-system, sans-serif'
    },
    responsive: true,
    animation: {
      duration: 250
    },
    plugins: {
      legend: {
        position: 'top'
      }
    }
  }
};

// Export utilities
window.chartUtils = {
  ensureChartJs,
  config: chartConfig
};