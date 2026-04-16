import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

// Integration test: validate all existing plan XML files against the XSD.
// This test must fail (red) until the XSD file exists.

const XSD_PATH = path.resolve(__dirname, '../../../main/scripts/tasks/plan-tasks.xsd');
const PLANS_DIR = path.resolve(__dirname, '../../../../../../.agents/plans');

function validateXml(xmlPath: string): { valid: boolean; error: string } {
  try {
    execFileSync('xmllint', ['--schema', XSD_PATH, '--noout', xmlPath], {
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    return { valid: true, error: '' };
  } catch (e: unknown) {
    const err = e as { stderr?: Buffer };
    return { valid: false, error: err.stderr?.toString() ?? String(e) };
  }
}

test('XSD file exists', () => {
  assert.ok(existsSync(XSD_PATH), `XSD not found at ${XSD_PATH}`);
});

test('all existing plan task XML files are valid against the XSD', () => {
  const xmlFiles = readdirSync(PLANS_DIR)
    .filter(f => /^plan-\d+-tasks\.xml$/.test(f))
    .map(f => path.join(PLANS_DIR, f));

  assert.ok(xmlFiles.length > 0, 'No plan task XML files found');

  for (const xmlFile of xmlFiles) {
    const result = validateXml(xmlFile);
    assert.ok(result.valid, `${path.basename(xmlFile)} failed XSD validation:\n${result.error}`);
  }
});
