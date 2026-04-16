import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import {
  PlanTasks, PlanTask, PlanMetadata, Comment, Deviation, ProjectUpdate,
  TaskStatus, RiskLevel,
} from './types';

const PARSER = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  isArray: (name) => ['task', 'comment', 'deviation', 'update'].includes(name),
  allowBooleanAttributes: true,
});

const BUILDER = new XMLBuilder({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  suppressEmptyNode: false,
  format: true,
  indentBy: '  ',
});

// ── Parse ────────────────────────────────────────────────────────────────────

export function parsePlanXml(xml: string): PlanTasks {
  const raw = PARSER.parse(xml);
  const root = raw['plan-tasks'];

  const planNum = Number(root['@_plan']);
  const planVersion = String(root['@_plan-version']);

  const rawMeta = root['metadata'];
  const metadata: PlanMetadata = {
    backlogIssue: String(rawMeta['backlog-issue']),
    status: String(rawMeta['status']) as PlanMetadata['status'],
    created: String(rawMeta['created']),
  };

  const rawTasks: unknown[] = root['tasks']['task'] ?? [];
  const tasks: PlanTask[] = rawTasks.map(parseTask);

  const rawUpdates: unknown[] = root['project-updates']['update'] ?? [];
  const projectUpdates: ProjectUpdate[] = rawUpdates.map(parseUpdate);

  return { planNum, planVersion, metadata, tasks, projectUpdates };
}

function parseTask(raw: unknown): PlanTask {
  const t = raw as Record<string, unknown>;
  const rawComments = (t['comments'] as Record<string, unknown> | undefined);
  const commentList: unknown[] = (rawComments?.['comment'] as unknown[] | undefined) ?? [];

  const rawDeviations = (t['deviations'] as Record<string, unknown> | undefined);
  const deviationList: unknown[] = (rawDeviations?.['deviation'] as unknown[] | undefined) ?? [];

  return {
    id: Number(t['@_id']),
    risk: String(t['@_risk']) as RiskLevel,
    status: String(t['@_status']) as TaskStatus,
    name: String(t['name']),
    commit: t['commit'] != null ? String(t['commit']) : '',
    createdFrom: t['created-from'] != null ? String(t['created-from']) : '',
    closedAtVersion: t['closed-at-version'] != null ? String(t['closed-at-version']) : '',
    comments: commentList.map(parseComment),
    deviations: deviationList.map(parseDeviation),
  };
}

function parseComment(raw: unknown): Comment {
  const c = raw as Record<string, unknown>;
  return {
    timestamp: String(c['@_timestamp']),
    message: String(c['#text'] ?? ''),
  };
}

function parseDeviation(raw: unknown): Deviation {
  const d = raw as Record<string, unknown>;
  return {
    type: String(d['@_type']) as 'minor' | 'major',
    timestamp: String(d['@_timestamp']),
    message: String(d['#text'] ?? ''),
  };
}

function parseUpdate(raw: unknown): ProjectUpdate {
  const u = raw as Record<string, unknown>;
  return {
    timestamp: String(u['@_timestamp']),
    blocked: u['@_blocked'] === true || u['@_blocked'] === 'true',
    message: String(u['#text'] ?? ''),
  };
}

// ── Serialize ────────────────────────────────────────────────────────────────

export function serializePlanXml(plan: PlanTasks): string {
  const obj = {
    '?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },
    'plan-tasks': {
      '@_plan': plan.planNum,
      '@_plan-version': plan.planVersion,
      'metadata': {
        'backlog-issue': plan.metadata.backlogIssue,
        'status': plan.metadata.status,
        'created': plan.metadata.created,
      },
      'tasks': {
        'task': plan.tasks.map(serializeTask),
      },
      'project-updates': {
        'update': plan.projectUpdates.map(serializeUpdate),
      },
    },
  };
  return BUILDER.build(obj) as string;
}

function serializeTask(task: PlanTask): Record<string, unknown> {
  return {
    '@_id': task.id,
    '@_risk': task.risk,
    '@_status': task.status,
    'name': task.name,
    'commit': task.commit,
    'created-from': task.createdFrom,
    'closed-at-version': task.closedAtVersion,
    'comments': task.comments.length > 0
      ? { 'comment': task.comments.map(serializeComment) }
      : '',
    'deviations': task.deviations.length > 0
      ? { 'deviation': task.deviations.map(serializeDeviation) }
      : '',
  };
}

function serializeComment(c: Comment): Record<string, unknown> {
  return {
    '@_timestamp': c.timestamp,
    '#text': c.message,
  };
}

function serializeDeviation(d: Deviation): Record<string, unknown> {
  return {
    '@_type': d.type,
    '@_timestamp': d.timestamp,
    '#text': d.message,
  };
}

function serializeUpdate(u: ProjectUpdate): Record<string, unknown> {
  const obj: Record<string, unknown> = {
    '@_timestamp': u.timestamp,
    '#text': u.message,
  };
  if (u.blocked) {
    obj['@_blocked'] = true;
  }
  return obj;
}
