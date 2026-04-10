import * as fs from 'node:fs';
import * as path from 'node:path';

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function assertTaskExists(xml: string, taskId: number): void {
  if (!new RegExp(`<task\\s[^>]*id="${taskId}"`).test(xml)) {
    throw new Error(`Task ${taskId} not found in XML`);
  }
}

export function addComment(xml: string, taskId: number, message: string, timestamp: string): string {
  assertTaskExists(xml, taskId);
  const entry = `<comment timestamp="${timestamp}">${escapeXml(message)}</comment>`;
  return xml.replace(
    new RegExp(`(<task\\s[^>]*id="${taskId}"[\\s\\S]*?<comments>)(</comments>|([\\s\\S]*?))(</comments>)`),
    (_match, open, _body, _inner, close) => {
      const existing = _body === '</comments>' ? '' : _body;
      return `${open}${existing}\n        ${entry}\n      ${close}`;
    }
  );
}

// CLI entrypoint
if (require.main === module) {
  const args = process.argv.slice(2);
  const planIdx = args.indexOf('--plan');
  const taskIdx = args.indexOf('--task');
  const msgIdx = args.indexOf('--message');

  if (planIdx === -1 || taskIdx === -1 || msgIdx === -1) {
    console.error('Usage: node add-comment.js --plan <N> --task <id> --message <text>');
    process.exit(1);
  }

  const planNum = parseInt(args[planIdx + 1], 10);
  const taskId = parseInt(args[taskIdx + 1], 10);
  const message = args[msgIdx + 1];
  const timestamp = new Date().toISOString();

  const xmlPath = path.join('.agents', 'plans', `plan-${planNum}-tasks.xml`);
  const xml = fs.readFileSync(xmlPath, 'utf-8');
  const updated = addComment(xml, taskId, message, timestamp);
  fs.writeFileSync(xmlPath, updated, 'utf-8');
  console.log(`Comment added to task ${taskId}`);
}
