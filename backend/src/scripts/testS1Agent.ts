import 'dotenv/config';
import axios from 'axios';

type AgentTestCase = {
  name: string;
  input: string;
  expectedTool: string;
  /**
   * Minimum number of rows we expect in toolResult.rows for this test.
   * Only applied when toolResult.rows is an array.
   */
  minRows?: number;
  /**
   * If true, assert that the answer does NOT contain known hallucination markers
   * like em-dashes used as placeholders or fabricated backend errors.
   */
  checkHallucinations?: boolean;
};

const TEST_CASES: AgentTestCase[] = [
  {
    name: 'Top 20 slugs by revenue',
    input:
      'List the top 20 slugs with the highest est_net_revenue in a table please top to bottom',
    expectedTool: 'top_slugs',
    minRows: 20,
    checkHallucinations: true,
  },
  {
    name: 'Keywords for specific slug',
    input:
      'What are the top revenue producing keywords for careers/exploring-careers-in-home-repair-and-contracting-en-us/',
    expectedTool: 'keywords_for_slug',
    minRows: 10,
    checkHallucinations: true,
  },
];

type AgentResponse = {
  status: string;
  plan: { tool: string; [key: string]: any };
  toolResult: { rows?: any[]; results?: any[]; [key: string]: any };
  answer: string;
};

function hasHallucinationMarkers(answer: string): string[] {
  const lower = answer.toLowerCase();
  const markers: { label: string; predicate: (text: string) => boolean }[] = [
    {
      label: 'em-dash placeholder',
      predicate: (t) => t.includes('—'),
    },
    {
      label: 'could not retrieve',
      predicate: (t) =>
        t.includes("we couldn't retrieve") ||
        t.includes('we couldn’t retrieve') ||
        t.includes('could not retrieve'),
    },
    {
      label: 'unable to retrieve',
      predicate: (t) => t.includes('unable to retrieve'),
    },
    {
      label: 'backend error mention',
      predicate: (t) => t.includes('backend error'),
    },
  ];

  const hits: string[] = [];
  for (const m of markers) {
    if (m.predicate(lower)) {
      hits.push(m.label);
    }
  }
  return hits;
}

async function runTestCase(
  baseUrl: string,
  test: AgentTestCase
): Promise<{ name: string; passed: boolean; errors: string[] }> {
  const errors: string[] = [];
  try {
    const resp = await axios.post<AgentResponse>(baseUrl, {
      query: test.input,
    });

    const data = resp.data;
    if (!data || typeof data !== 'object') {
      errors.push('Response body is empty or not an object');
      return { name: test.name, passed: false, errors };
    }

    if (!data.plan || typeof data.plan.tool !== 'string') {
      errors.push('Missing or invalid plan.tool in response');
    } else if (data.plan.tool !== test.expectedTool) {
      errors.push(
        `Expected plan.tool="${test.expectedTool}" but got "${data.plan.tool}"`
      );
    }

    const rows = Array.isArray(data.toolResult?.rows)
      ? data.toolResult.rows
      : null;
    if (typeof test.minRows === 'number' && rows) {
      if (rows.length < test.minRows) {
        errors.push(
          `Expected at least ${test.minRows} rows in toolResult.rows but got ${rows.length}`
        );
      }
    }

    if (test.checkHallucinations) {
      const answer = data.answer || '';
      if (!answer || answer.trim().length === 0) {
        errors.push('Answer is empty');
      } else {
        const markers = hasHallucinationMarkers(answer);
        if (markers.length > 0) {
          errors.push(
            `Answer contains hallucination markers: ${markers.join(', ')}`
          );
        }
      }
    }
  } catch (e: any) {
    errors.push(
      `Request failed: ${e?.message || String(e)}${
        e?.response?.status ? ` (status ${e.response.status})` : ''
      }`
    );
  }

  const passed = errors.length === 0;
  return { name: test.name, passed, errors };
}

async function main() {
  const baseUrl =
    process.env.S1_AGENT_URL || 'http://localhost:3001/api/s1/agent';

  console.log('=== S1 SERP Agent Test Harness ===');
  console.log(`Target: ${baseUrl}`);
  console.log(`Total tests: ${TEST_CASES.length}\n`);

  const results = [];
  for (const test of TEST_CASES) {
    console.log(`Running: ${test.name}`);
    const result = await runTestCase(baseUrl, test);
    results.push(result);
    if (result.passed) {
      console.log(`  ✅ PASSED`);
    } else {
      console.log(`  ❌ FAILED`);
      for (const err of result.errors) {
        console.log(`    - ${err}`);
      }
    }
    console.log('');
  }

  const failed = results.filter((r) => !r.passed);
  console.log('=== Summary ===');
  console.log(`Passed: ${results.length - failed.length}`);
  console.log(`Failed: ${failed.length}`);

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Unexpected error in test harness:', err);
  process.exit(1);
});


