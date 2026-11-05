import { useState } from 'react';
import type { ThemeConfig } from '../lib/themes';
import { builtinThemes, FONT_OPTIONS, CODE_STYLE_OPTIONS, getAllThemes } from '../lib/themes';
import { useEscape } from '../lib/useEscape';

interface ThemeEditorProps {
  theme: ThemeConfig;
  onChange: (config: ThemeConfig) => void;
  onSave: (config: ThemeConfig) => void;
  onDelete?: () => void;
  onClose: () => void;
}

function Slider({ label, value, min, max, step = 1, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void;
}) {
  return (
    <div className="te-row">
      <label>{label}</label>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="te-value">{value}</span>
    </div>
  );
}

function Color({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="te-row">
      <label>{label}</label>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
      <span className="te-value">{value}</span>
    </div>
  );
}

function Select({ label, value, options, onChange }: {
  label: string; value: string; options: { label: string; value: string }[]; onChange: (v: string) => void;
}) {
  return (
    <div className="te-row">
      <label>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function ThemeEditor({ theme, onChange, onSave, onDelete, onClose }: ThemeEditorProps) {
  const [name, setName] = useState(theme.name);
  const set = <K extends keyof ThemeConfig>(key: K, value: ThemeConfig[K]) => onChange({ ...theme, [key]: value });
  useEscape(onClose);

  return (
    <div className="theme-editor">
      <div className="te-header">
        <span>主题编辑</span>
        <button className="te-close" onClick={onClose}>✕</button>
      </div>

      <div className="te-body">
        <div className="te-section">
          <div className="te-section-title">基础</div>
          <div className="te-row">
            <label>基于主题</label>
            <select
              value={theme.id}
              onChange={(e) => {
                const base = getAllThemes().find((t) => t.id === e.target.value);
                if (base) onChange({ ...base });
              }}
            >
              {builtinThemes.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div className="te-row">
            <label>主题名称</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>

        <div className="te-section">
          <div className="te-section-title">文字</div>
          <Select label="正文字体" value={theme.fontFamily} options={FONT_OPTIONS} onChange={(v) => set('fontFamily', v)} />
          <Slider label="正文字号" value={theme.fontSize} min={13} max={20} onChange={(v) => set('fontSize', v)} />
          <Slider label="行距" value={theme.lineHeight} min={1.4} max={2.2} step={0.05} onChange={(v) => set('lineHeight', v)} />
          <Slider label="段间距" value={theme.paraSpacing} min={8} max={32} onChange={(v) => set('paraSpacing', v)} />
          <Slider label="字间距" value={theme.letterSpacing} min={0} max={3} step={0.5} onChange={(v) => set('letterSpacing', v)} />
          <Slider label="首行缩进" value={theme.textIndent} min={0} max={40} step={2} onChange={(v) => set('textIndent', v)} />
          <Color label="正文颜色" value={theme.textColor} onChange={(v) => set('textColor', v)} />
        </div>

        <div className="te-section">
          <div className="te-section-title">标题</div>
          <Slider label="文章标题字号" value={theme.titleSize} min={20} max={32} onChange={(v) => set('titleSize', v)} />
          <Slider label="标题字重" value={theme.titleWeight} min={400} max={900} step={100} onChange={(v) => set('titleWeight', v)} />
          <Color label="标题颜色" value={theme.titleColor} onChange={(v) => set('titleColor', v)} />
          <Slider label="小节标题字号" value={theme.headingSize} min={16} max={26} onChange={(v) => set('headingSize', v)} />
          <Color label="小节标题颜色" value={theme.headingColor} onChange={(v) => set('headingColor', v)} />
        </div>

        <div className="te-section">
          <div className="te-section-title">配色</div>
          <Color label="主题色" value={theme.accentColor} onChange={(v) => set('accentColor', v)} />
        </div>

        <div className="te-section">
          <div className="te-section-title">引用块</div>
          <div className="te-row">
            <label>样式</label>
            <select value={theme.quoteStyle} onChange={(e) => set('quoteStyle', e.target.value as 'bar' | 'bg')}>
              <option value="bar">左侧竖条</option>
              <option value="bg">背景块</option>
            </select>
          </div>
          <Color label="背景色" value={theme.quoteBg} onChange={(v) => set('quoteBg', v)} />
        </div>

        <div className="te-section">
          <div className="te-section-title">代码块</div>
          <Select label="风格" value={theme.codeStyle} options={CODE_STYLE_OPTIONS} onChange={(v) => set('codeStyle', v as ThemeConfig['codeStyle'])} />
          <Slider label="圆角" value={theme.codeRadius} min={0} max={16} onChange={(v) => set('codeRadius', v)} />
          <div className="te-row">
            <label>显示边框</label>
            <input type="checkbox" checked={theme.codeBorder} onChange={(e) => set('codeBorder', e.target.checked)} />
          </div>
          <Slider label="代码字号" value={theme.codeFontSize} min={12} max={16} onChange={(v) => set('codeFontSize', v)} />
        </div>

        <div className="te-section">
          <div className="te-section-title">图片</div>
          <Slider label="圆角" value={theme.imageRadius} min={0} max={16} onChange={(v) => set('imageRadius', v)} />
          <div className="te-row">
            <label>阴影</label>
            <input type="checkbox" checked={theme.imageShadow} onChange={(e) => set('imageShadow', e.target.checked)} />
          </div>
        </div>

        <div className="te-section">
          <div className="te-section-title">页面</div>
          <Slider label="内边距" value={theme.padding} min={12} max={40} onChange={(v) => set('padding', v)} />
        </div>
      </div>

      <div className="te-footer">
        {onDelete && <button className="btn btn-secondary" onClick={onDelete}>删除主题</button>}
        <div style={{ flex: 1 }} />
        <button className="btn btn-secondary" onClick={onClose}>取消</button>
        <button
          className="btn btn-primary"
          onClick={() => { onSave({ ...theme, name: name.trim() || theme.name, isCustom: true }); }}
        >
          保存主题
        </button>
      </div>
    </div>
  );
}
