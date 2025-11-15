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
    console.error('Usage: npx ts-node src/scripts/system1/generate_state_chart.ts <csv_file>');
    console.error('Example: npx ts-node src/scripts/system1/generate_state_chart.ts runs/system1/2025-11-07/depression_cluster_state_analysis_2025-11-11T14-11-17.csv');
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
  
  // Parse CSV
  const states: Array<{
    state: string;
    revenue: number;
    rpc: number;
    rps: number;
    clicks: number;
    searches: number;
  }> = [];
  
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
    // Weighted average for RPC/RPS
    const totalClicks = stateData.clicks;
    const totalSearches = stateData.searches;
    stateData.rpc = totalClicks > 0 ? stateData.revenue / totalClicks : 0;
    stateData.rps = totalSearches > 0 ? stateData.revenue / totalSearches : 0;
  }
  
  const sortedStates = Array.from(stateMap.values())
    .sort((a, b) => b.revenue - a.revenue);
  
  // Generate HTML with Recharts
  const stateDataJson = JSON.stringify(sortedStates.slice(0, 20));
  const totalRevenue = sortedStates.reduce((sum, s) => sum + s.revenue, 0).toFixed(2);
  const avgRPC = (sortedStates.reduce((sum, s) => sum + s.rpc, 0) / sortedStates.length).toFixed(2);
  const avgRPS = (sortedStates.reduce((sum, s) => sum + s.rps, 0) / sortedStates.length).toFixed(2);
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>State Performance Analysis</title>
    <script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
    <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
    <script src="https://unpkg.com/recharts@2.10.3/umd/Recharts.js"></script>
    <style>
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
        }
        .chart-container {
            margin: 30px 0;
        }
        .summary {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .summary-card {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #007bff;
        }
        .summary-card h3 {
            margin: 0 0 10px 0;
            font-size: 14px;
            color: #666;
            text-transform: uppercase;
        }
        .summary-card .value {
            font-size: 24px;
            font-weight: bold;
            color: #333;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>State Performance Analysis</h1>
        
        <div class="summary">
            <div class="summary-card">
                <h3>Total Revenue</h3>
                <div class="value">$${totalRevenue}</div>
            </div>
            <div class="summary-card">
                <h3>Total States</h3>
                <div class="value">${sortedStates.length}</div>
            </div>
            <div class="summary-card">
                <h3>Avg RPC</h3>
                <div class="value">$${avgRPC}</div>
            </div>
            <div class="summary-card">
                <h3>Avg RPS</h3>
                <div class="value">$${avgRPS}</div>
            </div>
        </div>
        
        <div class="chart-container">
            <h2>Revenue by State (Top 20)</h2>
            <div id="revenue-chart"></div>
        </div>
        
        <div class="chart-container">
            <h2>RPC by State (Top 20)</h2>
            <div id="rpc-chart"></div>
        </div>
        
        <div class="chart-container">
            <h2>RPS by State (Top 20)</h2>
            <div id="rps-chart"></div>
        </div>
    </div>
    
    <script>
        const { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } = Recharts;
        
        const data = ${stateDataJson};
        
        // Revenue Chart
        ReactDOM.render(
            React.createElement(ResponsiveContainer, { width: "100%", height: 400 },
                React.createElement(BarChart, { data: data, margin: { top: 20, right: 30, left: 20, bottom: 60 } },
                    React.createElement(CartesianGrid, { strokeDasharray: "3 3" }),
                    React.createElement(XAxis, { dataKey: "state", angle: -45, textAnchor: "end", height: 80 }),
                    React.createElement(YAxis, { label: { value: "Revenue ($)", angle: -90, position: "insideLeft" } }),
                    React.createElement(Tooltip, { formatter: (value: any) => '$' + Number(value).toFixed(2) }),
                    React.createElement(Bar, { dataKey: "revenue", fill: "#007bff", name: "Revenue" })
                )
            ),
            document.getElementById('revenue-chart')
        );
        
        // RPC Chart
        ReactDOM.render(
            React.createElement(ResponsiveContainer, { width: "100%", height: 400 },
                React.createElement(BarChart, { data: data, margin: { top: 20, right: 30, left: 20, bottom: 60 } },
                    React.createElement(CartesianGrid, { strokeDasharray: "3 3" }),
                    React.createElement(XAxis, { dataKey: "state", angle: -45, textAnchor: "end", height: 80 }),
                    React.createElement(YAxis, { label: { value: "RPC ($)", angle: -90, position: "insideLeft" } }),
                    React.createElement(Tooltip, { formatter: (value: any) => '$' + Number(value).toFixed(4) }),
                    React.createElement(Bar, { dataKey: "rpc", fill: "#28a745", name: "RPC" })
                )
            ),
            document.getElementById('rpc-chart')
        );
        
        // RPS Chart
        ReactDOM.render(
            React.createElement(ResponsiveContainer, { width: "100%", height: 400 },
                React.createElement(BarChart, { data: data, margin: { top: 20, right: 30, left: 20, bottom: 60 } },
                    React.createElement(CartesianGrid, { strokeDasharray: "3 3" }),
                    React.createElement(XAxis, { dataKey: "state", angle: -45, textAnchor: "end", height: 80 }),
                    React.createElement(YAxis, { label: { value: "RPS ($)", angle: -90, position: "insideLeft" } }),
                    React.createElement(Tooltip, { formatter: (value: any) => '$' + Number(value).toFixed(4) }),
                    React.createElement(Bar, { dataKey: "rps", fill: "#dc3545", name: "RPS" })
                )
            ),
            document.getElementById('rps-chart')
        );
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
  console.error('generate_state_chart failed', err);
  process.exit(1);
});

