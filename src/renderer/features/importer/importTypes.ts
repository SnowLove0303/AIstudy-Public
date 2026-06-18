import type { KnowledgeDocumentSnapshot } from "../documents/knowledgeDocumentTypes";

export type ImportSourceKind = "file";

export type ImportTargetKind = "current-node-document";

export type ImportBlockKind = "heading" | "paragraph";

export type ImportBlock = {
  id: string;
  kind: ImportBlockKind;
  text: string;
  level?: number;
};

export type ImportPackage = {
  schemaVersion: 1;
  source: {
    kind: ImportSourceKind;
    fileName: string;
    fileType: string;
    byteSize: number;
    importedAt: string;
  };
  target: {
    kind: ImportTargetKind;
    courseId: string;
    mindMapId: string;
    nodeId: string;
    title: string;
  };
  blocks: ImportBlock[];
  summary: {
    title: string;
    blockCount: number;
    characterCount: number;
  };
};

export type ImportPreview = {
  package: ImportPackage;
  snapshot: KnowledgeDocumentSnapshot;
};

export type ImportTargetContext = {
  courseId: string;
  mindMapId: string;
  nodeId: string;
  title: string;
};
