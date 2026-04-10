import * as fs from 'node:fs';
import * as path from 'node:path';

interface TaskRow {
  id: string;
  risk: string;
  status: string;
  name: string;
  commit: string;
}

interface UpdateRow {
  timestamp: string;
  blocked: boolean;
  message: string;
}

function parseAttr(tag: string, attr: string): string {
  return tag.match(new RegExp(`${attr}="([^"]*)"`)) ?.[1] ?? '';
}

function parseElement(xml: string, tag: string): string {
  return xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`))?.[1] ?? '';
}

function parseTasks(xml: string): TaskRow[] {
  const rows: TaskRow[] = [];
  for (const block of xml.matchAll(/<task\s[\s\S]*?<\/task>/g)) {
    const b = block[0];
    const openTag = b.match(/<task[^>]*>/)?.[0] ?? '';
    rows.push({
      id: parseAttr(openTag, 'id'),
      risk: parseAttr(openTag, 'risk'),
      status: parseAttr(openTag, 'status'),
      name: parseElement(b, 'name'),
      commit: parseElement(b, 'commit'),
    });
  }
  return rows;
}

function parseUpdates(xml: string): UpdateRow[] {
  const rows: UpdateRow[] = [];
  for (const m of xml.matchAll(/<update([^>]*)>([\s\S]*?)<\/update>/g)) {
    rows.push({
      timestamp: parseAttr(m[1], 'timestamp'),
      blocked: /blocked="true"/.test(m[1]),
      message: m[2].trim(),
    });
  }
  return rows;
}

export function formatPlanSummary(xml: string): string {
  const planAttr = xml.match(/<plan-tasks[^>]*plan="(\d+)"[^>]*plan-version="([^"]*)"/);
  const planNum = planAttr?.[1] ?? '?';
  const planVersion = planAttr?.[2] ?? '?';
  const metaStatus = parseElement(xml, 'status');
  const backlogIssue = parseElement(xml, 'backlog-issue');

  const tasks = parseTasks(xml);
  const updates = parseUpdates(xml);

  const lines: string[] = [];
  lines.push(`Plan ${planNum} (${planVersion})  status: ${metaStatus}  backlog: ${backlogIssue || '—'}`);
  lines.push('');

  // Task table
  const colWidths = { id: 3, risk: 6, status: 12, name: 40, commit: 8 };
  const header = pad('ID', colWidths.id) + '  ' + pad('RISK', colWidths.risk) + '  ' + pad('STATUS', colWidths.status) + '  ' + pad('NAME', colWidths.name) + '  COMMIT';
  lines.push(header);
  lines.push('-'.repeat(header.length));
  for (const t of tasks) {
    lines.push(
      pad(t.id, colWidths.id) + '  ' +
      pad(t.risk, colWidths.risk) + '  ' +
      pad(t.status, colWidths.status) + '  ' +
      pad(t.name, colWidths.name) + '  ' +
      (t.commit || '—')
    );
  }

  lines.push('');
  lines.push('Project updates:');
  for (const u of updates) {
    const flag = u.blocked ? ' [BLOCKED]' : '';
    lines.push(`  ${u.timestamp}${flag}  ${u.message}`);
  }

  return lines.join('\n');
}

function pad(s: string | number, width: number): string {
  const str = String(s);
  return str.length >= width ? str.slice(0, width) : str + ' '.repeat(width - str.length);
}

// CLI entrypoint
if (require.main === module) {
  const args = process.argv.slice(2);
  const planIdx = args.indexOf('--plan');

  if (planIdx === -1) {
    console.error('Usage: node show.js --plan <N>');
    process.exit(1);
  }

  const planNum = parseInt(args[planIdx + 1], 10);
  const xmlPath = path.join('.agents', 'plans', `plan-${planNum}-tasks.xml`);
  const xml = fs.readFileSync(xmlPath, 'utf-8');
  console.log(formatPlanSummary(xml));
}
