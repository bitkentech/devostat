import * as fs from 'node:fs';
import * as path from 'node:path';
import { PlanMetadata } from './types';

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function projectUpdate(
  xml: string,
  message: string,
  blocked: boolean,
  timestamp: string,
  newStatus?: PlanMetadata['status'],
): string {
  const blockedAttr = blocked ? ` blocked="true"` : '';
  const entry = `<update timestamp="${timestamp}"${blockedAttr}>${escapeXml(message)}</update>`;

  let result = xml.replace(
    /(<project-updates>)([\s\S]*?)(<\/project-updates>)/,
    (_match, open, body, close) => `${open}${body}    ${entry}\n  ${close}`
  );

  if (newStatus) {
    result = result.replace(/<status>[^<]*<\/status>/, `<status>${newStatus}</status>`);
  }

  return result;
}

// CLI entrypoint
if (require.main === module) {
  const args = process.argv.slice(2);
  const planIdx = args.indexOf('--plan');
  const msgIdx = args.indexOf('--message');
  const statusIdx = args.indexOf('--status');
  const blockedFlag = args.includes('--blocked');

  if (planIdx === -1 || msgIdx === -1) {
    console.error('Usage: node project-update.js --plan <N> --message <text> [--blocked] [--status <status>]');
    process.exit(1);
  }

  const planNum = parseInt(args[planIdx + 1], 10);
  const message = args[msgIdx + 1];
  const newStatus = statusIdx !== -1 ? args[statusIdx + 1] as PlanMetadata['status'] : undefined;
  const timestamp = new Date().toISOString();

  const xmlPath = path.join('.agents', 'plans', `plan-${planNum}-tasks.xml`);
  const xml = fs.readFileSync(xmlPath, 'utf-8');
  const updated = projectUpdate(xml, message, blockedFlag, timestamp, newStatus);
  fs.writeFileSync(xmlPath, updated, 'utf-8');
  console.log(`Project update added${newStatus ? ` (status → ${newStatus})` : ''}`);
}
