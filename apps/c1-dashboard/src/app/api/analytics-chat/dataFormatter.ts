/**
 * Data Formatter for C1 Components
 * 
 * Transforms raw analytics data into formats suitable for C1 chart/table components
 */

export interface ChartDataPoint {
  x: string | number;
  y: number;
  label?: string;
}

export interface TableColumn {
  key: string;
  label: string;
  type?: 'string' | 'number' | 'currency' | 'percentage';
}

export interface TableRow {
  [key: string]: any;
}

/**
 * Format data for BarChart component
 */
export function formatBarChartData(
  data: any[],
  xKey: string,
  yKey: string,
  groupBy?: string
): { data: ChartDataPoint[]; labels?: string[] } {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return { data: [] };
  }

  if (groupBy) {
    // Group data and aggregate
    const grouped = data.reduce((acc: any, row: any) => {
      const groupKey = String(row[groupBy] || 'Unknown');
      if (!acc[groupKey]) {
        acc[groupKey] = { x: groupKey, y: 0, count: 0 };
      }
      acc[groupKey].y += Number(row[yKey] || 0);
      acc[groupKey].count += 1;
      return acc;
    }, {});

    const chartData = Object.values(grouped) as ChartDataPoint[];
    return { data: chartData };
  }

  const chartData: ChartDataPoint[] = data.map((row: any) => ({
    x: String(row[xKey] || ''),
    y: Number(row[yKey] || 0),
    label: row[xKey] ? String(row[xKey]) : undefined,
  }));

  return { data: chartData };
}

/**
 * Format data for LineChart component
 */
export function formatLineChartData(
  data: any[],
  xKey: string,
  yKey: string
): { data: ChartDataPoint[] } {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return { data: [] };
  }

  // Sort by x value (typically date)
  const sorted = [...data].sort((a, b) => {
    const aVal = a[xKey];
    const bVal = b[xKey];
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return aVal.localeCompare(bVal);
    }
    return Number(aVal) - Number(bVal);
  });

  const chartData: ChartDataPoint[] = sorted.map((row: any) => ({
    x: String(row[xKey] || ''),
    y: Number(row[yKey] || 0),
  }));

  return { data: chartData };
}

/**
 * Format data for Table component
 */
export function formatTableData(
  data: any[],
  columns?: string[]
): { columns: TableColumn[]; rows: TableRow[] } {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return { columns: [], rows: [] };
  }

  // Determine columns
  const allKeys = new Set<string>();
  data.forEach((row) => {
    Object.keys(row).forEach((key) => allKeys.add(key));
  });

  const selectedColumns = columns || Array.from(allKeys);
  const tableColumns: TableColumn[] = selectedColumns.map((key) => {
    // Detect column type from first row
    const firstValue = data[0]?.[key];
    let type: TableColumn['type'] = 'string';
    
    if (typeof firstValue === 'number') {
      type = 'number';
      if (key.includes('usd') || key.includes('spend') || key.includes('revenue') || key.includes('margin')) {
        type = 'currency';
      } else if (key.includes('rate') || key.includes('roas') || key.includes('margin_rate')) {
        type = 'percentage';
      }
    }

    return {
      key,
      label: key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase()),
      type,
    };
  });

  const tableRows: TableRow[] = data.map((row) => {
    const formattedRow: TableRow = {};
    selectedColumns.forEach((key) => {
      formattedRow[key] = row[key] ?? null;
    });
    return formattedRow;
  });

  return { columns: tableColumns, rows: tableRows };
}

/**
 * Generate C1 component JSON based on intent and data
 */
export function generateC1Component(
  intent: any,
  data: any
): { component: any; props: any } {
  const { type, visualization } = intent;

  // Handle data structure
  let rows: any[] = [];
  if (data?.rows && Array.isArray(data.rows)) {
    rows = data.rows;
  } else if (Array.isArray(data)) {
    rows = data;
  } else if (data?.results && Array.isArray(data.results)) {
    rows = data.results.flatMap((r: any) => (r.rows || r) || []);
  }

  switch (visualization) {
    case 'bar': {
      // Determine x and y keys based on intent
      let xKey = 'campaign_name';
      let yKey = 'revenue_usd';
      
      if (intent.aggregation?.groupBy?.[0]) {
        xKey = intent.aggregation.groupBy[0];
      } else if (rows.length > 0) {
        // Auto-detect best keys
        const firstRow = rows[0];
        if (firstRow.owner) xKey = 'owner';
        if (firstRow.lane) xKey = 'lane';
        if (firstRow.category) xKey = 'category';
        if (firstRow.date) xKey = 'date';
      }

      const chartData = formatBarChartData(rows, xKey, yKey, intent.aggregation?.groupBy?.[0]);
      
      return {
        component: {
          component: 'BarChart',
          props: {
            title: `Performance by ${xKey.replace(/_/g, ' ')}`,
            data: chartData.data,
            xLabel: xKey.replace(/_/g, ' '),
            yLabel: yKey.replace(/_/g, ' '),
          },
        },
      };
    }

    case 'line': {
      const xKey = rows[0]?.date ? 'date' : 'campaign_name';
      const yKey = 'revenue_usd';
      
      const chartData = formatLineChartData(rows, xKey, yKey);
      
      return {
        component: {
          component: 'LineChart',
          props: {
            title: 'Performance Trend',
            data: chartData.data,
            xLabel: xKey.replace(/_/g, ' '),
            yLabel: yKey.replace(/_/g, ' '),
          },
        },
      };
    }

    case 'table': {
      const tableData = formatTableData(rows);
      
      return {
        component: {
          component: 'Table',
          props: {
            title: 'Performance Data',
            columns: tableData.columns,
            rows: tableData.rows,
          },
        },
      };
    }

    case 'text':
    default: {
      // Generate text summary
      let summary = '';
      
      if (type === 'summary' && data) {
        const totals = rows.reduce((acc: any, row: any) => {
          acc.spend = (acc.spend || 0) + (row.spend_usd || 0);
          acc.revenue = (acc.revenue || 0) + (row.revenue_usd || 0);
          acc.margin = (acc.margin || 0) + (row.net_margin_usd || 0);
          return acc;
        }, {});
        
        const roas = totals.spend > 0 ? totals.revenue / totals.spend : 0;
        const marginRate = totals.revenue > 0 ? totals.margin / totals.revenue : 0;
        
        summary = `## Summary\n\n` +
          `- **Total Spend:** $${totals.spend.toFixed(2)}\n` +
          `- **Total Revenue:** $${totals.revenue.toFixed(2)}\n` +
          `- **Net Margin:** $${totals.margin.toFixed(2)}\n` +
          `- **ROAS:** ${roas.toFixed(2)}x\n` +
          `- **Margin Rate:** ${(marginRate * 100).toFixed(1)}%\n`;
      } else if (rows.length > 0) {
        summary = `Found ${rows.length} results. `;
        if (rows.length <= 5) {
          summary += `\n\nTop performers:\n`;
          rows.slice(0, 5).forEach((row: any, idx: number) => {
            summary += `${idx + 1}. ${row.campaign_name || row.adset_name || 'Unknown'}: `;
            summary += `ROAS ${(row.roas || 0).toFixed(2)}x, `;
            summary += `Revenue $${(row.revenue_usd || 0).toFixed(2)}\n`;
          });
        }
      } else {
        summary = 'No data found for this query.';
      }
      
      return {
        component: {
          component: 'TextContent',
          props: {
            textMarkdown: summary,
          },
        },
      };
    }
  }
}

