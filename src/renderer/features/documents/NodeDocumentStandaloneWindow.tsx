import React from "react";
import { FileText, Layout, X } from "lucide-react";
import { KnowledgeDocumentWorkspace } from "./KnowledgeDocumentWorkspace";
import { drainBeforeCloseSaves } from "../../lib/saveDrain";

export function NodeDocumentStandaloneWindow() {
  const params = React.useMemo(() => new URLSearchParams(window.location.search), []);
  const initialCourseId = params.get("courseId") || "";
  const initialMindMapId = params.get("mindMapId") || initialCourseId;
  const initialNodeId = params.get("nodeId") || "";
  const initialNodeTitle = params.get("nodeTitle") || "节点文档";

  const [courseId, setCourseId] = React.useState(initialCourseId);
  const [mindMapId, setMindMapId] = React.useState(initialMindMapId);
  const [selectedNode, setSelectedNode] = React.useState<{ id: string | null; title: string }>({
    id: initialNodeId,
    title: initialNodeTitle
  });
  const [isFormatOpen, setIsFormatOpen] = React.useState(false);

  React.useEffect(() => {
    return window.aistudyKnowledgeDocuments?.onSwitchNode?.((target: { courseId?: string; mindMapId?: string; nodeId?: string; nodeTitle?: string }) => {
      if (target && target.nodeId) {
        if (target.courseId) setCourseId(target.courseId);
        if (target.mindMapId) setMindMapId(target.mindMapId);
        setSelectedNode({ id: target.nodeId, title: target.nodeTitle || "节点文档" });
      }
    });
  }, []);

  React.useEffect(() => {
    const unregister = window.aistudyLifecycle?.onBeforeClose?.(() => drainBeforeCloseSaves());
    const handleBeforeUnload = () => void drainBeforeCloseSaves();
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      unregister?.();
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  const handleClose = async () => {
    await drainBeforeCloseSaves();
    window.aistudyWindow?.close?.();
  };

  return (
    <div className="standalone-doc-window">
      <header className="standalone-doc-window-header">
        <div className="standalone-doc-title">
          <FileText size={16} />
          <span>{selectedNode.title || "节点文档"}</span>
          <span className="standalone-doc-title-badge">独立视窗</span>
        </div>
        <div className="standalone-doc-actions">
          <button
            type="button"
            className={isFormatOpen ? "standalone-doc-btn active" : "standalone-doc-btn"}
            onClick={() => setIsFormatOpen((prev) => !prev)}
            title={isFormatOpen ? "收起排版面板" : "展开排版面板"}
          >
            <Layout size={14} />
            <span>{isFormatOpen ? "收起排版" : "排版"}</span>
          </button>
          <button
            type="button"
            className="standalone-doc-btn danger"
            onClick={handleClose}
            title="保存并关闭视窗"
          >
            <X size={14} />
            <span>关闭</span>
          </button>
        </div>
      </header>
      <main className="standalone-doc-body">
        <div className="standalone-doc-editor-wrap">
          <KnowledgeDocumentWorkspace
            courseId={courseId}
            mindMapId={mindMapId}
            selectedNode={selectedNode}
            outline={[]}
            externalChangeRevision={0}
            onNodeSelect={() => undefined}
            detailPaneMode={isFormatOpen ? "format" : "catalog"}
            onOpenFormatPane={() => setIsFormatOpen(true)}
            onCloseFormatPane={() => setIsFormatOpen(false)}
          />
        </div>
        <aside
          className="standalone-doc-format-drawer"
          style={{ display: isFormatOpen ? "block" : "none" }}
        >
          <div id="document-format-panel-slot" className="document-format-panel-slot" />
        </aside>
      </main>
    </div>
  );
}
