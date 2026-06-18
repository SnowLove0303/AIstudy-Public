import { Bold, Italic, Palette, RotateCcw, Strikethrough, Underline } from "lucide-react";
import { MIND_MAP_DEFAULT_FONT_SIZE } from "./mindMapSnapshot";
import type { MindMapTextFormat, MindMapTextFormatPatch } from "./mindMapTypes";

type MindMapTextFormatToolbarProps = {
  value?: MindMapTextFormat;
  disabled: boolean;
  onChange: (patch: MindMapTextFormatPatch) => void;
};

const TEXT_COLORS = ["#17466f", "#1f6fd1", "#0f766e", "#b45309", "#b91c1c", "#7c3aed"];
const FONT_SIZE_OPTIONS = [12, 14, 16, 18, 20, 24, 28, 32];
const NODE_WIDTH_OPTIONS = [
  { value: "auto", label: "自动" },
  { value: "260", label: "260" },
  { value: "320", label: "320" },
  { value: "420", label: "420" },
  { value: "560", label: "560" }
];

function normalizeColor(value: string | undefined) {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : "#17466f";
}

function normalizeFontSize(value: number | undefined) {
  return FONT_SIZE_OPTIONS.includes(Number(value)) ? Number(value) : MIND_MAP_DEFAULT_FONT_SIZE;
}

function normalizeNodeWidth(value: number | undefined) {
  const width = Number(value);
  return Number.isFinite(width) && width > 0 ? Math.round(width) : undefined;
}

export function MindMapTextFormatToolbar({ value, disabled, onChange }: MindMapTextFormatToolbarProps) {
  const isBold = value?.fontWeight === "bold";
  const isItalic = value?.fontStyle === "italic";
  const isUnderline = value?.textDecoration === "underline";
  const isStrike = value?.textDecoration === "line-through";
  const color = normalizeColor(value?.color);
  const fontSize = normalizeFontSize(value?.fontSize);
  const nodeWidth = normalizeNodeWidth(value?.textAutoWrapWidth);
  const nodeWidthValue = nodeWidth ? String(nodeWidth) : "auto";
  const widthOptions =
    nodeWidth && !NODE_WIDTH_OPTIONS.some((option) => option.value === nodeWidthValue)
      ? [...NODE_WIDTH_OPTIONS, { value: nodeWidthValue, label: nodeWidthValue }]
      : NODE_WIDTH_OPTIONS;

  return (
    <div className="mindmap-text-format-toolbar" aria-label="文本格式">
      <button
        className={isBold ? "format-button active" : "format-button"}
        type="button"
        title="加粗"
        aria-label="加粗"
        aria-pressed={isBold}
        onClick={() => onChange({ fontWeight: isBold ? "normal" : "bold" })}
        disabled={disabled}
      >
        <Bold size={15} />
      </button>
      <button
        className={isItalic ? "format-button active" : "format-button"}
        type="button"
        title="斜体"
        aria-label="斜体"
        aria-pressed={isItalic}
        onClick={() => onChange({ fontStyle: isItalic ? "normal" : "italic" })}
        disabled={disabled}
      >
        <Italic size={15} />
      </button>
      <button
        className={isUnderline ? "format-button active" : "format-button"}
        type="button"
        title="下划线"
        aria-label="下划线"
        aria-pressed={isUnderline}
        onClick={() => onChange({ textDecoration: isUnderline ? "none" : "underline" })}
        disabled={disabled}
      >
        <Underline size={15} />
      </button>
      <button
        className={isStrike ? "format-button active" : "format-button"}
        type="button"
        title="删除线"
        aria-label="删除线"
        aria-pressed={isStrike}
        onClick={() => onChange({ textDecoration: isStrike ? "none" : "line-through" })}
        disabled={disabled}
      >
        <Strikethrough size={15} />
      </button>
      <select
        className="mindmap-format-size"
        value={fontSize}
        title="字号"
        aria-label="字号"
        onChange={(event) => onChange({ fontSize: Number(event.target.value) })}
        disabled={disabled}
      >
        {FONT_SIZE_OPTIONS.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      <label className="mindmap-node-width-control" title="节点宽度">
        <span>宽</span>
        <select
          value={nodeWidthValue}
          aria-label="节点宽度"
          onChange={(event) =>
            onChange({
              textAutoWrapWidth: event.target.value === "auto" ? undefined : Number(event.target.value)
            })
          }
          disabled={disabled}
        >
          {widthOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="mindmap-color-input-wrap" title="文字颜色" aria-label="文字颜色">
        <Palette size={15} />
        <input
          className="mindmap-color-input"
          type="color"
          value={color}
          onChange={(event) => onChange({ color: event.target.value })}
          disabled={disabled}
        />
      </label>
      <div className="mindmap-color-swatches" aria-label="常用文字颜色">
        {TEXT_COLORS.map((item) => (
          <button
            key={item}
            className={item.toLowerCase() === color.toLowerCase() ? "mindmap-color-swatch active" : "mindmap-color-swatch"}
            type="button"
            title={item}
            aria-label={`文字颜色 ${item}`}
            style={{ backgroundColor: item }}
            onClick={() => onChange({ color: item })}
            disabled={disabled}
          />
        ))}
      </div>
      <button
        className="format-button"
        type="button"
        title="清除格式"
        aria-label="清除格式"
        onClick={() =>
          onChange({
            fontWeight: undefined,
            fontStyle: undefined,
            textDecoration: undefined,
            color: undefined,
            fontSize: undefined,
            textAutoWrapWidth: undefined
          })
        }
        disabled={disabled}
      >
        <RotateCcw size={15} />
      </button>
    </div>
  );
}
