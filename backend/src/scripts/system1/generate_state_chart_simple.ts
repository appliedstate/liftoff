import fs from 'fs';
import path from 'path';

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  
  return result;
}

async function main() {
  const csvPath = process.argv[2];
  
  if (!csvPath) {
    console.error('Usage: npx ts-node src/scripts/system1/generate_state_chart_simple.ts <csv_file>');
    console.error('Example: npx ts-node src/scripts/system1/generate_state_chart_simple.ts runs/system1/2025-11-07/depression_cluster_state_analysis_2025-11-11T14-11-17.csv');
    process.exit(1);
  }
  
  if (!fs.existsSync(csvPath)) {
    console.error(`File not found: ${csvPath}`);
    process.exit(1);
  }
  
  const content = fs.readFileSync(csvPath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  
  if (lines.length < 2) {
    console.error('CSV file is empty or has no data rows');
    process.exit(1);
  }
  
  // Parse CSV and aggregate by state
  const stateMap = new Map<string, {
    state: string;
    revenue: number;
    rpc: number;
    rps: number;
    clicks: number;
    searches: number;
  }>();
  
  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length < 9) continue;
    
    const state = values[2].replace(/^"/, '').replace(/"$/, '').trim();
    const revenue = parseFloat(values[3] || '0');
    const rpc = parseFloat(values[4] || '0');
    const rps = parseFloat(values[5] || '0');
    const clicks = parseFloat(values[6] || '0');
    const searches = parseFloat(values[7] || '0');
    
    if (!state || state === 'state' || state.length !== 2) continue;
    
    if (!stateMap.has(state)) {
      stateMap.set(state, {
        state,
        revenue: 0,
        rpc: 0,
        rps: 0,
        clicks: 0,
        searches: 0,
      });
    }
    
    const stateData = stateMap.get(state)!;
    stateData.revenue += revenue;
    stateData.clicks += clicks;
    stateData.searches += searches;
    // Recalculate weighted averages
    const totalClicks = stateData.clicks;
    const totalSearches = stateData.searches;
    stateData.rpc = totalClicks > 0 ? stateData.revenue / totalClicks : 0;
    stateData.rps = totalSearches > 0 ? stateData.revenue / totalSearches : 0;
  }
  
  const sortedStates = Array.from(stateMap.values())
    .sort((a, b) => b.revenue - a.revenue);
  
  const top20 = sortedStates.slice(0, 20);
  
  // Generate HTML with Chart.js (simpler than Recharts)
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>State Performance Analysis</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
            margin-top: 0;
            color: #333;
            border-bottom: 2px solid #007bff;
            padding-bottom: 10px;
        }
        h2 {
            color: #555;
            margin-top: 40px;
        }
        .chart-container {
            margin: 30px 0;
            position: relative;
            height: 400px;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .summary-card {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .summary-card h3 {
            margin: 0 0 10px 0;
            font-size: 14px;
            text-transform: uppercase;
            opacity: 0.9;
        }
        .summary-card .value {
            font-size: 28px;
            font-weight: bold;
        }
        .data-table {
            margin-top: 40px;
            overflow-x: auto;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background: #f8f9fa;
            font-weight: 600;
            color: #333;
        }
        tr:hover {
            background: #f8f9fa;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>State Performance Analysis</h1>
        
        <div class="summary">
            <div class="summary-card">
                <h3>Total Revenue</h3>
                <div class="value">$${sortedStates.reduce((sum, s) => sum + s.revenue, 0).toFixed(2)}</div>
            </div>
            <div class="summary-card">
                <h3>Total States</h3>
                <div class="value">${sortedStates.length}</div>
            </div>
            <div class="summary-card">
                <h3>Avg RPC</h3>
                <div class="value">$${(sortedStates.reduce((sum, s) => sum + s.rpc, 0) / sortedStates.length).toFixed(2)}</div>
            </div>
            <div class="summary-card">
                <h3>Avg RPS</h3>
                <div class="value">$${(sortedStates.reduce((sum, s) => sum + s.rps, 0) / sortedStates.length).toFixed(2)}</div>
            </div>
        </div>
        
        <h2>Revenue by State (Top 20)</h2>
        <div class="chart-container">
            <canvas id="revenue-chart"></canvas>
        </div>
        
        <h2>RPC by State (Top 20)</h2>
        <div class="chart-container">
            <canvas id="rpc-chart"></canvas>
        </div>
        
        <h2>RPS by State (Top 20)</h2>
        <div class="chart-container">
            <canvas id="rps-chart"></canvas>
        </div>
        
        <div class="data-table">
            <h2>All States Data</h2>
            <table>
                <thead>
                    <tr>
                        <th>Rank</th>
                        <th>State</th>
                        <th>Revenue</th>
                        <th>RPC</th>
                        <th>RPS</th>
                        <th>Clicks</th>
                        <th>Searches</th>
                    </tr>
                </thead>
                <tbody>
                    ${sortedStates.map((s, idx) => `
                    <tr>
                        <td>${idx + 1}</td>
                        <td><strong>${s.state}</strong></td>
                        <td>$${s.revenue.toFixed(2)}</td>
                        <td>$${s.rpc.toFixed(4)}</td>
                        <td>$${s.rps.toFixed(4)}</td>
                        <td>${s.clicks.toFixed(0)}</td>
                        <td>${s.searches.toFixed(0)}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </div>
    
    <script>
        const data = ${JSON.stringify(top20)};
        const colors = {
            revenue: 'rgba(0, 123, 255, 0.8)',
            rpc: 'rgba(40, 167, 69, 0.8)',
            rps: 'rgba(220, 53, 69, 0.8)'
        };
        
        // Revenue Chart
        new Chart(document.getElementById('revenue-chart'), {
            type: 'bar',
            data: {
                labels: data.map(d => d.state),
                datasets: [{
                    label: 'Revenue ($)',
                    data: data.map(d => d.revenue),
                    backgroundColor: colors.revenue,
                    borderColor: colors.revenue.replace('0.8', '1'),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => '$' + context.parsed.y.toFixed(2)
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => '$' + value.toFixed(0)
                        }
                    }
                }
            }
        });
        
        // RPC Chart
        new Chart(document.getElementById('rpc-chart'), {
            type: 'bar',
            data: {
                labels: data.map(d => d.state),
                datasets: [{
                    label: 'RPC ($)',
                    data: data.map(d => d.rpc),
                    backgroundColor: colors.rpc,
                    borderColor: colors.rpc.replace('0.8', '1'),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => '$' + context.parsed.y.toFixed(4)
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => '$' + value.toFixed(2)
                        }
                    }
                }
            }
        });
        
        // RPS Chart
        new Chart(document.getElementById('rps-chart'), {
            type: 'bar',
            data: {
                labels: data.map(d => d.state),
                datasets: [{
                    label: 'RPS ($)',
                    data: data.map(d => d.rps),
                    backgroundColor: colors.rps,
                    borderColor: colors.rps.replace('0.8', '1'),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => '$' + context.parsed.y.toFixed(4)
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => '$' + value.toFixed(2)
                        }
                    }
                }
            }
        });
    </script>
</body>
</html>`;
  
  // Write HTML file
  const outputDir = path.dirname(csvPath);
  const outputPath = path.join(outputDir, path.basename(csvPath, '.csv') + '_chart.html');
  
  fs.writeFileSync(outputPath, html);
  
  console.log(`\n✅ Chart generated: ${outputPath}\n`);
  console.log(`Open in browser: file://${path.resolve(outputPath)}\n`);
}

main().catch((err) => {
  console.error('generate_state_chart_simple failed', err);
  process.exit(1);
});



