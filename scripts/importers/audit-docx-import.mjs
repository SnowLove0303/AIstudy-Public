import fs from "node:fs/promises";
import path from "node:path";
import mysql from "mysql2/promise";
import {
  DEFAULT_COURSE,
  DEFAULT_DOCX,
  calculateAccuracy,
  cleanParagraphs,
  createDocumentSnapshot,
  loadMysqlConfig,
  loadTargetGraph,
  normalizeText,
  parseDocxParagraphs,
  segmentContent,
  splitSentences
} from "./import-docx-to-node-documents.mjs";

const MIN_SENTENCE_COVERAGE = 0.95;

function readArg(name, fallback = "") {
  const exact = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (exact) return exact.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
}

function normalizeComparableText(value) {
  return normalizeText(value)
    .replace(/^（\d+）/gm, "")
    .replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, "")
    .toLowerCase();
}

function snapshotText(snapshot) {
  return (snapshot.content?.main ?? [])
    .map((element) => (typeof element?.value === "string" ? element.value : ""))
    .join("");
}

function normalizeSnapshotForCompare(snapshot) {
  return {
    schemaVersion: snapshot.schemaVersion,
    editor: snapshot.editor,
    editorVersion: snapshot.editorVersion,
    content: snapshot.content
  };
}

function collectExpectedSentences(lines) {
  return lines
    .flatMap((line) => splitSentences(line))
    .map((line) => normalizeComparableText(line))
    .filter((line) => line.length >= 6);
}

function countStyles(snapshot) {
  const profile = new Map();
  for (const element of snapshot.content?.main ?? []) {
    if (!element || typeof element.value !== "string" || !element.value.trim()) continue;
    const key = JSON.stringify({
      size: element.size ?? null,
      bold: Boolean(element.bold),
      color: element.color ?? null
    });
    profile.set(key, (profile.get(key) ?? 0) + 1);
  }
  return [...profile.entries()]
    .map(([key, count]) => ({ ...JSON.parse(key), count }))
    .sort((left, right) => right.count - left.count);
}

function detectFormatIssues(snapshot) {
  const issues = [];
  for (const element of snapshot.content?.main ?? []) {
    if (!element || typeof element.value !== "string" || !element.value.trim()) continue;
    if (element.bold) {
      const okHeading =
        (element.size === 26 && ["#ea580c", "#7c3aed"].includes(element.color)) ||
        (element.size === 24 && ["#2563eb", "#111827", "rgb(17, 24, 39)"].includes(element.color));
      if (!okHeading) issues.push({ text: element.value.slice(0, 30), size: element.size, bold: element.bold, color: element.color });
      continue;
    }
    if (element.size !== 24 || !["#111827", "rgb(17, 24, 39)"].includes(element.color)) {
      issues.push({ text: element.value.slice(0, 30), size: element.size, bold: element.bold, color: element.color });
    }
  }
  return issues;
}

async function main() {
  const filePath = path.resolve(readArg("file", DEFAULT_DOCX));
  const courseName = readArg("course", DEFAULT_COURSE);
  const config = await loadMysqlConfig();
  const connection = await mysql.createConnection(config);

  try {
    const raw = await parseDocxParagraphs(filePath);
    const clean = cleanParagraphs(raw);
    const graph = await loadTargetGraph(connection, courseName);
    const segmented = segmentContent(clean.kept, graph.nodes);
    const accuracy = calculateAccuracy(segmented.segments, segmented.headingCandidates, segmented.unmatchedHeadings);
    const nodeIds = segmented.segments.map((segment) => segment.node.nodeId);

    const [documentRows] = await connection.query(
      `SELECT d.node_id AS nodeId, d.title, d.current_byte_size AS byteSize, d.has_content AS hasContent, s.payload_json AS payloadJson
       FROM knowledge_documents d
       JOIN knowledge_document_snapshots s ON s.id = d.current_snapshot_id
       WHERE d.course_id = ? AND d.mind_map_id = ? AND d.node_id IN (?)`,
      [graph.course.id, graph.map.id, nodeIds]
    );
    const documents = new Map(documentRows.map((row) => [row.nodeId, row]));

    const targetReports = segmented.segments.map((segment) => {
      const row = documents.get(segment.node.nodeId);
      const expectedSnapshot = createDocumentSnapshot(segment.lines);
      if (!row) {
        return {
          nodeId: segment.node.nodeId,
          title: segment.node.title,
          found: false,
          sentenceCoverage: 0,
          snapshotMatchesExpected: false,
          missingSentences: collectExpectedSentences(segment.lines).slice(0, 8),
          noiseHits: [],
          formatIssues: []
        };
      }
      const actualSnapshot = JSON.parse(row.payloadJson);
      const actualText = normalizeComparableText(snapshotText(actualSnapshot));
      const expectedSentences = collectExpectedSentences(segment.lines);
      const missingSentences = expectedSentences.filter((sentence) => !actualText.includes(sentence));
      const plainActual = snapshotText(actualSnapshot);
      const noiseHits = ["典型", "真题", "单选题", "多选题", "【答案】", "【解析】"].filter((pattern) => plainActual.includes(pattern));
      return {
        nodeId: segment.node.nodeId,
        title: segment.node.title,
        found: true,
        byteSize: row.byteSize,
        sentenceCoverage: expectedSentences.length
          ? Number(((expectedSentences.length - missingSentences.length) / expectedSentences.length).toFixed(4))
          : 1,
        snapshotMatchesExpected:
          JSON.stringify(normalizeSnapshotForCompare(actualSnapshot)) ===
          JSON.stringify(normalizeSnapshotForCompare(expectedSnapshot)),
        missingSentences: missingSentences.slice(0, 8),
        noiseHits,
        formatIssues: detectFormatIssues(actualSnapshot).slice(0, 8)
      };
    });

    const [referenceRows] = await connection.query(
      `SELECT s.payload_json AS payloadJson
       FROM knowledge_documents d
       JOIN knowledge_document_snapshots s ON s.id = d.current_snapshot_id
       JOIN mind_map_nodes n ON n.node_id = d.node_id AND n.course_id = d.course_id AND n.mind_map_id = d.mind_map_id
       WHERE d.course_id = ? AND d.mind_map_id = ? AND d.has_content = 1
         AND n.path_text LIKE '%第四章 股票%'
         AND d.node_id NOT IN (?)
       ORDER BY d.updated_at DESC
       LIMIT 30`,
      [graph.course.id, graph.map.id, nodeIds]
    );
    const importedStyleProfile = countStyles(createDocumentSnapshot(segmented.segments.flatMap((segment) => segment.lines)));
    const referenceStyleProfile = referenceRows.flatMap((row) => countStyles(JSON.parse(row.payloadJson))).slice(0, 16);

    const failedTargets = targetReports.filter(
      (target) =>
        !target.found ||
        !target.snapshotMatchesExpected ||
        target.sentenceCoverage < MIN_SENTENCE_COVERAGE ||
        target.noiseHits.length > 0 ||
        target.formatIssues.length > 0
    );

    const report = {
      file: filePath,
      course: graph.course.name,
      mindMapId: graph.map.id,
      rawParagraphs: raw.length,
      keptParagraphs: clean.kept.length,
      removedParagraphs: clean.removed.length,
      accuracy: Number(accuracy.toFixed(4)),
      targets: targetReports.length,
      failedTargets: failedTargets.length,
      minSentenceCoverage: Math.min(...targetReports.map((target) => target.sentenceCoverage)),
      unmatchedHeadingSamples: segmented.unmatchedHeadings.slice(0, 20),
      importedStyleProfile: importedStyleProfile.slice(0, 8),
      referenceStyleProfile: referenceStyleProfile.slice(0, 8),
      failures: failedTargets.slice(0, 12)
    };

    console.log(JSON.stringify(report, null, 2));
    if (failedTargets.length > 0) process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

await main();
