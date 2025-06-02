// Initialize connection to background page
let backgroundPageConnection = chrome.runtime.connect({
  name: 'devtools-performance'
});

let metrics = [];
let charts = {};

// Listen for performance metric updates
backgroundPageConnection.onMessage.addListener(function(message) {
  if (message.type === 'performanceMetric') {
    addMetric(message.metric);
    updateCharts();
  }
});

// Request initial metrics
backgroundPageConnection.postMessage({
  type: 'getPerformanceMetrics'
});

// Initialize Charts
function initializeCharts() {
  const categoryCtx = document.getElementById('categoryChart').getContext('2d');
  const timelineCtx = document.getElementById('timelineChart').getContext('2d');
  
  charts.category = new Chart(categoryCtx, {
    type: 'bar',
    data: {
      labels: ['Window', 'State', 'UI'],
      datasets: [{
        label: 'Average Duration (ms)',
        data: [0, 0, 0],
        backgroundColor: [
          '#1976d2',
          '#388e3c',
          '#f57c00'
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
  
  charts.timeline = new Chart(timelineCtx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        label: 'Operation Duration (ms)',
        data: [],
        borderColor: '#1976d2',
        tension: 0.1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

// Update chart data
function updateCharts() {
  const categoryAverages = calculateCategoryAverages();
  charts.category.data.datasets[0].data = [
    categoryAverages.window || 0,
    categoryAverages.state || 0,
    categoryAverages.ui || 0
  ];
  charts.category.update();
  
  const timelineData = metrics.slice(-20); // Show last 20 metrics
  charts.timeline.data.labels = timelineData.map(m => formatTime(m.timestamp));
  charts.timeline.data.datasets[0].data = timelineData.map(m => m.duration);
  charts.timeline.update();
}

// Calculate average duration by category
function calculateCategoryAverages() {
  const sums = {};
  const counts = {};
  
  metrics.forEach(metric => {
    if (!sums[metric.category]) {
      sums[metric.category] = 0;
      counts[metric.category] = 0;
    }
    sums[metric.category] += metric.duration;
    counts[metric.category]++;
  });
  
  return Object.keys(sums).reduce((acc, category) => {
    acc[category] = sums[category] / counts[category];
    return acc;
  }, {});
}

// Add new metric to the list and update UI
function addMetric(metric) {
  metrics.push(metric);
  
  const metricsContainer = document.getElementById('metrics');
  const metricElement = createMetricElement(metric);
  
  metricsContainer.insertBefore(metricElement, metricsContainer.firstChild);
  if (metricsContainer.children.length > 100) {
    metricsContainer.lastChild.remove();
  }
  
  updateSummary();
}

// Create DOM element for a metric
function createMetricElement(metric) {
  const div = document.createElement('div');
  div.className = 'metric-card';
  
  const header = document.createElement('div');
  header.className = 'metric-header';
  
  const name = document.createElement('div');
  name.className = 'metric-name';
  name.innerHTML = `
    <span class="category-badge ${metric.category}">${metric.category}</span>
    ${metric.name}
  `;
  
  const duration = document.createElement('div');
  duration.className = `metric-duration${metric.passed ? '' : ' slow'}`;
  duration.textContent = `${metric.duration.toFixed(2)}ms`;
  
  header.appendChild(name);
  header.appendChild(duration);
  div.appendChild(header);
  
  if (metric.context) {
    const context = document.createElement('pre');
    context.className = 'metric-context';
    context.textContent = JSON.stringify(metric.context, null, 2);
    div.appendChild(context);
  }
  
  return div;
}

// Update summary statistics
function updateSummary() {
  const total = metrics.length;
  const passed = metrics.filter(m => m.passed).length;
  const failed = total - passed;
  const avgDuration = metrics.reduce((sum, m) => sum + m.duration, 0) / total;
  
  document.getElementById('summary-stats').innerHTML = `
    <p>Total Operations: ${total}</p>
    <p>Passed: ${passed} (${((passed/total)*100).toFixed(1)}%)</p>
    <p>Failed: ${failed}</p>
    <p>Average Duration: ${avgDuration.toFixed(2)}ms</p>
  `;
}

// Format timestamp for display
function formatTime(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}

// Initialize on load
document.addEventListener('DOMContentLoaded', function() {
  initializeCharts();
});

// Add keyboard shortcuts for clearing metrics
document.addEventListener('keydown', function(e) {
  if (e.ctrlKey && e.key === 'k') {
    metrics = [];
    document.getElementById('metrics').innerHTML = '';
    updateSummary();
    updateCharts();
  }
});