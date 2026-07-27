import React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type WorkspacePaneControlsProps = {
  libraryCollapsed: boolean;
  catalogCollapsed: boolean;
  onToggleLibrary: () => void;
  onToggleCatalog: () => void;
};

export function WorkspacePaneControls({
  libraryCollapsed,
  catalogCollapsed,
  onToggleLibrary,
  onToggleCatalog
}: WorkspacePaneControlsProps) {
  return (
    <div className="workspace-pane-controls" aria-label="工作区目录">
      <button
        className={`pane-collapse-button library-toggle${libraryCollapsed ? " collapsed" : ""}`}
        title={libraryCollapsed ? "展开知识库" : "收起知识库"}
        aria-label={libraryCollapsed ? "展开知识库" : "收起知识库"}
        type="button"
        onClick={onToggleLibrary}
      >
        {libraryCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
      </button>
      <button
        className={`pane-collapse-button catalog-toggle-button${catalogCollapsed ? " collapsed" : ""}`}
        title={catalogCollapsed ? "展开目录" : "收起目录"}
        aria-label={catalogCollapsed ? "展开目录" : "收起目录"}
        type="button"
        onClick={onToggleCatalog}
      >
        {catalogCollapsed ? <ChevronLeft size={15} /> : <ChevronRight size={15} />}
      </button>
    </div>
  );
}
