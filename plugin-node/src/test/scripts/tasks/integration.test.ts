/**
 * Integration test: exercises all 5 mutation scripts end-to-end via xml-utils.
 * These tests must fail (red) before any implementation is written.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePlanXml, serializePlanXml } from '../../../main/scripts/tasks/xml-utils';
import { updateTaskStatus } from '../../../main/scripts/tasks/update-status';
import { setCommit } from '../../../main/scripts/tasks/set-commit';
import { addComment } from '../../../main/scripts/tasks/add-comment';
import { addDeviation } from '../../../main/scripts/tasks/add-deviation';
import { projectUpdate } from '../../../main/scripts/tasks/project-update';

const INTEGRATION_XML = `<?xml version="1.0" encoding="UTF-8"?>
<plan-tasks plan="99" plan-version="plan-99-v1">
  <metadata>
    <backlog-issue>PB-999</backlog-issue>
    <status>active</status>
    <created>2026-04-16</created>
  </metadata>

  <tasks>
  <task id="1" risk="high" status="pending">
    <name>Integration task</name>
    <commit></commit>
    <created-from>plan-99-v1</created-from>
    <closed-at-version></closed-at-version>
    <comments></comments>
    <deviations></deviations>
  </task>
  </tasks>

  <project-updates>
    <update timestamp="2026-04-16T10:00:00.000Z">Plan initialised.</update>
  </project-updates>
</plan-tasks>
`;

test('integration: full mutation pipeline preserves all fields', () => {
  // 1. Parse the XML into a typed object
  const plan = parsePlanXml(INTEGRATION_XML);
  assert.equal(plan.planNum, 99);
  assert.equal(plan.tasks.length, 1);
  assert.equal(plan.tasks[0].status, 'pending');

  // 2. Run all mutations through the string-based API (which must now use xml-utils internally)
  let xml = INTEGRATION_XML;
  xml = updateTaskStatus(xml, 1, 'in-progress', '');
  xml = setCommit(xml, 1, 'deadbeef');
  xml = addComment(xml, 1, 'Looks good', '2026-04-16T11:00:00.000Z');
  xml = addDeviation(xml, 1, 'minor', 'Adjusted scope', '2026-04-16T11:01:00.000Z');
  xml = projectUpdate(xml, 'Phase 2 started', false, '2026-04-16T11:02:00.000Z');

  // 3. Parse the final result and assert all mutations landed
  const finalPlan = parsePlanXml(xml);
  const task = finalPlan.tasks[0];

  assert.equal(task.status, 'in-progress');
  assert.equal(task.commit, 'deadbeef');
  assert.equal(task.comments.length, 1);
  assert.equal(task.comments[0].message, 'Looks good');
  assert.equal(task.deviations.length, 1);
  assert.equal(task.deviations[0].type, 'minor');
  assert.equal(finalPlan.projectUpdates.length, 2);
});

test('integration: serializePlanXml round-trip preserves all field values', () => {
  const plan = parsePlanXml(INTEGRATION_XML);
  const reserialised = serializePlanXml(plan);
  const plan2 = parsePlanXml(reserialised);

  assert.equal(plan2.planNum, plan.planNum);
  assert.equal(plan2.planVersion, plan.planVersion);
  assert.equal(plan2.metadata.backlogIssue, plan.metadata.backlogIssue);
  assert.equal(plan2.metadata.status, plan.metadata.status);
  assert.equal(plan2.tasks.length, plan.tasks.length);
  assert.equal(plan2.tasks[0].name, plan.tasks[0].name);
  assert.equal(plan2.projectUpdates.length, plan.projectUpdates.length);
});
