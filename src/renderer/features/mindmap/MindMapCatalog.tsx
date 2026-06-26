import React from "react";
import { ChevronRight, Trash2 } from "lucide-react";
import type { MindMapOutlineItem } from "./mindMapTypes";

type MindMapCatalogProps = {
  items: MindMapOutlineItem[];
  selectedNodeId: string | null;
  resetKey: string;
  onNodeSelect?: (item: MindMapOutlineItem) => void;
  onNodeDelete?: (item: MindMapOutlineItem) => void;
};

type CatalogContextMenuState = {
  item: MindMapOutlineItem;
  x: number;
  y: number;
};

type CatalogRenderOptions = {
  selectedNodeId: string | null;
  collapsedPaths: ReadonlySet<string>;
  onToggle: (path: string) => void;
  onNodeSelect?: (item: MindMapOutlineItem) => void;
  onNodeContextMenu?: (event: React.MouseEvent<HTMLDivElement>, item: MindMapOutlineItem) => void;
};

function collectCollapsiblePaths(items: MindMapOutlineItem[], paths = new Set<string>()) {
  items.forEach((item) => {
    if (item.children.length > 0) {
      paths.add(item.path);
      collectCollapsiblePaths(item.children, paths);
    }
  });
  return paths;
}

function collectDefaultCollapsedPaths(items: MindMapOutlineItem[]) {
  const paths = new Set<string>();
  items.forEach((item) => {
    collectCollapsiblePaths(item.children, paths);
  });
  return paths;
}

function renderCatalogItems(items: MindMapOutlineItem[], options: CatalogRenderOptions) {
  return (
    <ol className="catalog-tree">
      {items.map((item) => {
        const hasChildren = item.children.length > 0;
        const isCollapsed = hasChildren && options.collapsedPaths.has(item.path);
        const isSelected = Boolean(options.selectedNodeId && item.nodeId === options.selectedNodeId);

        return (
          <li key={item.path} className="catalog-tree-item">
            <div
              className={isSelected ? "catalog-node selected" : "catalog-node"}
              style={{ paddingLeft: 8 + item.level * 14 }}
              data-catalog-source={item.source}
              data-catalog-path={item.path}
              data-catalog-parent-path={item.parentPath ?? ""}
              data-catalog-order={item.order}
              aria-level={item.level + 1}
              aria-expanded={hasChildren ? !isCollapsed : undefined}
              aria-current={isSelected ? "true" : undefined}
              role="treeitem"
              tabIndex={0}
              onClick={() => options.onNodeSelect?.(item)}
              onContextMenu={(event) => options.onNodeContextMenu?.(event, item)}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                options.onNodeSelect?.(item);
              }}
            >
              {hasChildren ? (
                <button
                  className={isCollapsed ? "catalog-toggle collapsed" : "catalog-toggle"}
                  type="button"
                  title={isCollapsed ? "展开" : "折叠"}
                  aria-label={`${isCollapsed ? "展开" : "折叠"} ${item.title}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    options.onToggle(item.path);
                  }}
                >
                  <ChevronRight size={14} />
                </button>
              ) : (
                <span className="catalog-toggle-placeholder" />
              )}
              <span className="catalog-node-mark" />
              <span className="catalog-node-title">{item.title}</span>
              {item.childCount > 0 ? <span className="catalog-node-count">{item.childCount}</span> : null}
            </div>
            {hasChildren && !isCollapsed ? renderCatalogItems(item.children, options) : null}
          </li>
        );
      })}
    </ol>
  );
}

export function MindMapCatalog({ items, selectedNodeId, resetKey, onNodeSelect, onNodeDelete }: MindMapCatalogProps) {
  const [collapsedPaths, setCollapsedPaths] = React.useState<Set<string>>(() => collectDefaultCollapsedPaths(items));
  const [contextMenu, setContextMenu] = React.useState<CatalogContextMenuState | null>(null);
  const knownCollapsiblePathsRef = React.useRef<Set<string>>(collectCollapsiblePaths(items));

  React.useEffect(() => {
    const validPaths = collectCollapsiblePaths(items);
    knownCollapsiblePathsRef.current = validPaths;
    setCollapsedPaths(collectDefaultCollapsedPaths(items));
    setContextMenu(null);
  }, [resetKey]);

  React.useEffect(() => {
    if (!contextMenu) return undefined;

    const closeMenu = () => setContextMenu(null);
    const closeMenuFromPointer = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest(".catalog-context-menu")) return;
      closeMenu();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeMenu();
    };

    document.addEventListener("mousedown", closeMenuFromPointer, true);
    document.addEventListener("contextmenu", closeMenu, true);
    document.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("resize", closeMenu);
    window.addEventListener("scroll", closeMenu, true);

    return () => {
      document.removeEventListener("mousedown", closeMenuFromPointer, true);
      document.removeEventListener("contextmenu", closeMenu, true);
      document.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("resize", closeMenu);
      window.removeEventListener("scroll", closeMenu, true);
    };
  }, [contextMenu]);

  React.useEffect(() => {
    const validPaths = collectCollapsiblePaths(items);
    const knownPaths = knownCollapsiblePathsRef.current;
    setCollapsedPaths((current) => {
      const next = new Set([...current].filter((path) => validPaths.has(path)));
      validPaths.forEach((path) => {
        if (!knownPaths.has(path)) {
          next.add(path);
        }
      });
      if (
        next.size === current.size &&
        [...next].every((path) => current.has(path))
      ) {
        return current;
      }
      return next;
    });
    knownCollapsiblePathsRef.current = validPaths;
  }, [items]);

  const togglePath = React.useCallback((path: string) => {
    setCollapsedPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const openContextMenu = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>, item: MindMapOutlineItem) => {
      if (!onNodeDelete || !item.nodeId || !item.parentNodeId) return;
      event.preventDefault();
      event.stopPropagation();
      onNodeSelect?.(item);
      const width = 178;
      const height = 42;
      setContextMenu({
        item,
        x: Math.max(8, Math.min(event.clientX, window.innerWidth - width - 8)),
        y: Math.max(8, Math.min(event.clientY, window.innerHeight - height - 8))
      });
    },
    [onNodeDelete, onNodeSelect]
  );

  const runDelete = React.useCallback(() => {
    if (!contextMenu) return;
    const item = contextMenu.item;
    setContextMenu(null);
    onNodeDelete?.(item);
  }, [contextMenu, onNodeDelete]);

  return (
    <>
      {renderCatalogItems(items, {
        selectedNodeId,
        collapsedPaths,
        onToggle: togglePath,
        onNodeSelect,
        onNodeContextMenu: openContextMenu
      })}
      {contextMenu ? (
        <div
          className="catalog-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          <button type="button" onClick={runDelete}>
            <Trash2 size={14} />
            <span>删除</span>
          </button>
        </div>
      ) : null}
    </>
  );
}
