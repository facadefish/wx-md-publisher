import type { EditorView } from '@codemirror/view';
import { undo, redo } from '@codemirror/commands';

interface ToolbarProps {
  viewRef: React.MutableRefObject<EditorView | null>;
}

/** 用 before/after 包裹选区 */
function wrap(view: EditorView, before: string, after: string, placeholder = '文本') {
  const sel = view.state.selection.main;
  const selected = view.state.sliceDoc(sel.from, sel.to) || placeholder;
  const insert = `${before}${selected}${after}`;
  view.dispatch({
    changes: { from: sel.from, to: sel.to, insert },
    selection: { anchor: sel.from + before.length, head: sel.from + before.length + selected.length },
    userEvent: 'input',
  });
  view.focus();
}

/** 行首加前缀（支持多行） */
function prefixLines(view: EditorView, prefix: string) {
  const sel = view.state.selection.main;
  const startLine = view.state.doc.lineAt(sel.from);
  const endLine = view.state.doc.lineAt(sel.to);
  const text = view.state.sliceDoc(startLine.from, endLine.to);
  const lines = text.split('\n');
  const allPrefixed = lines.every((l) => l.startsWith(prefix) || l.trim() === '');
  const newText = lines.map((l) => (allPrefixed ? l.replace(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`), '') : prefix + l)).join('\n');
  view.dispatch({
    changes: { from: startLine.from, to: endLine.to, insert: newText },
    userEvent: 'input',
  });
  view.focus();
}

/** 行首替换/添加 markdown 标记（如 # 、##） */
function lineMark(view: EditorView, mark: string) {
  const sel = view.state.selection.main;
  const line = view.state.doc.lineAt(sel.from);
  const text = line.text;
  const stripped = text.replace(/^#{1,6}\s*/, '');
  const newText = stripped ? `${mark}${stripped}` : mark;
  view.dispatch({
    changes: { from: line.from, to: line.to, insert: newText },
    selection: { anchor: line.from + newText.length },
    userEvent: 'input',
  });
  view.focus();
}

/** 在光标处插入片段 */
function insert(view: EditorView, snippet: string, cursorOffset?: number) {
  const sel = view.state.selection.main;
  view.dispatch({
    changes: { from: sel.from, to: sel.to, insert: snippet },
    selection: { anchor: sel.from + (cursorOffset ?? snippet.length) },
    userEvent: 'input',
  });
  view.focus();
}

export function Toolbar({ viewRef }: ToolbarProps) {
  const v = () => viewRef.current;

  const btn = (title: string, label: React.ReactNode, onClick: () => void) => (
    <button
      key={title}
      type="button"
      className="md-btn"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => v() && onClick()}
    >
      {label}
    </button>
  );

  return (
    <div className="md-toolbar" onMouseDown={(e) => e.preventDefault()}>
      <span className="md-toolbar-group">
        {btn('加粗', <b>B</b>, () => v() && wrap(v()!, '**', '**'))}
        {btn('斜体', <i>I</i>, () => v() && wrap(v()!, '*', '*'))}
        {btn('删除线', <s>S</s>, () => v() && wrap(v()!, '~~', '~~'))}
        {btn('下划线', <u>U</u>, () => v() && wrap(v()!, '<u>', '</u>'))}
      </span>
      <span className="md-toolbar-sep" />
      <span className="md-toolbar-group">
        {btn('一级标题', 'H1', () => v() && lineMark(v()!, '# '))}
        {btn('二级标题', 'H2', () => v() && lineMark(v()!, '## '))}
        {btn('三级标题', 'H3', () => v() && lineMark(v()!, '### '))}
      </span>
      <span className="md-toolbar-sep" />
      <span className="md-toolbar-group">
        {btn('无序列表', '• 列表', () => v() && prefixLines(v()!, '- '))}
        {btn('有序列表', '1. 列表', () => v() && prefixLines(v()!, '1. '))}
        {btn('引用', '❝ 引用', () => v() && prefixLines(v()!, '> '))}
      </span>
      <span className="md-toolbar-sep" />
      <span className="md-toolbar-group">
        {btn('行内代码', '<>', () => v() && wrap(v()!, '`', '`', 'code'))}
        {btn('代码块', '{ }', () => v() && wrap(v()!, '```\n', '\n```', 'code'))}
        {btn('链接', '🔗', () => {
          const view = v();
          if (!view) return;
          const sel = view.state.selection.main;
          const selected = view.state.sliceDoc(sel.from, sel.to) || '链接文字';
          const snippet = `[${selected}](https://)`;
          view.dispatch({
            changes: { from: sel.from, to: sel.to, insert: snippet },
            selection: { anchor: sel.from + selected.length + 3, head: sel.from + snippet.length - 1 },
            userEvent: 'input',
          });
          view.focus();
        })}
        {btn('图片', '🖼', () => {
          const view = v();
          if (!view) return;
          insert(view, '![图片描述](https://)', 2);
        })}
        {btn('表格', '⊞', () => {
          const view = v();
          if (!view) return;
          insert(view, '\n| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |\n', 0);
        })}
        {btn('分割线', '—', () => {
          const view = v();
          if (!view) return;
          insert(view, '\n---\n');
        })}
      </span>
      <span className="md-toolbar-sep" />
      <span className="md-toolbar-group">
        {btn('撤销', '↩', () => v() && undo(v()!))}
        {btn('重做', '↪', () => v() && redo(v()!))}
      </span>
    </div>
  );
}
