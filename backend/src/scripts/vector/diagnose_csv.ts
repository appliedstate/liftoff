import fs from 'fs';
import { parse } from 'csv-parse';

async function diagnose(csvPath: string) {
  const rs = fs.createReadStream(csvPath);
  const parser = parse({
    bom: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    relax_quotes: true,
    skip_records_with_error: true,
  });

  let totalRows = 0;
  let header: string[] | null = null;
  const keywordSet = new Set<string>();
  const keywordNormSet = new Set<string>();
  let emptyKeywords = 0;
  let skippedRows = 0;

  await new Promise<void>((resolve, reject) => {
    parser.on('data', (row: any) => {
      const arr: string[] = row as string[];
      if (!header) {
        header = arr;
        return;
      }
      totalRows++;
      if (arr.length < 3) {
        skippedRows++;
        return;
      }
      const keyword = String(arr[2] || '').trim();
      if (!keyword) {
        emptyKeywords++;
        return;
      }
      keywordSet.add(keyword);
      const norm = keyword.toLowerCase().replace(/\s+/g, ' ').trim();
      keywordNormSet.add(norm);
    });
    parser.on('error', reject);
    parser.on('end', () => resolve());
    rs.pipe(parser);
  });

  console.log(JSON.stringify({
    total_rows: totalRows,
    unique_keywords_raw: keywordSet.size,
    unique_keywords_normalized: keywordNormSet.size,
    empty_keywords: emptyKeywords,
    skipped_rows: skippedRows,
  }, null, 2));
}

const csvPath = process.argv[2] || './runs/system1/2025-11-06/angle_full.csv';
diagnose(csvPath).catch(console.error);

