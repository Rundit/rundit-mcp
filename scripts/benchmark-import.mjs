// Read-only import ergonomics benchmark. Never applies metric changes.
// RUNDIT_API_KEY=... node scripts/benchmark-import.mjs [http://localhost:3002/mcp] [--agent]
import { performance } from 'node:perf_hooks';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.argv.find((arg) => arg.startsWith('http')) ?? 'http://localhost:3002/mcp';
const key = process.env.RUNDIT_API_KEY;
if (!key) throw new Error('Set RUNDIT_API_KEY');
const headers = { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', Authorization: `Bearer ${key}` };
const records = [];
async function call(name, args, label = name) {
  const start = performance.now();
  const request = { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } };
  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(request), signal: AbortSignal.timeout(120000) });
  const body = await response.json();
  if (!response.ok || body.error || body.result?.isError) throw new Error(`${label}: ${JSON.stringify(body)}`);
  const result = JSON.parse(body.result.content[0].text);
  const record = { label, requestBytes: Buffer.byteLength(JSON.stringify(request)), responseBytes: Buffer.byteLength(JSON.stringify(body.result)), ms: Math.round(performance.now() - start) };
  records.push(record);
  console.log(JSON.stringify(record));
  return result;
}

await call('metrics_get_types', {}, 'catalog/full');
await call('metrics_get_types', { nameSearch: ['Revenue', 'MRR', 'Active Accounts'] }, 'catalog/filtered');
const companies = await call('companies_get_all', { nameSearch: ['Certific'] }, 'company/resolve');
const company = companies.data.find((company) => company.name.toLowerCase() === 'certific');
if (!company) throw new Error('Certific not found');
await call('metrics_search', { companyIds: [company.id] }, 'company/full-history');
await call('metrics_search', { companyIds: [company.id], timeframe: 'Month', to: '2026-09-09', pointLimit: 1 }, 'company/latest');
const previewArgs = { dryRun: true, companies: [{ companyId: company.id, currency: company.currency, items: [
  { metricTypeName: 'Revenue', points: [{ date: '2026-04-01', timeframe: 'Quarter', value: 980300, optionValue: null }] },
  { metricTypeName: 'MRR', points: [{ date: '2026-06-01', timeframe: 'Month', value: 327500, optionValue: null }] },
  { metricTypeName: 'Active Accounts', points: [{ date: '2026-06-01', timeframe: 'Month', value: 1489, optionValue: null }] },
] }] };
const preview = await call('metrics_import', previewArgs, 'import/three-metrics-preview');
if (!preview.success || preview.pointsToWrite !== 0) throw new Error('Expected unchanged Certific report points');
const sampleCompanies = await call('companies_get_all', { limit: 5 }, 'companies/multi-preview-sample');
const other = sampleCompanies.data.find((candidate) => candidate.id !== company.id && candidate.type === 'managed');
if (other) {
  const values = await call('metrics_search', { companyIds: [other.id], timeframe: 'Month', pointLimit: 1, to: '2026-09-09' }, 'company/second-preview-source');
  const metric = values.data[0]?.metrics.find((metric) => metric.points.some((point) => !point.aggregated && !point.valueError && (point.value !== null || point.optionValue !== null)));
  if (metric) {
    const point = metric.points.find((point) => !point.aggregated && !point.valueError && (point.value !== null || point.optionValue !== null));
    const multi = await call('metrics_import', { dryRun: true, companies: [...previewArgs.companies, { companyId: other.id, currency: other.currency, items: [{ metricTypeId: metric.metricType.id, points: [{ date: point.date, timeframe: point.timeframe, value: point.value, optionValue: point.optionValue }] }] }] }, 'import/two-company-preview');
    if (!multi.success || multi.pointsToWrite !== 0 || multi.companies.length !== 2) throw new Error('Expected two unchanged company previews');
  }
}
const groups = await call('company_groups_get_all', {}, 'funds/resolve');
const largest = groups.data.toSorted((a,b) => (b.companyIds?.length ?? 0) - (a.companyIds?.length ?? 0))[0];
if (largest) {
  await call('metrics_search', { companyGroupIds: [largest.id] }, `fund/${largest.id}/full-history`);
  await call('metrics_search', { companyGroupIds: [largest.id], timeframe: 'Month', pointLimit: 1, to: '2026-09-09' }, `fund/${largest.id}/latest`);
  await call('metrics_search', { companyGroupIds: [largest.id], includePoints: false }, `fund/${largest.id}/shape-only`);
}
console.log(JSON.stringify({ summary: { calls: records.length, requestBytes: records.reduce((sum,r) => sum+r.requestBytes,0), responseBytes: records.reduce((sum,r) => sum+r.responseBytes,0) } }));

if (process.argv.includes('--agent')) {
  // Enforce read-only at transport level, not just in the agent prompt.
  const readTools = new Set(['companies_get_all', 'company_groups_get_all', 'metrics_get_types', 'metrics_search', 'metric_templates_get']);
  const calls = [];
  const proxy = createServer(async (req, res) => {
    try {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      const body = JSON.parse(raw);
      if (body.method === 'tools/call') {
        const { name, arguments: args } = body.params;
        if (!(readTools.has(name) || (name === 'metrics_import' && args.dryRun !== false))) throw new Error('Benchmark permits reads and dry-run imports only');
      }
      const upstream = await fetch(url, { method: 'POST', headers, body: raw });
      const text = await upstream.text();
      if (body.method === 'tools/call') calls.push({ name: body.params.name, args: body.params.arguments, requestBytes: Buffer.byteLength(raw), responseBytes: Buffer.byteLength(text) });
      res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') ?? 'application/json' });
      res.end(text);
    } catch (error) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: error.message }));
    }
  });
  await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve));
  const directory = mkdtempSync(join(tmpdir(), 'rundit-import-agent-'));
  const config = JSON.stringify({ mcpServers: { 'rundit-loop': { type: 'http', url: `http://127.0.0.1:${proxy.address().port}` } } });
  const prompt = 'You have only Rundit MCP tools and no implementation knowledge. Preview (DO NOT APPLY) importing these USD values for Certific: Q2 2026 Revenue 980300, June 2026 MRR 327500, June 2026 Active Accounts 1489. Create missing types/requests only in the preview if necessary. Minimize tool calls and response sizes; inspect descriptions to choose the best workflow. Explain whether values would change, and how you would import 14 metrics x 3 monthly points for 62 companies with these tools. Finish with Friction log listing concrete errors, wasted calls, payload issues and missing capabilities. Never call a write other than metrics_import with dryRun:true.';
  const child = spawn('claude', ['-p', '--model', 'sonnet', '--mcp-config', config, '--strict-mcp-config', '--tools', '', '--allowedTools', 'mcp__rundit-loop__*', '--max-turns', '15', '--max-budget-usd', '2', '--output-format', 'stream-json', '--verbose', prompt], { cwd: directory, env: { ...process.env, CLAUDECODE: '' }, stdio: ['ignore','pipe','pipe'] });
  let output = ''; let errors = '';
  child.stdout.on('data', (chunk) => output += chunk);
  child.stderr.on('data', (chunk) => errors += chunk);
  const timer = setTimeout(() => child.kill('SIGTERM'), 180000);
  const code = await new Promise((resolve) => child.on('close', resolve));
  clearTimeout(timer);
  proxy.closeAllConnections();
  await new Promise((resolve) => proxy.close(resolve));
  writeFileSync(join(directory, 'run.jsonl'), output);
  writeFileSync(join(directory, 'calls.json'), JSON.stringify(calls, null, 2));
  const result = output.trim().split('\n').map((line) => { try { return JSON.parse(line); } catch { return {}; } }).findLast((event) => event.type === 'result');
  console.log(JSON.stringify({ agent: { code, directory, calls, result, stderr: errors } }));
  if (code !== 0 || !result || result.is_error || !calls.length) process.exitCode = 1;
}
