import React from "react";

type NodeDocumentTitleProps = {
  title: string;
};

export function normalizeNodeDocumentTitle(title: string) {
  return title.trim() || "未命名节点";
}

export function NodeDocumentTitle({ title }: NodeDocumentTitleProps) {
  const normalizedTitle = normalizeNodeDocumentTitle(title);

  return (
    <header className="document-node-title" aria-label="节点文档标题">
      <h1 title={normalizedTitle}>{normalizedTitle}</h1>
    </header>
  );
}
