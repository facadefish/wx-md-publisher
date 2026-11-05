import { useMemo } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown } from '@codemirror/lang-markdown';
import { EditorView } from '@codemirror/view';
import type { EditorView as EditorViewType } from '@codemirror/view';

interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  onCreateView: (view: EditorViewType) => void;
  /** 粘贴图片回调：图片转为 dataURL 传入，由上层插入文档 */
  onPasteImage: (dataUrl: string) => void;
  dark?: boolean;
}

/** 拦截编辑器内图片粘贴，转为 dataURL（发布时统一传微信图床） */
function pasteHandler(onPasteImage: (dataUrl: string) => void) {
  return EditorView.domEventHandlers({
    paste(event) {
      const file = event.clipboardData?.files?.[0];
      if (!file || !file.type.startsWith('image/')) return false;
      event.preventDefault();
      const reader = new FileReader();
      reader.onload = () => onPasteImage(String(reader.result ?? ''));
      reader.readAsDataURL(file);
      return true;
    },
  });
}

export function Editor({ value, onChange, onCreateView, onPasteImage, dark }: EditorProps) {
  // 扩展数组需保持稳定引用，避免每次渲染都触发 CodeMirror 全量重配置
  const extensions = useMemo(() => [markdown(), pasteHandler(onPasteImage)], [onPasteImage]);

  return (
    <div className="editor-body">
      <CodeMirror
        value={value}
        height="100%"
        theme={dark ? 'dark' : 'light'}
        extensions={extensions}
        onChange={onChange}
        onCreateEditor={(view) => onCreateView(view)}
        placeholder={'# 在这里开始写 Markdown...\n\n支持标题、列表、图片、代码块、引用、表格等语法。\n截图后直接 Ctrl+V 粘贴图片。'}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
          highlightSelectionMatches: true,
        }}
      />
    </div>
  );
}
