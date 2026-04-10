import { test } from 'node:test';
import assert from 'node:assert/strict';
import { updateTaskStatus } from '../../../main/scripts/tasks/update-status';

const BASE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<plan-tasks plan="13" plan-version="plan-13-v1">
  <metadata>
    <backlog-issue>PB-221</backlog-issue>
    <status>active</status>
    <created>2026-04-10</created>
  </metadata>

  <tasks>
  <task id="1" risk="high" status="pending">
    <name>Task one</name>
    <commit></commit>
    <created-from>plan-13-v1</created-from>
    <closed-at-version></closed-at-version>
    <comments></comments>
    <deviations></deviations>
  </task>
  <task id="2" risk="low" status="pending">
    <name>Task two</name>
    <commit></commit>
    <created-from>plan-13-v1</created-from>
    <closed-at-version></closed-at-version>
    <comments></comments>
    <deviations></deviations>
  </task>
  </tasks>

  <project-updates>
    <update timestamp="2026-04-10T10:00:00.000Z">Plan initialised.</update>
  </project-updates>
</plan-tasks>
`;

test('updateTaskStatus sets status on correct task', () => {
  const result = updateTaskStatus(BASE_XML, 1, 'in-progress', '');
  assert.match(result, /id="1"[^>]*status="in-progress"/);
});

test('updateTaskStatus does not affect other tasks', () => {
  const result = updateTaskStatus(BASE_XML, 1, 'in-progress', '');
  assert.match(result, /id="2"[^>]*status="pending"/);
});

test('updateTaskStatus sets closed-at-version when status is closed', () => {
  const result = updateTaskStatus(BASE_XML, 1, 'closed', 'plan-13-v2');
  assert.match(result, /<closed-at-version>plan-13-v2<\/closed-at-version>/);
});

test('updateTaskStatus leaves closed-at-version empty for non-closed status', () => {
  const result = updateTaskStatus(BASE_XML, 1, 'agent-coded', '');
  // The first task's closed-at-version should still be empty
  const task1Block = result.match(/<task id="1"[\s\S]*?<\/task>/)?.[0] ?? '';
  assert.match(task1Block, /<closed-at-version><\/closed-at-version>/);
});

test('updateTaskStatus throws on unknown task id', () => {
  assert.throws(
    () => updateTaskStatus(BASE_XML, 99, 'in-progress', ''),
    /task 99 not found/i
  );
});

test('updateTaskStatus throws on invalid status', () => {
  assert.throws(
    () => updateTaskStatus(BASE_XML, 1, 'invalid-status' as never, ''),
    /invalid status/i
  );
});
