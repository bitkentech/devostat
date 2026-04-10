import * as fs from 'node:fs';
import * as path from 'node:path';
import { TaskStatus } from './types';

const VALID_STATUSES: TaskStatus[] = [
  'pending', 'in-progress', 'de-risked', 'agent-coded',
  'closed', 'needs-triage', 'abandoned',
];

export function updateTaskStatus(
  xml: string,
  taskId: number,
  status: TaskStatus,
  closedAtVersion: string,
): string {
  if (!VALID_STATUSES.includes(status)) {
    throw new Error(`Invalid status: "${status}". Must be one of: ${VALID_STATUSES.join(', ')}`);
  }

  // Match the opening <task> tag for this id
  const tagPattern = new RegExp(`(<task\\s[^>]*id="${taskId}"[^>]*)status="[^"]*"`, 's');
  if (!tagPattern.test(xml)) {
    throw new Error(`Task ${taskId} not found in XML`);
  }

  let result = xml.replace(tagPattern, `$1status="${status}"`);

  if (status === 'closed' && closedAtVersion) {
    // Update <closed-at-version> within this task's block only
    result = replaceInTaskBlock(result, taskId, /<closed-at-version>[^<]*<\/closed-at-version>/, `<closed-at-version>${closedAtVersion}</closed-at-version>`);
  }

  return result;
}

function replaceInTaskBlock(xml: string, taskId: number, pattern: RegExp, replacement: string): string {
  // Find the task block and apply replacement only within it
  const blockPattern = new RegExp(`(<task\\s[^>]*id="${taskId}"[^>]*>[\\s\\S]*?</task>)`);
  return xml.replace(blockPattern, (block) => block.replace(pattern, replacement));
}

// CLI entrypoint
if (require.main === module) {
  const args = process.argv.slice(2);
  const planIdx = args.indexOf('--plan');
  const taskIdx = args.indexOf('--task');
  const statusIdx = args.indexOf('--status');
  const versionIdx = args.indexOf('--version');

  if (planIdx === -1 || taskIdx === -1 || statusIdx === -1) {
    console.error('Usage: node update-status.js --plan <N> --task <id> --status <status> [--version <plan-version>]');
    process.exit(1);
  }

  const planNum = parseInt(args[planIdx + 1], 10);
  const taskId = parseInt(args[taskIdx + 1], 10);
  const status = args[statusIdx + 1] as TaskStatus;
  const closedAtVersion = versionIdx !== -1 ? args[versionIdx + 1] : '';

  const xmlPath = path.join('.agents', 'plans', `plan-${planNum}-tasks.xml`);
  const xml = fs.readFileSync(xmlPath, 'utf-8');
  const updated = updateTaskStatus(xml, taskId, status, closedAtVersion);
  fs.writeFileSync(xmlPath, updated, 'utf-8');
  console.log(`Task ${taskId} status set to "${status}"`);
}
