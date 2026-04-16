"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePlanXml = parsePlanXml;
exports.serializePlanXml = serializePlanXml;
const fast_xml_parser_1 = require("fast-xml-parser");
const PARSER = new fast_xml_parser_1.XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => ['task', 'comment', 'deviation', 'update'].includes(name),
    allowBooleanAttributes: true,
});
const BUILDER = new fast_xml_parser_1.XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    suppressEmptyNode: false,
    suppressBooleanAttributes: false,
    format: true,
    indentBy: '  ',
});
// ── Parse ────────────────────────────────────────────────────────────────────
function parsePlanXml(xml) {
    const raw = PARSER.parse(xml);
    const root = raw['plan-tasks'];
    const planNum = Number(root['@_plan']);
    const planVersion = String(root['@_plan-version']);
    const rawMeta = root['metadata'];
    const metadata = {
        backlogIssue: String(rawMeta['backlog-issue']),
        status: String(rawMeta['status']),
        created: String(rawMeta['created']),
    };
    const rawTasks = root['tasks']['task'] ?? [];
    const tasks = rawTasks.map(parseTask);
    const rawUpdates = root['project-updates']['update'] ?? [];
    const projectUpdates = rawUpdates.map(parseUpdate);
    return { planNum, planVersion, metadata, tasks, projectUpdates };
}
function parseTask(raw) {
    const t = raw;
    const rawComments = t['comments'];
    const commentList = rawComments?.['comment'] ?? [];
    const rawDeviations = t['deviations'];
    const deviationList = rawDeviations?.['deviation'] ?? [];
    return {
        id: Number(t['@_id']),
        risk: String(t['@_risk']),
        status: String(t['@_status']),
        name: String(t['name']),
        commit: t['commit'] != null ? String(t['commit']) : '',
        createdFrom: t['created-from'] != null ? String(t['created-from']) : '',
        closedAtVersion: t['closed-at-version'] != null ? String(t['closed-at-version']) : '',
        comments: commentList.map(parseComment),
        deviations: deviationList.map(parseDeviation),
    };
}
function parseComment(raw) {
    const c = raw;
    return {
        timestamp: String(c['@_timestamp']),
        message: String(c['#text'] ?? ''),
    };
}
function parseDeviation(raw) {
    const d = raw;
    return {
        type: String(d['@_type']),
        timestamp: String(d['@_timestamp']),
        message: String(d['#text'] ?? ''),
    };
}
function parseUpdate(raw) {
    const u = raw;
    return {
        timestamp: String(u['@_timestamp']),
        blocked: u['@_blocked'] === true || u['@_blocked'] === 'true',
        message: String(u['#text'] ?? ''),
    };
}
// ── Serialize ────────────────────────────────────────────────────────────────
function serializePlanXml(plan) {
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
    return BUILDER.build(obj);
}
function serializeTask(task) {
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
function serializeComment(c) {
    return {
        '@_timestamp': c.timestamp,
        '#text': c.message,
    };
}
function serializeDeviation(d) {
    return {
        '@_type': d.type,
        '@_timestamp': d.timestamp,
        '#text': d.message,
    };
}
function serializeUpdate(u) {
    const obj = {
        '@_timestamp': u.timestamp,
        '#text': u.message,
    };
    if (u.blocked) {
        obj['@_blocked'] = 'true';
    }
    return obj;
}
