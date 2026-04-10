import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setCommit } from '../../../main/scripts/tasks/set-commit';
import { projectUpdate } from '../../../main/scripts/tasks/project-update';

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
  </tasks>

  <project-updates>
    <update timestamp="2026-04-10T10:00:00.000Z">Plan initialised.</update>
  </project-updates>
</plan-tasks>
`;

// --- setCommit ---

test('setCommit updates commit element for correct task', () => {
  const result = setCommit(BASE_XML, 1, 'abc1234');
  const task1 = result.match(/<task id="1"[\s\S]*?<\/task>/)?.[0] ?? '';
  assert.match(task1, /<commit>abc1234<\/commit>/);
});

test('setCommit throws on unknown task id', () => {
  assert.throws(() => setCommit(BASE_XML, 99, 'abc1234'), /task 99 not found/i);
});

// --- projectUpdate ---

test('projectUpdate appends update entry', () => {
  const result = projectUpdate(BASE_XML, 'Ready for review', false, '2026-04-10T14:00:00.000Z');
  assert.match(result, /<update timestamp="2026-04-10T14:00:00.000Z">Ready for review<\/update>/);
});

test('projectUpdate preserves existing updates', () => {
  const result = projectUpdate(BASE_XML, 'New update', false, '2026-04-10T14:00:00.000Z');
  assert.match(result, /Plan initialised\./);
  assert.match(result, /New update/);
});

test('projectUpdate sets blocked attribute when blocked=true', () => {
  const result = projectUpdate(BASE_XML, 'Blocked on X', true, '2026-04-10T14:00:00.000Z');
  assert.match(result, /<update[^>]*blocked="true"[^>]*>Blocked on X<\/update>/);
});

test('projectUpdate omits blocked attribute when blocked=false', () => {
  const result = projectUpdate(BASE_XML, 'All good', false, '2026-04-10T14:00:00.000Z');
  const newEntry = result.match(/<update timestamp="2026-04-10T14:00:00.000Z"[^>]*>All good<\/update>/)?.[0] ?? '';
  assert.doesNotMatch(newEntry, /blocked/);
});

test('projectUpdate updates metadata status when provided', () => {
  const result = projectUpdate(BASE_XML, 'Done', false, '2026-04-10T14:00:00.000Z', 'complete');
  assert.match(result, /<status>complete<\/status>/);
});
