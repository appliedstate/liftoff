import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { parse } from 'csv-parse/sync';

type KeywordDailyRow = {
	date: string;
	keyword: string;
	total_revenue: number;
	sessions: number;
	avg_rpc: number;
	pct_of_day: number;
};

function parseArgs(): { end: string; days: number } {
	const args = process.argv.slice(2);
	let end = '';
	let days = 2;
	for (let i = 0; i < args.length; i++) {
		const a = args[i];
		if (a === '--end' && i + 1 < args.length) {
			end = args[i + 1];
			i++;
		} else if (a === '--days' && i + 1 < args.length) {
			days = parseInt(args[i + 1], 10);
			i++;
		}
	}
	if (!end) {
		// default to yesterday in UTC
		const d = new Date();
		d.setUTCDate(d.getUTCDate() - 1);
		end = d.toISOString().slice(0, 10);
	}
	if (!(days > 0)) days = 2;
	return { end, days };
}

async function fetchCsvForDate(dateStr: string): Promise<string> {
	const url = `https://staging-dot-strategis-273115.appspot.com/api/s1/report/get-session-rev?date=${encodeURIComponent(
		dateStr
	)}&filterZero=1&incremental=1&limit=-1&offset=0&output=csv`;
	const res = await axios.get(url, { responseType: 'text', timeout: 30000 });
	return typeof res.data === 'string' ? res.data : String(res.data ?? '');
}

function aggregateByKeyword(dateStr: string, csvText: string): KeywordDailyRow[] {
	if (!csvText || !csvText.trim()) return [];
	const records: string[][] = parse(csvText, { relax_column_count: true });
	if (!records.length) return [];
	const header = records[0];
	const idx = (name: string): number => {
		const i = header.indexOf(name);
		return i >= 0 ? i : -1;
	};
	const iKw = idx('keyword');
	const iRev = idx('total_revenue');
	if (iKw < 0 || iRev < 0) return [];

	const sumByKw = new Map<string, number>();
	const countByKw = new Map<string, number>();

	for (let r = 1; r < records.length; r++) {
		const row = records[r];
		const kw = (row[iKw] ?? '').trim();
		if (!kw) continue;
		const rev = Number(row[iRev]);
		if (!Number.isFinite(rev)) continue;
		sumByKw.set(kw, (sumByKw.get(kw) ?? 0) + rev);
		countByKw.set(kw, (countByKw.get(kw) ?? 0) + 1);
	}

	let totalDay = 0;
	for (const v of sumByKw.values()) totalDay += v;
	if (totalDay <= 0) totalDay = 0;

	const rows: KeywordDailyRow[] = [];
	for (const [kw, s] of sumByKw.entries()) {
		const c = countByKw.get(kw) ?? 0;
		const avg = c > 0 ? s / c : 0;
		const pct = totalDay > 0 ? (s * 100) / totalDay : 0;
		rows.push({
			date: dateStr,
			keyword: kw,
			total_revenue: round6(s),
			sessions: c,
			avg_rpc: round6(avg),
			pct_of_day: round2(pct),
		});
	}
	return rows;
}

function round6(n: number): number {
	return Math.round(n * 1e6) / 1e6;
}

function round2(n: number): number {
	return Math.round(n * 100) / 100;
}

function* eachDate(end: string, days: number): Generator<string> {
	const endDate = new Date(`${end}T00:00:00Z`);
	for (let i = days - 1; i >= 0; i--) {
		const d = new Date(endDate);
		d.setUTCDate(d.getUTCDate() - i);
		yield d.toISOString().slice(0, 10);
	}
}

function ensureDir(dir: string) {
	fs.mkdirSync(dir, { recursive: true });
}

function writeCsv(rows: KeywordDailyRow[], outPath: string) {
	const header =
		'date,keyword,total_revenue,sessions,avg_rpc,pct_of_day';
	const lines = [header];
	for (const r of rows) {
		// CSV escape keyword by wrapping in quotes if needed
		const kw =
			r.keyword.includes(',') || r.keyword.includes('"')
				? `"${r.keyword.replace(/"/g, '""')}"`
				: r.keyword;
		lines.push(
			[
				r.date,
				kw,
				r.total_revenue.toFixed(6),
				String(r.sessions),
				r.avg_rpc.toFixed(6),
				r.pct_of_day.toFixed(2),
			].join(',')
		);
	}
	fs.writeFileSync(outPath, lines.join('\n'), 'utf-8');
}

function writeHtml(rows: KeywordDailyRow[], outPath: string) {
	const dataJson = JSON.stringify(rows);
	const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Keywords – Revenue by Day (Vega-Lite)</title>
  <script src="https://cdn.jsdelivr.net/npm/vega@5"></script>
  <script src="https://cdn.jsdelivr.net/npm/vega-lite@5"></script>
  <script src="https://cdn.jsdelivr.net/npm/vega-embed@6"></script>
  <style>
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 16px; }
    #view { max-width: 1200px; margin: 0 auto; }
  </style>
</head>
<body>
  <h2>Keywords – Revenue Share by Day</h2>
  <div id="view"></div>
  <script>
    const rows = ${dataJson};
    // Heatmap: date x keyword colored by pct_of_day
    const spec = {
      $schema: "https://vega.github.io/schema/vega-lite/v5.json",
      data: { values: rows },
      transform: [
        { calculate: "toDate(datum.date)", as: "d" }
      ],
      mark: "rect",
      encoding: {
        x: { field: "d", type: "temporal", title: "Date" },
        y: { field: "keyword", type: "nominal", sort: "-x", title: "Keyword" },
        color: { field: "pct_of_day", type: "quantitative", title: "Share of Day (%)", scale: { scheme: "blues" } },
        tooltip: [
          { field: "keyword" },
          { field: "date" },
          { field: "pct_of_day", type: "quantitative", format: ".2f", title: "Share (%)" },
          { field: "total_revenue", type: "quantitative", format: ".2f" },
          { field: "sessions", type: "quantitative" },
          { field: "avg_rpc", type: "quantitative", format: ".3f" }
        ]
      },
      config: { view: { stroke: "transparent" } }
    };
    vegaEmbed("#view", spec, { actions: false });
  </script>
</body>
</html>`;
	fs.writeFileSync(outPath, html, 'utf-8');
}

(async function main() {
	const { end, days } = parseArgs();
	const outDir = path.resolve(__dirname, '../../../reports/s1');
	ensureDir(outDir);

	const allRows: KeywordDailyRow[] = [];
	for (const dateStr of eachDate(end, days)) {
		try {
			const csvText = await fetchCsvForDate(dateStr);
			const rows = aggregateByKeyword(dateStr, csvText);
			allRows.push(...rows);
			// eslint-disable-next-line no-console
			console.log(`Aggregated ${rows.length} keywords for ${dateStr}`);
		} catch (e) {
			// eslint-disable-next-line no-console
			console.warn(`Failed to fetch/parse ${dateStr}: ${(e as Error)?.message || e}`);
		}
	}
	// Write CSV and HTML
	const csvPath = path.join(outDir, 'keywords_daily.csv');
	const htmlPath = path.join(outDir, 'keywords_daily.html');
	writeCsv(allRows, csvPath);
	writeHtml(allRows, htmlPath);
	// eslint-disable-next-line no-console
	console.log(`Wrote ${csvPath}`);
	// eslint-disable-next-line no-console
	console.log(`Wrote ${htmlPath}`);
})().catch((err) => {
	// eslint-disable-next-line no-console
	console.error(err);
	process.exit(1);
});




