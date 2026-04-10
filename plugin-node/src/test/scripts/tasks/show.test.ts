import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPlanSummary } from '../../../main/scripts/tasks/show';

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<plan-tasks plan="13" plan-version="plan-13-v2">
  <metadata>
    <backlog-issue>PB-221</backlog-issue>
    <status>active</status>
    <created>2026-04-10</created>
  </metadata>

  <tasks>
  <task id="1" risk="high" status="agent-coded">
    <name>Task one</name>
    <commit>abc1234</commit>
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
    <update timestamp="2026-04-10T12:00:00.000Z">Task 1 de-risked.</update>
  </project-updates>
</plan-tasks>
`;

test('formatPlanSummary includes plan number and version', () => {
  const out = formatPlanSummary(SAMPLE_XML);
  assert.match(out, /plan-13/i);
  assert.match(out, /plan-13-v2/);
});

test('formatPlanSummary lists all tasks with id, status, and name', () => {
  const out = formatPlanSummary(SAMPLE_XML);
  assert.match(out, /1.*agent-coded.*Task one/i);
  assert.match(out, /2.*pending.*Task two/i);
});

test('formatPlanSummary shows metadata status', () => {
  const out = formatPlanSummary(SAMPLE_XML);
  assert.match(out, /active/);
});

test('formatPlanSummary includes recent project updates', () => {
  const out = formatPlanSummary(SAMPLE_XML);
  assert.match(out, /Plan initialised\./);
  assert.match(out, /Task 1 de-risked\./);
});
