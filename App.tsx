
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Plus, Minus, Undo, Redo, Trash2, ArrowRight, Sparkles, 
  CheckSquare, Type, Box, Globe, ExternalLink, Layout,
  Quote, FileIcon, ImageIcon, Download, Table as TableIcon,
  AlignLeft, AlignCenter, AlignRight, Calendar, GripVertical, X, MoreVertical, Maximize2, Upload, RefreshCw,
  Home, FolderPlus, Edit2, ChevronLeft, LogOut, Loader2, Mail, Lock, CheckCircle2, AlertCircle, Eye, EyeOff
} from 'lucide-react';
import { generateTextEnhancement } from './services/geminiService';
import { supabase } from './services/supabaseClient';
import { CanvasElement, Point, ViewTransform, Board, Connection, ElementType, TodoItem, DragInfo } from './types';
import { COLORS, TOOLS, INITIAL_BOARD_ID, PALETTE } from './constants';

// --- Utility Functions ---

const generateId = () => Math.random().toString(36).substr(2, 9);

const screenToWorld = (point: Point, transform: ViewTransform): Point => ({
  x: (point.x - transform.x) / transform.zoom,
  y: (point.y - transform.y) / transform.zoom,
});

const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 字节';
    const k = 1024;
    const sizes = ['字节', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// ... (MarkdownRenderer and other helper components remain the same - omitting to save space, assume they are here)
// PLEASE RETAIN ALL HELPER COMPONENTS (MarkdownRenderer, Lightbox, Toolbar, PropertyPanel, etc.)
// I will only include the changed parts in the XML output if you want a partial update, 
// but the prompt format requires full file content if replacing. 
// For brevity in this explanation I'm showing the implementation logic.
// HOWEVER, per instructions, I must provide FULL CONTENT.
// Since the file is huge, I will assume the user wants me to APPLY the persistence logic to the Root App component.

// ... [Insert all helper components: MarkdownRenderer, Lightbox, Toolbar, PropertyPanel, GridSelector, Element Renderers, CanvasWorkspace, HomeDashboard] ...
// To ensure the code works, I will paste the FULL App.tsx with persistence added at the bottom.

// Markdown Renderer
const MarkdownRenderer = ({ text, style }: { text: string, style?: any }) => {
    if (!text) return <span className="text-gray-500 italic select-none pointer-events-none">双击编辑...</span>;
    
    // Process text line by line
    const lines = text.split('\n');
    const renderedLines = [];
    let inCodeBlock = false;

    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        
        // Code Block
        if (line.startsWith('```')) {
            inCodeBlock = !inCodeBlock;
            continue; 
        }
        if (inCodeBlock) {
             renderedLines.push(<div key={i} className="font-mono bg-black/30 px-2 py-0.5 text-sm text-green-400 my-1 rounded">{line}</div>);
             continue;
        }

        // Headers
        if (line.startsWith('# ')) {
             renderedLines.push(<h1 key={i} className="text-2xl font-bold mb-2 mt-2">{processInline(line.slice(2))}</h1>);
             continue;
        }
        if (line.startsWith('## ')) {
             renderedLines.push(<h2 key={i} className="text-xl font-bold mb-1 mt-2">{processInline(line.slice(3))}</h2>);
             continue;
        }

        // Lists
        if (line.trim().startsWith('- ')) {
            const indent = line.search(/\S/);
            renderedLines.push(
                <div key={i} className="flex gap-2 items-start" style={{ marginLeft: `${indent * 0.5}rem` }}>
                    <span className="mt-2 w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" />
                    <span>{processInline(line.trim().slice(2))}</span>
                </div>
            );
            continue;
        }
        if (/^\d+\.\s/.test(line.trim())) {
            const indent = line.search(/\S/);
            const content = line.trim().replace(/^\d+\.\s/, '');
            renderedLines.push(
                <div key={i} className="flex gap-2 items-start" style={{ marginLeft: `${indent * 0.5}rem` }}>
                    <span className="font-mono text-gray-400 select-none mr-1">{line.trim().split(' ')[0]}</span>
                    <span>{processInline(content)}</span>
                </div>
            );
            continue;
        }

        // Standard Paragraph (empty line is a spacer)
        if (line.trim() === '') {
            renderedLines.push(<div key={i} className="h-2"></div>);
        } else {
            renderedLines.push(<div key={i}>{processInline(line)}</div>);
        }
    }

    return (
        <div 
            className={`md-content w-full h-full text-sm leading-relaxed overflow-y-auto custom-scrollbar pr-2`}
            style={{
                textAlign: style?.textAlign || 'left',
                fontFamily: getFontFamily(style?.fontFamily),
                fontSize: style?.fontSize ? style.fontSize + 'px' : undefined
            }}
        >
            {renderedLines}
        </div>
    );
};

const processInline = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|~~.*?~~|`.*?`)/g);
    return parts.map((part, index) => {
        if (part.startsWith('**') && part.endsWith('**')) return <strong key={index} className="font-bold text-[#00FF9D]">{part.slice(2, -2)}</strong>;
        if (part.startsWith('*') && part.endsWith('*')) return <em key={index} className="italic text-yellow-200">{part.slice(1, -1)}</em>;
        if (part.startsWith('~~') && part.endsWith('~~')) return <s key={index} className="opacity-50">{part.slice(2, -2)}</s>;
        if (part.startsWith('`') && part.endsWith('`')) return <code key={index} className="bg-white/10 px-1 rounded font-mono text-pink-300">{part.slice(1, -1)}</code>;
        return part;
    });
};

const getFontFamily = (type?: string) => {
    switch(type) {
        case 'noto-sans': return "'Noto Sans SC', 'Microsoft YaHei', sans-serif";
        case 'noto-serif': return "'Noto Serif SC', 'SimSun', serif";
        case 'ma-shan': return "'Ma Shan Zheng', cursive";
        case 'zhi-mang': return "'Zhi Mang Xing', cursive";
        case 'zcool': return "'ZCOOL QingKe HuangYou', sans-serif";
        case 'kuai-le': return "'ZCOOL KuaiLe', cursive";
        case 'long-cang': return "'Long Cang', cursive";
        case 'biantao': return "'ZihunBiantao', sans-serif";
        case 'youshe': return "'YousheBiaotiHei', sans-serif";
        case 'mingchao': return "'HuiwenMingchao', serif";
        case 'tiejili': return "'Tiejili', sans-serif";
        case 'ximai': return "'XimaiXihuan', sans-serif";
        case 'mengqu': return "'ZihunMengqu', sans-serif";
        case 'poxiao': return "'PoxiaoPixel', sans-serif";
        default: return "'Caveat', cursive";
    }
};

// --- Components ---

const Lightbox = ({ url, onClose }: { url: string, onClose: () => void }) => {
    return (
        <div 
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-10 animate-in fade-in duration-200"
            onClick={onClose}
        >
            <button className="absolute top-5 right-5 text-white/50 hover:text-white transition-colors">
                <X size={32} />
            </button>
            <img 
                src={url} 
                alt="Lightbox" 
                className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
                onClick={e => e.stopPropagation()}
            />
        </div>
    )
}

const Toolbar = ({ activeTool, onSelectTool, onUndo, onRedo, onHome }: any) => (
  <>
    {/* Desktop: vertical left sidebar */}
    <div className="hidden sm:flex fixed left-4 top-1/2 -translate-y-1/2 bg-[#1a1a1a] border border-[#333] rounded-2xl p-2 flex-col gap-3 shadow-2xl z-50">
      <button onClick={onHome} className="p-2 text-[#00FF9D] hover:bg-[#00FF9D]/10 rounded-xl" title="返回首页"><Home size={20} /></button>
      <div className="h-px bg-[#333] my-1" />
      {TOOLS.map((tool) => (
        <button key={tool.id} onClick={() => onSelectTool(tool.type || 'select')}
          className={`p-2 rounded-xl transition-all relative group ${(activeTool === (tool.type || 'select')) ? 'bg-[#00FF9D] text-black shadow-[0_0_15px_rgba(0,255,157,0.4)]' : 'text-gray-400 hover:text-white hover:bg-[#2A2A2A]'}`} title={tool.label}>
          <tool.icon size={20} />
        </button>
      ))}
      <div className="h-px bg-[#333] my-1" />
      <button onClick={onUndo} className="p-2 text-gray-400 hover:text-white hover:bg-[#2A2A2A] rounded-xl"><Undo size={20} /></button>
      <button onClick={onRedo} className="p-2 text-gray-400 hover:text-white hover:bg-[#2A2A2A] rounded-xl"><Redo size={20} /></button>
    </div>
    {/* Mobile: horizontal bottom bar */}
    <div className="sm:hidden fixed bottom-4 left-4 right-4 bg-[#1a1a1a] border border-[#333] rounded-2xl p-2 flex items-center justify-around gap-1 shadow-2xl z-50 overflow-x-auto">
      <button onClick={onHome} className="p-2 text-[#00FF9D] hover:bg-[#00FF9D]/10 rounded-xl flex-shrink-0"><Home size={18} /></button>
      <div className="w-px h-6 bg-[#333] flex-shrink-0" />
      {TOOLS.slice(0, 6).map((tool) => (
        <button key={tool.id} onClick={() => onSelectTool(tool.type || 'select')}
          className={`p-2 rounded-xl transition-all flex-shrink-0 ${(activeTool === (tool.type || 'select')) ? 'bg-[#00FF9D] text-black' : 'text-gray-400 hover:text-white'}`} title={tool.label}>
          <tool.icon size={18} />
        </button>
      ))}
      <div className="w-px h-6 bg-[#333] flex-shrink-0" />
      <button onClick={onUndo} className="p-2 text-gray-400 hover:text-white rounded-xl flex-shrink-0"><Undo size={18} /></button>
      <button onClick={onRedo} className="p-2 text-gray-400 hover:text-white rounded-xl flex-shrink-0"><Redo size={18} /></button>
    </div>
  </>
);

const PropertyPanel = ({ element, onChange, onDelete, onAI }: any) => {
  if (!element) return null;

  const handleResetImage = () => {
    if (element.type === 'image' && element.content.url) {
        const img = new Image();
        img.onload = () => {
            // Cap max width to prevent huge images
            const maxW = 800;
            const w = Math.min(img.naturalWidth, maxW);
            const h = w / (img.naturalWidth / img.naturalHeight);
            onChange({ width: w, height: h });
        };
        img.src = element.content.url;
    }
  };

  return (
    <div className="fixed right-4 top-20 w-72 max-sm:right-2 max-sm:top-auto max-sm:bottom-20 max-sm:w-[calc(100%-16px)] max-sm:max-h-[50vh] max-sm:overflow-y-auto bg-[#1a1a1a] border border-[#333] rounded-2xl p-5 shadow-2xl z-50 animate-in slide-in-from-right-10 duration-200" onPointerDown={(e) => e.stopPropagation()}>
      <div className="flex justify-between items-center mb-6 border-b border-[#333] pb-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[#00FF9D]">
            {element.type === 'text' ? '文字样式' : element.type === 'note' ? '笔记样式' : element.type === 'image' ? '图片样式' : element.type === 'file' ? '文件样式' : element.type === 'todo' ? '待办样式' : element.type === 'link' ? '链接样式' : element.type === 'container' ? '容器样式' : '表格样式'}
        </h3>
        <button onClick={onDelete} className="text-gray-500 hover:text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-colors" title="删除">
          <Trash2 size={16} />
        </button>
      </div>

      <div className="space-y-6">
        
        {/* Colors */}
        <div>
            <label className="text-xs font-semibold text-gray-500 mb-2 block uppercase tracking-wide">背景</label>
            <div className="flex gap-2 flex-wrap">
                {PALETTE.map(c => (
                    <button 
                        key={c} 
                        className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${element.style?.backgroundColor === c ? 'border-white' : 'border-transparent'} ${c === 'transparent' ? 'bg-black border-dashed border-gray-600' : ''}`}
                        style={{ backgroundColor: c === 'transparent' ? 'transparent' : c }}
                        onClick={() => onChange({ style: { ...element.style, backgroundColor: c } })}
                        title={c}
                    />
                ))}
            </div>
        </div>

        {/* Text Options - EXCLUDED for Todo */}
        {element.type === 'note' && (
            <>
                <div>
                    <label className="text-xs font-semibold text-gray-500 mb-2 block uppercase tracking-wide">字体</label>
                    <div className="grid grid-cols-3 gap-1.5 max-h-40 overflow-y-auto">
                         <button onClick={() => onChange({ style: { ...element.style, fontFamily: '' } })} className={`font-hand px-2 py-1.5 text-xs rounded border ${(!element.style?.fontFamily || element.style?.fontFamily === '') ? 'border-[#00FF9D] text-[#00FF9D]' : 'border-[#333] text-gray-400'}`}>手写</button>
                         <button onClick={() => onChange({ style: { ...element.style, fontFamily: 'noto-sans' } })} className={`font-noto-sans px-2 py-1.5 text-xs rounded border ${element.style?.fontFamily === 'noto-sans' ? 'border-[#00FF9D] text-[#00FF9D]' : 'border-[#333] text-gray-400'}`}>思源黑</button>
                         <button onClick={() => onChange({ style: { ...element.style, fontFamily: 'noto-serif' } })} className={`font-noto-serif px-2 py-1.5 text-xs rounded border ${element.style?.fontFamily === 'noto-serif' ? 'border-[#00FF9D] text-[#00FF9D]' : 'border-[#333] text-gray-400'}`}>思源宋</button>
                         <button onClick={() => onChange({ style: { ...element.style, fontFamily: 'ma-shan' } })} className={`font-ma-shan px-2 py-1.5 text-xs rounded border ${element.style?.fontFamily === 'ma-shan' ? 'border-[#00FF9D] text-[#00FF9D]' : 'border-[#333] text-gray-400'}`}>书法</button>
                         <button onClick={() => onChange({ style: { ...element.style, fontFamily: 'zhi-mang' } })} className={`font-zhi-mang px-2 py-1.5 text-xs rounded border ${element.style?.fontFamily === 'zhi-mang' ? 'border-[#00FF9D] text-[#00FF9D]' : 'border-[#333] text-gray-400'}`}>行书</button>
                         <button onClick={() => onChange({ style: { ...element.style, fontFamily: 'zcool' } })} className={`font-zcool px-2 py-1.5 text-xs rounded border ${element.style?.fontFamily === 'zcool' ? 'border-[#00FF9D] text-[#00FF9D]' : 'border-[#333] text-gray-400'}`}>黄油</button>
                         <button onClick={() => onChange({ style: { ...element.style, fontFamily: 'kuai-le' } })} className={`font-kuai-le px-2 py-1.5 text-xs rounded border ${element.style?.fontFamily === 'kuai-le' ? 'border-[#00FF9D] text-[#00FF9D]' : 'border-[#333] text-gray-400'}`}>快乐</button>
                         <button onClick={() => onChange({ style: { ...element.style, fontFamily: 'long-cang' } })} className={`font-long-cang px-2 py-1.5 text-xs rounded border ${element.style?.fontFamily === 'long-cang' ? 'border-[#00FF9D] text-[#00FF9D]' : 'border-[#333] text-gray-400'}`}>龙仓</button>
                         <button onClick={() => onChange({ style: { ...element.style, fontFamily: 'biantao' } })} className={`font-biantao px-2 py-1.5 text-xs rounded border ${element.style?.fontFamily === 'biantao' ? 'border-[#00FF9D] text-[#00FF9D]' : 'border-[#333] text-gray-400'}`}>扁桃体</button>
                         <button onClick={() => onChange({ style: { ...element.style, fontFamily: 'youshe' } })} className={`font-youshe px-2 py-1.5 text-xs rounded border ${element.style?.fontFamily === 'youshe' ? 'border-[#00FF9D] text-[#00FF9D]' : 'border-[#333] text-gray-400'}`}>优设黑</button>
                         <button onClick={() => onChange({ style: { ...element.style, fontFamily: 'mingchao' } })} className={`font-mingchao px-2 py-1.5 text-xs rounded border ${element.style?.fontFamily === 'mingchao' ? 'border-[#00FF9D] text-[#00FF9D]' : 'border-[#333] text-gray-400'}`}>明朝体</button>
                         <button onClick={() => onChange({ style: { ...element.style, fontFamily: 'tiejili' } })} className={`font-tiejili px-2 py-1.5 text-xs rounded border ${element.style?.fontFamily === 'tiejili' ? 'border-[#00FF9D] text-[#00FF9D]' : 'border-[#333] text-gray-400'}`}>铁蒺藜</button>
                         <button onClick={() => onChange({ style: { ...element.style, fontFamily: 'ximai' } })} className={`font-ximai px-2 py-1.5 text-xs rounded border ${element.style?.fontFamily === 'ximai' ? 'border-[#00FF9D] text-[#00FF9D]' : 'border-[#333] text-gray-400'}`}>喜脉</button>
                         <button onClick={() => onChange({ style: { ...element.style, fontFamily: 'mengqu' } })} className={`font-mengqu px-2 py-1.5 text-xs rounded border ${element.style?.fontFamily === 'mengqu' ? 'border-[#00FF9D] text-[#00FF9D]' : 'border-[#333] text-gray-400'}`}>喜悦</button>
                         <button onClick={() => onChange({ style: { ...element.style, fontFamily: 'poxiao' } })} className={`font-poxiao px-2 py-1.5 text-xs rounded border ${element.style?.fontFamily === 'poxiao' ? 'border-[#00FF9D] text-[#00FF9D]' : 'border-[#333] text-gray-400'}`}>破晓</button>
                    </div>
                    {element.type !== 'note' && (
                        <div className="flex bg-[#222] rounded-lg p-1 border border border-[#333]">
                            {['left', 'center', 'right'].map((align) => (
                                <button 
                                    key={align}
                                    onClick={() => onChange({ style: { ...element.style, textAlign: align } })}
                                    className={`flex-1 flex justify-center py-1 rounded ${element.style?.textAlign === align ? 'bg-[#333] text-white' : 'text-gray-500'}`}
                                >
                                    {align === 'left' && <AlignLeft size={14} />}
                                    {align === 'center' && <AlignCenter size={14} />}
                                    {align === 'right' && <AlignRight size={14} />}
                                </button>
                            ))}
                        </div>
                    )}
                    <div className="mt-2">
                        <label className="text-xs font-semibold text-gray-500 mb-2 block uppercase tracking-wide">字号: {element.style?.fontSize || 14}px</label>
                        <div className="flex gap-2 items-center">
                            <button onClick={() => onChange({ style: { ...element.style, fontSize: Math.max((element.style?.fontSize || 14) - 2, 8) } })} className="px-3 py-1.5 bg-[#222] text-xs rounded-lg border border-[#333] hover:bg-[#2A2A2A] text-gray-400">A-</button>
                            <input type="range" min="8" max="72" step="2"
                                value={element.style?.fontSize || 14}
                                onChange={(e) => onChange({ style: { ...element.style, fontSize: parseInt(e.target.value) } })}
                                className="flex-1 accent-[#00FF9D] h-1 bg-[#333] rounded-lg appearance-none cursor-pointer"
                                onPointerDown={(e) => e.stopPropagation()}
                            />
                            <button onClick={() => onChange({ style: { ...element.style, fontSize: Math.min((element.style?.fontSize || 14) + 2, 72) } })} className="px-3 py-1.5 bg-[#222] text-xs rounded-lg border border-[#333] hover:bg-[#2A2A2A] text-gray-400">A+</button>
                        </div>
                    </div>
                </div>
            </>
        )}

        {/* Image specific */}
        {element.type === 'image' && (
            <div>
                 <button 
                    onClick={handleResetImage}
                    className="w-full flex items-center justify-center gap-2 bg-[#222] hover:bg-[#333] text-gray-300 hover:text-white text-xs font-bold py-2 rounded-xl transition-all border border-[#333]"
                >
                    <RefreshCw size={14} />
                    重置原始大小
                </button>
            </div>
        )}

        {/* Border Radius for supported types */}
        {(element.type === 'image' || element.type === 'container' || element.type === 'text' || element.type === 'note') && (
             <div>
                <label className="text-xs font-semibold text-gray-500 mb-2 block uppercase tracking-wide">圆角: {element.style?.borderRadius || 0}px</label>
                <input 
                    type="range" min="0" max="40" step="4"
                    value={element.style?.borderRadius || 0}
                    onChange={(e) => onChange({ style: { ...element.style, borderRadius: parseInt(e.target.value) } })}
                    className="w-full accent-[#00FF9D] h-1 bg-[#333] rounded-lg appearance-none"
                    onPointerDown={(e) => e.stopPropagation()}
                />
            </div>
        )}

        {/* Layering */}
        <div>
            <label className="text-xs font-semibold text-gray-500 mb-2 block uppercase tracking-wide">层级</label>
            <div className="flex gap-2">
                 <button 
                    onClick={() => onChange({ style: { ...element.style, zIndex: (element.style?.zIndex || 1) + 1 } })}
                    className="flex-1 bg-[#222] text-xs py-2 px-2 rounded-lg border border-[#333] hover:bg-[#2A2A2A] hover:text-white text-gray-400"
                 >上移一层</button>
                 <button
                    onClick={() => onChange({ style: { ...element.style, zIndex: Math.max((element.style?.zIndex || 1) - 1, 0) } })}
                    className="flex-1 bg-[#222] text-xs py-2 px-2 rounded-lg border border-[#333] hover:bg-[#2A2A2A] hover:text-white text-gray-400"
                 >下移一层</button>
            </div>
        </div>

        {element.type === 'text' && (
            <div className="pt-4 border-t border-[#333]">
                <button 
                    onClick={onAI}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black text-xs font-bold py-3 rounded-xl transition-all shadow-lg"
                >
                    <Sparkles size={16} />
                    AI 优化
                </button>
            </div>
        )}
      </div>
    </div>
  );
};

const GridSelector = ({ onSelect, onClose }: { onSelect: (rows: number, cols: number) => void, onClose: () => void }) => {
    const [hover, setHover] = useState({ r: 0, c: 0 });
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-[#1a1a1a] border border-[#333] p-6 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <h3 className="text-white text-sm font-bold mb-4 text-center">创建表格</h3>
                <div 
                    className="grid gap-1 mb-4" 
                    style={{ gridTemplateColumns: 'repeat(8, 24px)' }}
                    onMouseLeave={() => setHover({ r: 0, c: 0 })}
                >
                    {Array.from({ length: 8 }).map((_, r) => (
                        Array.from({ length: 8 }).map((_, c) => (
                            <div 
                                key={`${r}-${c}`}
                                className={`w-6 h-6 rounded-sm cursor-pointer transition-colors ${
                                    r <= hover.r && c <= hover.c ? 'bg-[#00FF9D]' : 'bg-[#333]'
                                }`}
                                onMouseEnter={() => setHover({ r, c })}
                                onClick={() => onSelect(r + 1, c + 1)}
                            />
                        ))
                    ))}
                </div>
                <div className="text-center text-sm font-mono text-[#00FF9D]">
                    {hover.r + 1} 行 x {hover.c + 1} 列
                </div>
            </div>
        </div>
    );
};

// --- Element Renderers ---

const TextElement = ({ element, onChange, isSelected }: any) => {
  const [isEditing, setIsEditing] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textAreaRef.current) {
      textAreaRef.current.focus();
    }
  }, [isEditing]);

  return (
    <div 
        className="w-full h-full p-4 overflow-hidden"
        style={{ 
            color: COLORS.text, 
            backgroundColor: element.style?.backgroundColor || 'transparent',
            borderRadius: element.style?.borderRadius || 0
        }}
        onDoubleClick={() => setIsEditing(true)}
    >
        {isEditing ? (
            <textarea
                ref={textAreaRef}
                className="w-full h-full bg-transparent resize-none outline-none custom-scrollbar"
                style={{ 
                    fontFamily: getFontFamily(element.style?.fontFamily),
                    textAlign: element.style?.textAlign,
                    fontSize: '0.875rem', 
                    lineHeight: '1.625' 
                }}
                value={String(element.content || '')}
                onChange={(e) => onChange({ content: e.target.value })}
                onBlur={() => setIsEditing(false)}
                onPointerDown={(e) => e.stopPropagation()} 
            />
        ) : (
            <div className="w-full h-full">
                <MarkdownRenderer text={String(element.content || '')} style={element.style} />
            </div>
        )}
    </div>
  );
};

const NoteElement = ({ element, onChange }: any) => {
  const [isEditing, setIsEditing] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && textAreaRef.current) {
        textAreaRef.current.style.height = "auto";
        textAreaRef.current.style.height = textAreaRef.current.scrollHeight + "px";
        textAreaRef.current.focus();
    }
  }, [isEditing]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      // Pass both content AND new height to updateBoard
      const newHeight = Math.max(200, e.target.scrollHeight);
      onChange({ content: e.target.value, height: newHeight });
      e.target.style.height = "auto";
      e.target.style.height = e.target.scrollHeight + "px";
  };

  return (
    <div 
        className="w-full h-full p-6 overflow-hidden flex flex-col items-center justify-center text-center relative transition-all"
        style={{ 
            color: COLORS.text, 
            backgroundColor: element.style?.backgroundColor || '#1E1E1E',
            borderRadius: element.style?.borderRadius || 0
        }}
        onDoubleClick={() => setIsEditing(true)}
    >
        <Quote className="absolute text-white/5 top-2 left-2" size={32} />
        <Quote className="absolute text-white/5 bottom-2 right-2 rotate-180" size={32} />
        
        {isEditing ? (
            <textarea
                ref={textAreaRef}
                className="w-full bg-transparent resize-none outline-none text-center text-lg z-10 overflow-hidden"
                style={{ fontFamily: getFontFamily(element.style?.fontFamily || 'serif') }}
                value={String(element.content || '')}
                onChange={handleInput}
                onBlur={() => setIsEditing(false)}
                onPointerDown={(e) => e.stopPropagation()} 
                rows={1}
            />
        ) : (
            <div className="w-full relative z-10 pointer-events-none leading-relaxed whitespace-pre-wrap" style={{ fontFamily: getFontFamily(element.style?.fontFamily || 'serif'), fontSize: (element.style?.fontSize || 18) + 'px' }}>
                {String(element.content || '') || <span className="opacity-50">空笔记</span>}
            </div>
        )}
    </div>
  );
};

const TodoElement = ({ element, onChange }: any) => {
    const content = typeof element.content === 'object' && !Array.isArray(element.content) 
        ? element.content 
        : { title: '待办', items: Array.isArray(element.content) ? element.content : [] };
    
    const items = content.items;
    const updateContent = (newContent: any) => onChange({ content: newContent });

    const updateItem = (id: string, patch: Partial<TodoItem>) => {
        const newItems = items.map((i: TodoItem) => i.id === id ? {...i, ...patch} : i);
        updateContent({ ...content, items: newItems });
    };

    const deleteItem = (id: string) => {
         updateContent({ ...content, items: items.filter((i: TodoItem) => i.id !== id) });
    };

    const addItem = () => {
        const newId = generateId();
        updateContent({ ...content, items: [...items, { id: newId, text: '', done: false, level: 0 }] });
    };

    const handleSortStart = (e: React.DragEvent, index: number) => {
        e.dataTransfer.setData('text/plain', index.toString());
        e.dataTransfer.effectAllowed = 'move';
        e.stopPropagation(); // Prevent dragging the board element
    };

    const handleSortDrop = (e: React.DragEvent, dropIndex: number) => {
        e.preventDefault();
        e.stopPropagation();
        const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
        if (isNaN(dragIndex) || dragIndex === dropIndex) return;

        const newItems = [...items];
        const [moved] = newItems.splice(dragIndex, 1);
        newItems.splice(dropIndex, 0, moved);
        updateContent({ ...content, items: newItems });
    };

    // Keyboard support for enter/backspace
    const handleKeyDown = (e: React.KeyboardEvent, index: number, id: string) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const newId = generateId();
            const newItems = [...items];
            newItems.splice(index + 1, 0, { id: newId, text: '', done: false, level: items[index].level });
            updateContent({ ...content, items: newItems });
        } else if (e.key === 'Backspace' && items[index].text === '') {
            e.preventDefault();
            deleteItem(id);
        } else if (e.key === 'Tab') {
            e.preventDefault();
            const newLevel = Math.max(0, Math.min((items[index].level || 0) + (e.shiftKey ? -1 : 1), 3));
            updateItem(id, { level: newLevel });
        }
    }

    return (
        <div 
            className="w-full h-full p-4 flex flex-col"
            style={{ 
                backgroundColor: element.style?.backgroundColor || '#000000',
                borderRadius: element.style?.borderRadius || 0
            }}
        >
            <input 
                className="text-[#00FF9D] bg-transparent text-sm font-bold uppercase mb-4 tracking-wider w-full outline-none placeholder-[#00FF9D]/50"
                value={content.title}
                onChange={(e) => updateContent({...content, title: e.target.value})}
                placeholder="待办列表"
                onPointerDown={(e) => e.stopPropagation()}
            />
            
            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                {items.map((item: TodoItem, index: number) => (
                    <div 
                        key={item.id} 
                        draggable
                        onDragStart={(e) => handleSortStart(e, index)}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => handleSortDrop(e, index)}
                        onPointerDown={(e) => e.stopPropagation()} // Prevent board drag when interacting with item
                        className="flex items-start gap-2 mb-2 p-1 rounded group animate-in fade-in slide-in-from-left-2 duration-300 hover:bg-white/5"
                        style={{ marginLeft: `${(item.level || 0) * 1.5}rem` }}
                    >
                        <div className="mt-1 cursor-grab opacity-0 group-hover:opacity-50 hover:opacity-100 text-gray-500">
                            <GripVertical size={12} />
                        </div>
                        <div 
                            onClick={(e) => { e.stopPropagation(); updateItem(item.id, { done: !item.done }); }}
                            className={`w-4 h-4 mt-1 rounded border cursor-pointer flex items-center justify-center transition-all flex-shrink-0 ${item.done ? 'bg-[#00FF9D] border-[#00FF9D]' : 'border-gray-600 hover:border-gray-400'}`}
                        >
                            {item.done && <span className="text-black text-[10px] font-bold">✓</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                            <input 
                                className={`w-full bg-transparent outline-none text-sm font-sans ${item.done ? 'line-through text-gray-500' : 'text-gray-200'}`}
                                value={item.text}
                                onChange={(e) => updateItem(item.id, { text: e.target.value })}
                                onKeyDown={(e) => handleKeyDown(e, index, item.id)}
                                placeholder="任务..."
                            />
                            <div className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-[#00FF9D] cursor-pointer relative">
                                    <Calendar size={10} />
                                    <input 
                                        type="date" 
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                        onChange={(e) => updateItem(item.id, { dueDate: e.target.value })}
                                    />
                                    <span>{item.dueDate ? new Date(item.dueDate).toLocaleDateString(undefined, {month:'short', day:'numeric'}) : '日期'}</span>
                                </div>
                            </div>
                        </div>
                         <button 
                            className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-500 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}
                        >
                            <X size={12} />
                        </button>
                    </div>
                ))}
            </div>
            <button 
                onClick={(e) => { e.stopPropagation(); addItem(); }}
                className="mt-2 flex items-center justify-center gap-2 w-full py-2 rounded border border-dashed border-[#333] text-gray-500 text-xs hover:text-[#00FF9D] hover:border-[#00FF9D] transition-colors"
            >
                <Plus size={12} /> 添加项目
            </button>
        </div>
    )
}

const LinkElement = ({ element, onChange }: any) => {
    const content = typeof element.content === 'object' ? element.content : { url: String(element.content || ''), title: '' };
    const isUrl = content.url && (content.url.startsWith('http') || content.url.startsWith('www'));
    const updateLink = (patch: any) => onChange({ content: { ...content, ...patch } });

    useEffect(() => {
        if (isUrl && !content.title) {
            try {
                const hostname = new URL(content.url).hostname.replace('www.', '');
                updateLink({ title: hostname });
            } catch (e) {}
        }
    }, [isUrl, content.url]);

    if (!isUrl) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center p-4">
                <Globe className="text-gray-500 mb-2" />
                <input 
                    className="w-full bg-[#333] text-white px-2 py-1 rounded text-sm outline-none border border-transparent focus:border-[#00FF9D]"
                    placeholder="粘贴链接..."
                    value={content.url}
                    onChange={(e) => updateLink({ url: e.target.value })}
                    onPointerDown={(e) => e.stopPropagation()}
                    onPaste={(e) => e.stopPropagation()}
                />
            </div>
        );
    }
    
    return (
        <div 
            className="w-full h-full flex flex-col relative group cursor-pointer overflow-hidden bg-[#1a1a1a]"
            onDoubleClick={(e) => { 
                e.stopPropagation();
                window.open(content.url, '_blank'); 
            }}
            title="双击打开链接"
        >
            <div className="h-2/3 bg-gradient-to-br from-[#2A2A2A] to-[#111] flex items-center justify-center relative">
                <Globe size={48} className="text-[#00FF9D] opacity-20 group-hover:scale-110 transition-transform duration-500" />
            </div>
            <div className="flex-1 bg-[#1a1a1a] p-3 flex flex-col justify-center border-t border-[#333]">
                <div className="flex items-center gap-2 mb-1">
                     <input 
                        className="flex-1 bg-transparent text-white font-bold text-sm outline-none placeholder-gray-600 truncate hover:text-[#00FF9D]"
                        value={content.title || ''}
                        onChange={(e) => updateLink({ title: e.target.value })}
                        onClick={e => e.stopPropagation()} 
                        onPointerDown={(e) => e.stopPropagation()}
                        placeholder="链接标题"
                     />
                     <ExternalLink size={14} className="text-[#00FF9D]" />
                </div>
                <div className="text-[10px] text-gray-500 font-mono truncate">{content.url}</div>
            </div>
        </div>
    )
}

const ImageElement = ({ element, onChange, onOpenLightbox }: any) => {
    const content = typeof element.content === 'object' ? element.content : { url: String(element.content || ''), caption: '' };

    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                     onChange({ content: { url: event.target?.result as string, caption: file.name } });
                };
                img.src = event.target?.result as string;
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <div 
            className="w-full h-full flex flex-col overflow-hidden"
            style={{ borderRadius: element.style?.borderRadius || 0 }}
            onDoubleClick={(e) => { e.stopPropagation(); if (content.url) onOpenLightbox(content.url); }}
        >
            <div className="flex-1 relative overflow-hidden bg-black/20 group flex items-center justify-center">
                {content.url ? (
                    <>
                        <img src={content.url} alt="Upload" className="w-full h-full object-cover pointer-events-none" />
                        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 p-1 rounded text-white cursor-pointer">
                            <Maximize2 size={14} />
                        </div>
                    </>
                ) : (
                    <label className="flex flex-col items-center justify-center h-full text-gray-500 cursor-pointer hover:text-[#00FF9D] transition-colors p-4 text-center">
                        <input type="file" accept="image/*" className="hidden" onChange={handleUpload} onPointerDown={e => e.stopPropagation()} />
                        <Upload size={32} />
                        <span className="text-xs mt-2 font-bold">点击上传图片</span>
                        <span className="text-[10px] opacity-50 mt-1">或拖拽上传</span>
                    </label>
                )}
            </div>
            {content.url && (
                <div className="h-8 bg-[#1a1a1a] flex items-center px-2 border-t border-[#333]">
                    <input 
                        className="w-full bg-transparent text-xs text-gray-400 outline-none text-center placeholder-gray-700"
                        value={content.caption || ''}
                        onChange={(e) => onChange({ content: { ...content, caption: e.target.value } })}
                        onPointerDown={(e) => e.stopPropagation()}
                        placeholder="添加说明..."
                    />
                </div>
            )}
        </div>
    )
}

const FileElement = ({ element, onChange }: any) => {
    const hasFile = element.content?.url;
    
    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
             const reader = new FileReader();
             reader.onload = (ev) => {
                 onChange({ 
                     content: { 
                         name: file.name, 
                         size: formatBytes(file.size), 
                         url: ev.target?.result as string 
                     } 
                 });
             };
             reader.readAsDataURL(file);
        }
    };

    if (!hasFile) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-[#1a1a1a] border border-[#333] border-dashed">
                 <label className="flex flex-col items-center justify-center cursor-pointer text-gray-500 hover:text-[#00FF9D] transition-colors">
                    <input type="file" className="hidden" onChange={handleUpload} onPointerDown={e => e.stopPropagation()} />
                    <Upload size={24} />
                    <span className="text-xs mt-2 font-bold">上传文件</span>
                </label>
            </div>
        );
    }

    return (
        <div 
            className="w-full h-full flex flex-col items-center justify-center p-4 bg-[#1a1a1a] border border-[#333] transition-colors hover:border-gray-500"
            title={element.content?.name} 
        >
             <div className="p-3 bg-[#222] rounded-full mb-3 shadow-inner">
                 <FileIcon size={24} className="text-[#00FF9D]" />
             </div>
             {/* Forced visibility with text-gray-200 and explicit z-index */}
             <div className="text-sm font-bold w-full text-center px-2 overflow-hidden text-ellipsis whitespace-nowrap text-gray-200 z-10">
                {element.content?.name || '未知文件'}
             </div>
             <div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">{element.content?.size || '0 KB'}</div>
             <a href={element.content?.url} download className="mt-4 bg-[#333] hover:bg-[#00FF9D] hover:text-black px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 transition-all">
                 <Download size={12} /> 下载
             </a>
        </div>
    )
}

const TableElement = ({ element, onChange, isSelected }: any) => {
    const [isEditing, setIsEditing] = useState(false);
    const rows = element.content.rows || 3;
    const cols = element.content.cols || 3;
    const data = element.content.data || {};
    
    useEffect(() => {
        if (!isSelected) setIsEditing(false);
    }, [isSelected]);

    const updateCell = (r: number, c: number, val: string) => {
        const newData = { ...data, [`${r}-${c}`]: val };
        onChange({ content: { ...element.content, data: newData } });
    };

    return (
        <div 
            className="w-full h-full bg-[#1a1a1a] flex flex-col relative group overflow-hidden border border-[#333] rounded-lg"
        >
            <div 
                className="grid gap-[1px] bg-[#333] w-full h-full"
                style={{ 
                    gridTemplateColumns: `repeat(${cols}, 1fr)`,
                    gridTemplateRows: `repeat(${rows}, 1fr)`
                }}
            >
                {Array.from({ length: rows }).map((_, r) => (
                    Array.from({ length: cols }).map((_, c) => {
                        const isHeader = r === 0;
                        const bgClass = isHeader ? 'bg-[#333]' : 'bg-[#1a1a1a]';
                        return (
                            <div key={`${r}-${c}`} className={`relative ${bgClass}`}>
                                <input 
                                    className={`w-full h-full bg-transparent text-xs px-2 outline-none text-gray-300 focus:bg-[#00FF9D]/10 text-center ${isHeader ? 'font-bold text-[#00FF9D]' : ''}`}
                                    value={data[`${r}-${c}`] || ''}
                                    onChange={(e) => updateCell(r, c, e.target.value)}
                                    onPointerDown={(e) => isEditing && e.stopPropagation()}
                                    readOnly={!isEditing}
                                    placeholder={isHeader ? `列 ${c+1}` : ''}
                                />
                            </div>
                        )
                    })
                ))}
            </div>
            {!isEditing && (
                <div 
                    className="absolute inset-0 z-20 bg-transparent" 
                    onDoubleClick={(e) => {
                        e.stopPropagation();
                        setIsEditing(true);
                    }}
                    title="双击编辑单元格"
                />
            )}
        </div>
    )
}

const ContainerElement = ({ element, children, onChange, cardCount }: any) => {
    return (
        <div 
            className="w-full h-full flex flex-col border border-[#333] shadow-2xl transition-all relative overflow-hidden group transition-colors duration-200"
            style={{ 
                borderRadius: element.style?.borderRadius || 12,
                backgroundColor: element.style?.backgroundColor || '#1A1A1A'
            }}
        >
            <div className="h-14 flex flex-col justify-center px-4 border-b border-[#333] bg-black/20 flex-shrink-0">
                <input 
                    className="bg-transparent text-xl font-bold font-serif text-white outline-none placeholder-gray-600 truncate w-full text-center"
                    value={String(element.content || '')}
                    onChange={(e) => onChange({ content: e.target.value })}
                    onPointerDown={(e) => e.stopPropagation()}
                    placeholder="新列"
                />
                <div className="text-[10px] text-gray-500 uppercase tracking-widest text-center mt-0.5">{cardCount} 张卡片</div>
            </div>
            <div className="flex-1 relative rounded-b-[inherit] min-h-[50px]" />
        </div>
    )
}

const ConnectionLayer = ({ connections, elements }: any) => {
    const getCenter = (id: string) => {
        const el = elements.find((e: any) => e.id === id);
        if (!el) return { x: 0, y: 0 };
        return { x: el.x + el.width / 2, y: el.y + el.height / 2 };
    };
    return (
        <svg className="absolute inset-0 pointer-events-none w-full h-full overflow-visible">
            {connections.map((conn: any) => {
                const start = getCenter(conn.fromId);
                const end = getCenter(conn.toId);
                return (
                    <g key={conn.id}>
                        <path 
                            d={`M ${start.x} ${start.y} C ${(start.x + end.x)/2} ${start.y}, ${(start.x + end.x)/2} ${end.y}, ${end.x} ${end.y}`} 
                            stroke="#555" 
                            strokeWidth="2" 
                            fill="none" 
                            strokeDasharray="5,5"
                        />
                        <circle cx={end.x} cy={end.y} r="3" fill="#555" />
                    </g>
                );
            })}
        </svg>
    )
}

const CanvasWorkspace = ({ board, onSave, onBack }: { board: Board, onSave: (b: Board) => void, onBack: () => void }) => {
  const [activeTool, setActiveTool] = useState('select');
  const [currentBoard, setCurrentBoard] = useState<Board>(board);
  const [dragInfo, setDragInfo] = useState<DragInfo>({ isDragging: false, startPos: { x: 0, y: 0 } });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ containerId: string, y: number, width: number } | null>(null);
  const [history, setHistory] = useState<Board[]>([board]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [showTableGrid, setShowTableGrid] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const touchDistanceRef = useRef<number>(0);

  const selectedElement = currentBoard.elements.find(el => el.id === selectedId);

  const clipboardRef = useRef<CanvasElement | null>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const handleKeyDown = (e: React.KeyboardEvent) => {
      const el = selectedElement;
      if (!el) return;
      const tag = (document.activeElement?.tagName || '');
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
          updateBoard({ ...currentBoard, elements: currentBoard.elements.filter(ce => ce.id !== el.id) });
          setSelectedId(null);
          return;
      }
      if (e.key === 'ArrowUp' && e.shiftKey) {
          e.preventDefault();
          const newZ = (el.style?.zIndex || 1) + 1;
          updateBoard({ ...currentBoard, elements: currentBoard.elements.map(ce => ce.id === el.id ? { ...ce, style: { ...ce.style, zIndex: newZ } } : ce) });
          return;
      }
      if (e.key === 'ArrowDown' && e.shiftKey) {
          e.preventDefault();
          const newZ = Math.max((el.style?.zIndex || 1) - 1, 0);
          updateBoard({ ...currentBoard, elements: currentBoard.elements.map(ce => ce.id === el.id ? { ...ce, style: { ...ce.style, zIndex: newZ } } : ce) });
          return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
          e.preventDefault();
          clipboardRef.current = { ...el, id: 'clipboard' };
          return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
          e.preventDefault();
          if (!clipboardRef.current) return;
          const newEl: CanvasElement = { ...clipboardRef.current, id: generateId(), x: el.x + 30, y: el.y + 30 };
          updateBoard({ ...currentBoard, elements: [...currentBoard.elements, newEl] });
          setSelectedId(newEl.id);
          return;
      }
  };

  // Sync prop changes
  useEffect(() => {
      setCurrentBoard(board);
      setHistory([board]);
      setHistoryIndex(0);
  }, [board.id]);

  // Prevent browser wheel-based zoom — only the canvas zooms, not fixed elements
  useEffect(() => {
      const el = canvasRef.current;
      if (!el) return;
      const handler = (e: WheelEvent) => {
          if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              setCurrentBoard(prev => {
                  const zoomSensitivity = 0.001;
                  const delta = -e.deltaY * zoomSensitivity;
                  const newZoom = Math.min(Math.max(prev.viewport.zoom + delta, 0.1), 5);
                  return { ...prev, viewport: { ...prev.viewport, zoom: newZoom } };
              });
          } else {
              setCurrentBoard(prev => ({
                  ...prev, viewport: {
                      ...prev.viewport,
                      x: prev.viewport.x - e.deltaX,
                      y: prev.viewport.y - e.deltaY
                  }
              }));
          }
      };
      el.addEventListener('wheel', handler, { passive: false });
      return () => el.removeEventListener('wheel', handler);
  }, []);

  const updateBoard = useCallback((newBoard: Board, addToHistory = true) => {
    setCurrentBoard(newBoard);
    if (addToHistory) {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newBoard);
        if (newHistory.length > 50) newHistory.shift();
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    }
    // Auto save logic could go here
    onSave(newBoard);
  }, [history, historyIndex, onSave]);

  const handleUndo = () => {
      if (historyIndex > 0) {
          setHistoryIndex(historyIndex - 1);
          const prevBoard = history[historyIndex - 1];
          setCurrentBoard(prevBoard);
          onSave(prevBoard);
      }
  };

  const handleRedo = () => {
      if (historyIndex < history.length - 1) {
          setHistoryIndex(historyIndex + 1);
          const nextBoard = history[historyIndex + 1];
          setCurrentBoard(nextBoard);
          onSave(nextBoard);
      }
  };

  const layoutContainer = useCallback((containerId: string, elements: CanvasElement[]): CanvasElement[] => {
      const container = elements.find(e => e.id === containerId);
      if (!container || container.type !== 'container') return elements;

      const padding = 16;
      const headerHeight = 56; 
      const gap = 16;

      const children = elements.filter(e => e.parentId === containerId);
      
      if (children.length === 0) {
           return elements.map(e => e.id === containerId ? { ...e, height: 150 } : e);
      }

      children.sort((a, b) => a.y - b.y);

      let currentY = container.y + headerHeight + padding;
      const updatedChildren = new Map<string, CanvasElement>();

      children.forEach(child => {
          const newWidth = container.width - (padding * 2);
          let newHeight = child.height;
          if (child.type === 'image') {
               const ratio = child.width / child.height;
               newHeight = newWidth / ratio;
          }
          updatedChildren.set(child.id, {
              ...child,
              x: container.x + padding,
              y: currentY,
              width: newWidth,
              height: newHeight
          });
          currentY += newHeight + gap;
      });

      const newContainerHeight = currentY - container.y + padding;

      return elements.map(e => {
          if (e.id === containerId) return { ...e, height: Math.max(newContainerHeight, 150) }; 
          if (updatedChildren.has(e.id)) return updatedChildren.get(e.id)!;
          return e;
      });
  }, []);

  const handleToolSelect = (toolId: string) => {
      if (toolId === 'image') imageInputRef.current?.click();
      else if (toolId === 'file') fileInputRef.current?.click();
      else if (toolId === 'table') setShowTableGrid(true);
      else setActiveTool(toolId);
  };

  const handleDirectUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'file') => {
      const file = e.target.files?.[0];
      if (!file) return;

      const viewportCenter = {
          x: (window.innerWidth / 2 - currentBoard.viewport.x) / currentBoard.viewport.zoom,
          y: (window.innerHeight / 2 - currentBoard.viewport.y) / currentBoard.viewport.zoom
      };

      const reader = new FileReader();
      reader.onload = (event) => {
          const url = event.target?.result as string;
          if (type === 'image') {
              const img = new Image();
              img.onload = () => {
                  const maxW = 400;
                  const ratio = img.width / img.height;
                  const w = Math.min(img.width, maxW);
                  const h = w / ratio;
                  const newEl: CanvasElement = {
                      id: generateId(), type: 'image',
                      x: viewportCenter.x - w/2, y: viewportCenter.y - h/2,
                      width: w, height: h,
                      content: { url, caption: file.name }, style: { borderRadius: 0 }
                  };
                  updateBoard({ ...currentBoard, elements: [...currentBoard.elements, newEl] });
              };
              img.src = url;
          } else {
              const newEl: CanvasElement = {
                  id: generateId(), type: 'file',
                  x: viewportCenter.x - 100, y: viewportCenter.y - 75,
                  width: 200, height: 150,
                  content: { name: file.name, size: formatBytes(file.size), url }, style: { borderRadius: 0 }
                  };
                  updateBoard({ ...currentBoard, elements: [...currentBoard.elements, newEl] });
          }
      };
      reader.readAsDataURL(file);
      e.target.value = '';
      setActiveTool('select');
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const pos = { x: e.clientX, y: e.clientY };
    const worldPos = screenToWorld({ x: e.clientX - canvasRef.current!.getBoundingClientRect().left, y: e.clientY - canvasRef.current!.getBoundingClientRect().top }, currentBoard.viewport);

    if (selectedElement) {
        const hs = 10 / currentBoard.viewport.zoom;
        const el = selectedElement;
        const corners = {
            nw: { x: el.x, y: el.y }, ne: { x: el.x + el.width, y: el.y },
            sw: { x: el.x, y: el.y + el.height }, se: { x: el.x + el.width, y: el.y + el.height }
        };
        for (const [key, corner] of Object.entries(corners)) {
            if (Math.abs(worldPos.x - corner.x) < hs && Math.abs(worldPos.y - corner.y) < hs) {
                setDragInfo({
                    isDragging: true, startPos: pos, startElPos: { x: el.x, y: el.y, w: el.width, h: el.height },
                    type: 'resize', handle: key as any
                });
                return;
            }
        }
    }

    let hitId = null;
    for (let i = currentBoard.elements.length - 1; i >= 0; i--) {
        const el = currentBoard.elements[i];
        if (worldPos.x >= el.x && worldPos.x <= el.x + el.width && worldPos.y >= el.y && worldPos.y <= el.y + el.height) {
            hitId = el.id;
            break;
        }
    }

    if (activeTool === 'select') {
        if (hitId) {
            setSelectedId(hitId);
            const el = currentBoard.elements.find(e => e.id === hitId)!;
            const childrenStartPos: Record<string, Point> = {};
            if (el.type === 'container') {
                currentBoard.elements.filter(c => c.parentId === el.id).forEach(c => childrenStartPos[c.id] = { x: c.x, y: c.y });
            }
            setDragInfo({
                isDragging: true, startPos: pos, startElPos: { x: el.x, y: el.y, w: el.width, h: el.height },
                childrenStartPos, type: 'move'
            });
        } else {
            setSelectedId(null);
            setDragInfo({ isDragging: true, startPos: pos, type: 'move' }); 
        }
    } else {
        if (['image', 'file', 'table'].includes(activeTool)) return;
        const newEl: CanvasElement = {
            id: generateId(), type: activeTool as ElementType,
            x: worldPos.x, y: worldPos.y,
            width: activeTool === 'container' ? 300 : 200,
            height: activeTool === 'container' ? 150 : 150, 
            content: activeTool === 'todo' ? { title: 'To Do', items: [{ id: '1', text: 'Task 1', done: false, level: 0 }, { id: '2', text: 'Task 2', done: false, level: 0 }] } : '',
            style: { backgroundColor: activeTool === 'note' ? '#1E1E1E' : (activeTool === 'todo' ? '#000000' : 'transparent'), zIndex: activeTool === 'container' ? 0 : 10 }
        };
        if (activeTool === 'note') { newEl.width = 200; newEl.height = 200; newEl.style!.borderRadius = 0; }
        if (activeTool === 'text') { newEl.height = 100; newEl.width = 300; }
        if (activeTool === 'link') { newEl.height = 200; newEl.width = 200; }
        if (activeTool === 'todo') { newEl.height = 300; }
        updateBoard({ ...currentBoard, elements: [...currentBoard.elements, newEl] });
        setSelectedId(newEl.id);
        setActiveTool('select');
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragInfo.isDragging) return;
    const dx = e.clientX - dragInfo.startPos.x;
    const dy = e.clientY - dragInfo.startPos.y;
    const worldPos = screenToWorld({ x: e.clientX - canvasRef.current!.getBoundingClientRect().left, y: e.clientY - canvasRef.current!.getBoundingClientRect().top }, currentBoard.viewport);

    if (dragInfo.type === 'move' && selectedId) {
        const deltaX = dx / currentBoard.viewport.zoom;
        const deltaY = dy / currentBoard.viewport.zoom;
        const newElements = currentBoard.elements.map(el => {
            if (el.id === selectedId) return { ...el, x: (dragInfo.startElPos?.x || 0) + deltaX, y: (dragInfo.startElPos?.y || 0) + deltaY };
            if (dragInfo.childrenStartPos && dragInfo.childrenStartPos[el.id]) return { ...el, x: dragInfo.childrenStartPos[el.id].x + deltaX, y: dragInfo.childrenStartPos[el.id].y + deltaY };
            return el;
        });

        const draggedEl = newElements.find(e => e.id === selectedId);
        if (draggedEl && draggedEl.type !== 'container') {
             const targetContainer = currentBoard.elements.find(e => 
                e.type === 'container' && e.id !== selectedId &&
                worldPos.x >= e.x && worldPos.x <= e.x + e.width && worldPos.y >= e.y && worldPos.y <= e.y + e.height
             );

             if (targetContainer) {
                 const padding = 16;
                 draggedEl.x = targetContainer.x + padding;
                 draggedEl.width = targetContainer.width - (padding * 2);
                 const children = currentBoard.elements.filter(e => e.parentId === targetContainer.id && e.id !== selectedId).sort((a, b) => a.y - b.y);
                 let insertY = targetContainer.y + 56 + padding; 
                 let inserted = false;
                 if (children.length > 0) {
                     for (const child of children) {
                         if (worldPos.y < child.y + child.height/2) { insertY = child.y - 8; inserted = true; break; }
                     }
                     if (!inserted) { const last = children[children.length - 1]; insertY = last.y + last.height + 8; }
                 } else { insertY = targetContainer.y + 56 + padding; }
                 setDropTarget({ containerId: targetContainer.id, y: insertY, width: targetContainer.width - (padding * 2) });
             } else { setDropTarget(null); }
        }
        setDragInfo(prev => ({ ...prev })); // Force update but don't commit to history yet
        setCurrentBoard({ ...currentBoard, elements: newElements }); // Local visual update

    } else if (dragInfo.type === 'resize' && selectedId && dragInfo.startElPos) {
        let newX = dragInfo.startElPos.x, newY = dragInfo.startElPos.y, newW = dragInfo.startElPos.w, newH = dragInfo.startElPos.h;
        const deltaX = dx / currentBoard.viewport.zoom, deltaY = dy / currentBoard.viewport.zoom;
        const isShift = e.shiftKey, aspectRatio = dragInfo.startElPos.w / dragInfo.startElPos.h;

        if (dragInfo.handle?.includes('e')) newW += deltaX;
        if (dragInfo.handle?.includes('w')) { newX += deltaX; newW -= deltaX; }
        if (dragInfo.handle?.includes('s')) newH += deltaY;
        if (dragInfo.handle?.includes('n')) { newY += deltaY; newH -= deltaY; }

        if (isShift) {
            if (dragInfo.handle?.includes('e') || dragInfo.handle?.includes('w')) {
                 const intendedH = newW / aspectRatio;
                 if (dragInfo.handle.includes('n')) newY = newY + (newH - intendedH);
                 newH = intendedH;
            } else {
                 const intendedW = newH * aspectRatio;
                 if (dragInfo.handle.includes('w')) newX = newX + (newW - intendedW);
                 newW = intendedW;
            }
        }
        if (newW < 50) newW = 50; if (newH < 50) newH = 50;
        
        const updatedElements = currentBoard.elements.map(e => e.id === selectedId ? { ...e, x: newX, y: newY, width: newW, height: newH } : e);
        setCurrentBoard({ ...currentBoard, elements: updatedElements });

    } else if (!selectedId) {
        setCurrentBoard({ ...currentBoard, viewport: { ...currentBoard.viewport, x: currentBoard.viewport.x + dx, y: currentBoard.viewport.y + dy } });
        setDragInfo({ ...dragInfo, startPos: { x: e.clientX, y: e.clientY } });
    }
  };

  const handlePointerUp = () => {
    if (dragInfo.isDragging && (dragInfo.type === 'move' || dragInfo.type === 'resize')) {
        let updatedElements = [...currentBoard.elements];
        const draggedEl = selectedId ? updatedElements.find(e => e.id === selectedId) : null;
        
        if (dragInfo.type === 'move' && draggedEl && draggedEl.type !== 'container') {
             const oldParentId = draggedEl.parentId;
             if (dropTarget) {
                 draggedEl.parentId = dropTarget.containerId;
                 draggedEl.y = dropTarget.y; 
                 draggedEl.x = currentBoard.elements.find(e => e.id === dropTarget.containerId)!.x + 16;
                 updatedElements = layoutContainer(dropTarget.containerId, updatedElements);
             } else {
                 let stillInside = false;
                 if (oldParentId) {
                     const p = updatedElements.find(e => e.id === oldParentId);
                     const c = draggedEl;
                     if (p && c.x + c.width/2 > p.x && c.x + c.width/2 < p.x + p.width && c.y + c.height/2 > p.y && c.y + c.height/2 < p.y + p.height) stillInside = true;
                 }
                 if (!stillInside) draggedEl.parentId = undefined;
                 else if (oldParentId) updatedElements = layoutContainer(oldParentId, updatedElements);
             }
             if (oldParentId && oldParentId !== (dropTarget?.containerId) && draggedEl.parentId !== oldParentId) updatedElements = layoutContainer(oldParentId, updatedElements);
        }
        
        if (dragInfo.type === 'resize' && draggedEl) {
             if (draggedEl.type === 'container') updatedElements = layoutContainer(draggedEl.id, updatedElements);
             else if (draggedEl.parentId) updatedElements = layoutContainer(draggedEl.parentId, updatedElements);
        }
        updateBoard({ ...currentBoard, elements: updatedElements }, true);
    }
    setDragInfo({ ...dragInfo, isDragging: false });
    setDropTarget(null);
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const zoomSensitivity = 0.001;
        const delta = -e.deltaY * zoomSensitivity;
        const newZoom = Math.min(Math.max(currentBoard.viewport.zoom + delta, 0.1), 5);
        setCurrentBoard({ ...currentBoard, viewport: { ...currentBoard.viewport, zoom: newZoom } });
    } else {
        setCurrentBoard({ ...currentBoard, viewport: { ...currentBoard.viewport, x: currentBoard.viewport.x - e.deltaX, y: currentBoard.viewport.y - e.deltaY } });
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
          const item = items[i];
          if (item.type.indexOf('image') !== -1) {
              const blob = item.getAsFile();
              if (blob) {
                  const reader = new FileReader();
                  reader.onload = (event) => {
                      const img = new Image();
                      img.onload = () => {
                          const maxW = 400;
                          const ratio = img.width / img.height;
                          const w = Math.min(img.width, maxW);
                          const h = w / ratio;
                          const worldPos = screenToWorld({ x: window.innerWidth/2, y: window.innerHeight/2 }, currentBoard.viewport);
                          const newEl: CanvasElement = {
                              id: generateId(), type: 'image',
                              x: worldPos.x - w/2, y: worldPos.y - h/2,
                              width: w, height: h,
                              content: { url: event.target?.result as string, caption: '' }, style: { borderRadius: 0 }
                          };
                          updateBoard({ ...currentBoard, elements: [...currentBoard.elements, newEl] });
                      };
                      img.src = event.target?.result as string;
                  };
                  reader.readAsDataURL(blob);
              }
          }
      }
  };

  const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      const files = Array.from(e.dataTransfer.files) as File[];
      if (files.length === 0) return;
      const worldPos = screenToWorld({ x: e.clientX, y: e.clientY }, currentBoard.viewport);
      files.forEach((file, index) => {
          const reader = new FileReader();
          reader.onload = (event) => {
              const url = event.target?.result as string;
              if (file.type.startsWith('image/')) {
                  const img = new Image();
                  img.onload = () => {
                      const maxW = 400;
                      const ratio = img.width / img.height;
                      const w = Math.min(img.width, maxW);
                      const h = w / ratio;
                      const newEl: CanvasElement = {
                          id: generateId(), type: 'image',
                          x: worldPos.x + (index * 20), y: worldPos.y + (index * 20),
                          width: w, height: h,
                          content: { url, caption: file.name }, style: { borderRadius: 0 }
                      };
                      updateBoard({ ...currentBoard, elements: [...currentBoard.elements, newEl] });
                  };
                  img.src = url;
              } else {
                  const newEl: CanvasElement = {
                      id: generateId(), type: 'file',
                      x: worldPos.x + (index * 20), y: worldPos.y + (index * 20),
                      width: 200, height: 150,
                      content: { name: file.name, size: formatBytes(file.size), url }, style: { borderRadius: 0 }
                  };
                   updateBoard({ ...currentBoard, elements: [...currentBoard.elements, newEl] });
              }
          };
          reader.readAsDataURL(file);
      });
  };

  const renderElement = (el: CanvasElement) => {
      const isSelected = selectedId === el.id;
      let Component;
      switch(el.type) {
          case 'text': Component = TextElement; break;
          case 'note': Component = NoteElement; break;
          case 'todo': Component = TodoElement; break;
          case 'image': Component = ImageElement; break;
          case 'file': Component = FileElement; break;
          case 'link': Component = LinkElement; break;
          case 'table': Component = TableElement; break;
          case 'container': Component = ContainerElement; break;
          default: Component = () => null;
      }
      let extraProps = {};
      if (el.type === 'container') extraProps = { cardCount: currentBoard.elements.filter(c => c.parentId === el.id).length };
      const isContainer = el.type === 'container';
      let finalZ = el.style?.zIndex || 0;
      if (isContainer) finalZ = isSelected ? 10 : 0; 
      else { finalZ = Math.max(finalZ, 0) + 20; if (isSelected) finalZ += 1000; }

      const handleElementChange = (patch: any) => {
          let newElements = currentBoard.elements.map(e => e.id === el.id ? { ...e, ...patch, style: { ...e.style, ...patch?.style } } : e);
          const updatedEl = newElements.find(e => e.id === el.id);
          if (updatedEl && updatedEl.parentId) newElements = layoutContainer(updatedEl.parentId, newElements);
          updateBoard({ ...currentBoard, elements: newElements }, false); 
      };

      return (
        <div
            key={el.id}
            className={`absolute transition-shadow ${isSelected ? 'ring-1 ring-[#00FF9D]' : ''} ${el.type === 'note' ? 'shadow-lg' : ''}`}
            style={{
                left: el.x, top: el.y, width: el.width, height: el.height, zIndex: finalZ, borderRadius: el.style?.borderRadius || 0,
            }}
        >
            <Component element={el} isSelected={isSelected} onChange={handleElementChange} onOpenLightbox={(url: string) => setLightboxUrl(url)} {...extraProps} />
            {isSelected && (
                <>
                    {['nw', 'ne', 'sw', 'se'].map((h) => (
                        <div key={h} className="absolute w-3 h-3 bg-white border border-[#00FF9D] rounded-full z-[101]"
                            style={{ top: h.startsWith('n') ? -4 : 'auto', bottom: h.startsWith('s') ? -4 : 'auto', left: h.endsWith('w') ? -4 : 'auto', right: h.endsWith('e') ? -4 : 'auto', cursor: `${h}-resize` }}
                        />
                    ))}
                    <div className="absolute -top-8 right-0 bg-red-500/80 p-1.5 rounded text-white cursor-pointer hover:bg-red-500 z-10" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); updateBoard({...currentBoard, elements: currentBoard.elements.filter(e => e.id !== el.id)})}}>
                        <Trash2 size={12} />
                    </div>
                </>
            )}
        </div>
      );
  };

  return (
    <div 
        className="w-screen h-screen bg-[#121212] overflow-hidden relative select-none"
        onPaste={handlePaste} onDragOver={(e) => e.preventDefault()} onDrop={handleDrop} onKeyDown={handleKeyDown} tabIndex={0}
        style={{
            backgroundImage: 'radial-gradient(#333 1px, transparent 1px)',
            backgroundSize: `${20 * currentBoard.viewport.zoom}px ${20 * currentBoard.viewport.zoom}px`,
            backgroundPosition: `${currentBoard.viewport.x}px ${currentBoard.viewport.y}px`
        }}
    >
      <div 
        ref={canvasRef}
        className="w-full h-full relative origin-top-left"
        onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}
        onTouchStart={(e) => { if (e.touches.length === 2) { e.preventDefault(); const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); touchDistanceRef.current = d; } }}
        onTouchMove={(e) => { if (e.touches.length === 2) { e.preventDefault(); const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); const s = d / (touchDistanceRef.current || 1); const z = Math.min(Math.max(currentBoard.viewport.zoom * s, 0.1), 5); setCurrentBoard({ ...currentBoard, viewport: { ...currentBoard.viewport, zoom: z } }); touchDistanceRef.current = d; } }}
        style={{ touchAction: 'none' }}
      >
         <div className="absolute origin-top-left w-[10000px] h-[10000px]" style={{ transform: `translate(${currentBoard.viewport.x}px, ${currentBoard.viewport.y}px) scale(${currentBoard.viewport.zoom})` }}>
             <ConnectionLayer connections={currentBoard.connections} elements={currentBoard.elements} />
             {currentBoard.elements.map(renderElement)}
             {dropTarget && (
                 <div className="absolute h-1 bg-[#00FF9D] rounded-full shadow-[0_0_10px_#00FF9D] transition-all pointer-events-none z-[50]"
                    style={{ left: currentBoard.elements.find(e => e.id === dropTarget.containerId)!.x + 16, top: dropTarget.y, width: dropTarget.width }}
                 />
             )}
         </div>
      </div>
      <Toolbar activeTool={activeTool} onSelectTool={handleToolSelect} onUndo={handleUndo} onRedo={handleRedo} onHome={onBack} />
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleDirectUpload(e, 'image')} />
      <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => handleDirectUpload(e, 'file')} />
      <PropertyPanel element={selectedElement} onChange={(patch: any) => updateBoard({ ...currentBoard, elements: currentBoard.elements.map(e => e.id === selectedId ? { ...e, ...patch, style: { ...e.style, ...patch.style } } : e) })} onDelete={() => { updateBoard({ ...currentBoard, elements: currentBoard.elements.filter(e => e.id !== selectedId) }); setSelectedId(null); }} onAI={async () => { if (selectedElement && selectedElement.type === 'text') { const newText = await generateTextEnhancement("改进文本清晰度和语法", selectedElement.content); updateBoard({ ...currentBoard, elements: currentBoard.elements.map(e => e.id === selectedId ? { ...e, content: newText } : e) }); } }} />
      {showTableGrid && <GridSelector onClose={() => setShowTableGrid(false)} onSelect={(rows, cols) => { const centerPos = { x: (window.innerWidth / 2 - currentBoard.viewport.x) / currentBoard.viewport.zoom - (cols * 50), y: (window.innerHeight / 2 - currentBoard.viewport.y) / currentBoard.viewport.zoom - (rows * 20) }; const newEl: CanvasElement = { id: generateId(), type: 'table', x: centerPos.x, y: centerPos.y, width: cols * 100, height: rows * 40, content: { rows, cols, data: {} }, style: { backgroundColor: '#1a1a1a', zIndex: currentBoard.elements.length + 1 } }; updateBoard({ ...currentBoard, elements: [...currentBoard.elements, newEl] }); setShowTableGrid(false); setSelectedId(newEl.id); setActiveTool('select'); }} />}
      {lightboxUrl && <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
      <div className="fixed bottom-4 right-4 flex items-center gap-2">
          <div className="bg-black/50 px-3 py-1 rounded-full text-xs text-gray-500 font-mono pointer-events-none">{Math.round(currentBoard.viewport.zoom * 100)}%</div>
          <div className="relative">
              <button onClick={() => setShowShortcuts(!showShortcuts)} className="bg-black/50 hover:bg-black/70 px-2 py-1 rounded-full text-xs text-gray-400 transition-colors">快捷键</button>
              {showShortcuts && (
                  <div className="absolute bottom-8 right-0 bg-[#1a1a1a] border border-[#333] rounded-xl p-4 shadow-2xl w-64 text-xs text-gray-300 z-50" onClick={() => setShowShortcuts(false)}>
                      <div className="font-bold text-[#00FF9D] mb-3 text-sm">快捷键</div>
                      <div className="space-y-2">
                          <div><span className="text-white bg-[#333] px-1.5 py-0.5 rounded text-[10px]">Shift</span> + <span className="text-white bg-[#333] px-1.5 py-0.5 rounded text-[10px]">↑</span> 上移一层</div>
                          <div><span className="text-white bg-[#333] px-1.5 py-0.5 rounded text-[10px]">Shift</span> + <span className="text-white bg-[#333] px-1.5 py-0.5 rounded text-[10px]">↓</span> 下移一层</div>
                          <div><span className="text-white bg-[#333] px-1.5 py-0.5 rounded text-[10px]">Ctrl</span> + <span className="text-white bg-[#333] px-1.5 py-0.5 rounded text-[10px]">C</span> 复制组件</div>
                          <div><span className="text-white bg-[#333] px-1.5 py-0.5 rounded text-[10px]">Ctrl</span> + <span className="text-white bg-[#333] px-1.5 py-0.5 rounded text-[10px]">V</span> 粘贴组件</div>
                          <div><span className="text-white bg-[#333] px-1.5 py-0.5 rounded text-[10px]">Delete</span> 删除组件</div>
                      </div>
                  </div>
              )}
          </div>
      </div>
    </div>
  );
}

// --- Home Dashboard ---

const HomeDashboard = ({ boards, onOpenBoard, onCreateBoard, onDeleteBoard, onUpdateBoard, onReorderBoards, onLogout, username }: any) => {
    const [isCreating, setIsCreating] = useState(false);
    const [newBoardName, setNewBoardName] = useState('');
    const [newBoardIcon, setNewBoardIcon] = useState('📁');
    const [showIconPicker, setShowIconPicker] = useState(false);
    const [draggedBoardIndex, setDraggedBoardIndex] = useState<number | null>(null);

    const EMOJIS = ['📁', '🚀', '💡', '🎨', '📝', '🧠', '💼', '🏠', '🎯', '✨', '🔥', '🌈', '💻', '📚', '🛠️', '🎮'];

    const handleCreate = () => {
        if (!newBoardName.trim()) return;
        onCreateBoard(newBoardName, newBoardIcon);
        setIsCreating(false);
        setNewBoardName('');
        setNewBoardIcon('📁');
    };

    const handleDragStart = (e: React.DragEvent, index: number) => {
        setDraggedBoardIndex(index);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedBoardIndex === null || draggedBoardIndex === index) return;
        onReorderBoards(draggedBoardIndex, index);
        setDraggedBoardIndex(index);
    };

    const handleDragEnd = () => {
        setDraggedBoardIndex(null);
    };

    return (
        <div className="min-h-screen bg-[#121212] text-white p-4 sm:p-6 md:p-10 font-sans">
            <header className="mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-0 justify-between">
                <div className="flex items-center gap-3 sm:gap-4">
                    <img src="/抠图logo.png" alt="Stella" className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg flex-shrink-0 object-cover" />
                    <h1 className="text-xl sm:text-3xl font-bold font-serif tracking-tight">Stella's Note</h1>
                </div>
                <div className="flex items-center gap-2 sm:gap-3 self-end sm:self-auto">
                    {username && <span className="text-xs sm:text-sm text-gray-500">{username}</span>}
                    {onLogout && (
                        <button onClick={onLogout} className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm text-gray-400 hover:text-white bg-[#1E1E1E] hover:bg-[#2A2A2A] rounded-lg sm:rounded-xl transition-colors">
                            <LogOut size={14} /> <span className="hidden sm:inline">退出</span>
                        </button>
                    )}
                </div>
            </header>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 md:gap-6">
                {/* Create New Card */}
                <div onClick={() => setIsCreating(true)}
                    className="aspect-square bg-[#1E1E1E] border border-dashed border-[#333] hover:border-[#00FF9D] hover:bg-[#1E1E1E]/80 rounded-xl sm:rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all group">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-[#2A2A2A] group-hover:bg-[#00FF9D] flex items-center justify-center transition-colors mb-2 sm:mb-4">
                        <Plus className="text-gray-400 group-hover:text-black" size={20} />
                    </div>
                    <span className="text-xs sm:text-sm text-gray-400 font-medium group-hover:text-white">新建</span>
                </div>

                {/* Board Cards */}
                {boards.map((board: Board, index: number) => (
                    <div 
                        key={board.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        onClick={() => onOpenBoard(board.id)}
                        className="aspect-square bg-[#1E1E1E] border border-[#333] hover:border-gray-500 rounded-xl sm:rounded-2xl p-4 sm:p-6 flex flex-col relative group cursor-pointer transition-all hover:translate-y-[-2px] hover:shadow-xl"
                    >
                        <div className="flex-1 flex flex-col items-center justify-center">
                            <div className="text-5xl mb-4 select-none">{board.icon}</div>
                            <h3 className="text-lg font-bold text-center text-gray-200 group-hover:text-white truncate w-full px-2">{board.name}</h3>
                            <span className="text-xs text-gray-600 mt-2">{board.elements.length} 个元素</span>
                        </div>
                        
                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                             <button 
                                onClick={(e) => { e.stopPropagation(); onDeleteBoard(board.id); }}
                                className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg"
                                title="删除画板"
                             >
                                 <Trash2 size={14} />
                             </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Create Modal */}
            {isCreating && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-in fade-in duration-200">
                    <div className="bg-[#1E1E1E] border border-[#333] p-6 rounded-2xl w-96 shadow-2xl">
                        <h2 className="text-xl font-bold mb-4">创建新画板</h2>
                        
                        <div className="flex gap-4 mb-4">
                            <div className="relative">
                                <button 
                                    onClick={() => setShowIconPicker(!showIconPicker)}
                                    className="w-12 h-12 bg-[#2A2A2A] rounded-xl flex items-center justify-center text-2xl border border-[#333] hover:border-[#00FF9D]"
                                >
                                    {newBoardIcon}
                                </button>
                                {showIconPicker && (
                                    <div className="absolute top-14 left-0 bg-[#2A2A2A] border border-[#333] p-2 rounded-xl grid grid-cols-4 gap-1 w-48 shadow-xl z-10">
                                        {EMOJIS.map(emoji => (
                                            <button key={emoji} onClick={() => { setNewBoardIcon(emoji); setShowIconPicker(false); }} className="p-2 hover:bg-[#333] rounded text-xl">
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <input 
                                className="flex-1 bg-[#121212] border border-[#333] rounded-xl px-4 outline-none focus:border-[#00FF9D] text-white"
                                placeholder="画板名称"
                                autoFocus
                                value={newBoardName}
                                onChange={(e) => setNewBoardName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                            />
                        </div>

                        <div className="flex justify-end gap-2">
                            <button onClick={() => setIsCreating(false)} className="px-4 py-2 text-gray-400 hover:text-white">取消</button>
                            <button onClick={handleCreate} className="px-4 py-2 bg-[#00FF9D] text-black font-bold rounded-xl hover:bg-[#00FF9D]/90">创建</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const BG_IMAGE_1 = 'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260609_195923_b0ba8ace-1d1d-4f2c-9a28-1ab84b330680.png&w=1280&q=85';
const BG_IMAGE_2 = 'https://images.higgs.ai/?default=1&output=webp&url=https%3A%2F%2Fd8j0ntlcm91z4.cloudfront.net%2Fuser_38xzZboKViGWJOttwIXH07lWA1P%2Fhf_20260609_201152_bba90a12-bf12-459f-91f0-51f237dbaf3b.png&w=1280&q=85';
const SPOTLIGHT_R = 260;

const RevealLayer = ({ image, cx, cy }: { image: string; cx: number; cy: number }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
    useEffect(() => {
        const handle = () => setSize({ w: window.innerWidth, h: window.innerHeight });
        window.addEventListener('resize', handle);
        return () => window.removeEventListener('resize', handle);
    }, []);
    useEffect(() => {
        const c = canvasRef.current;
        if (!c) return;
        c.width = size.w; c.height = size.h;
        const ctx = c.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, size.w, size.h);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, SPOTLIGHT_R);
        g.addColorStop(0, 'rgba(255,255,255,1)');
        g.addColorStop(0.4, 'rgba(255,255,255,1)');
        g.addColorStop(0.6, 'rgba(255,255,255,0.75)');
        g.addColorStop(0.75, 'rgba(255,255,255,0.4)');
        g.addColorStop(0.88, 'rgba(255,255,255,0.12)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, SPOTLIGHT_R, 0, Math.PI * 2); ctx.fill();
    }, [cx, cy, size]);
    const dataUrl = canvasRef.current?.toDataURL() || '';
    return (
        <>
            <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" style={{ display: 'none' }} />
            <div className="absolute inset-0 bg-center bg-cover bg-no-repeat z-30 pointer-events-none"
                style={{ backgroundImage: `url(${image})`, maskImage: dataUrl ? `url(${dataUrl})` : undefined, WebkitMaskImage: dataUrl ? `url(${dataUrl})` : undefined, maskSize: '100% 100%', WebkitMaskSize: '100% 100%' }} />
        </>
    );
};

// --- Auth Screen with Cursor Spotlight ---

const AuthScreen = ({ registerLockRef }: { registerLockRef?: React.MutableRefObject<boolean> }) => {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState<string[]>(Array(6).fill(''));
    const [agreeTerms, setAgreeTerms] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [countdown, setCountdown] = useState(0);
    const [codeSent, setCodeSent] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Cursor spotlight
    const [cursorPos, setCursorPos] = useState({ x: -999, y: -999 });
    const mouse = useRef({ x: -999, y: -999 });
    const smooth = useRef({ x: -999, y: -999 });
    const rafRef = useRef<number>(0);
    useEffect(() => {
        const onMouse = (e: MouseEvent) => { mouse.current.x = e.clientX; mouse.current.y = e.clientY; };
        window.addEventListener('mousemove', onMouse);
        const loop = () => { smooth.current.x += (mouse.current.x - smooth.current.x) * 0.1; smooth.current.y += (mouse.current.y - smooth.current.y) * 0.1; setCursorPos({ x: smooth.current.x, y: smooth.current.y }); rafRef.current = requestAnimationFrame(loop); };
        rafRef.current = requestAnimationFrame(loop);
        return () => { window.removeEventListener('mousemove', onMouse); cancelAnimationFrame(rafRef.current); };
    }, []);

    useEffect(() => { if (codeSent && otpRefs.current[0]) setTimeout(() => otpRefs.current[0]?.focus(), 200); }, [codeSent]);
    useEffect(() => { if (countdown > 0) { const t = setTimeout(() => setCountdown(c => c - 1), 1000); return () => clearTimeout(t); } }, [countdown]);

    const isEmailValid = (e: string) => {
        if (!e || !e.trim()) return false;
        const parts = e.trim().split('@');
        if (parts.length !== 2) return false;
        const [local, domain] = parts;
        if (!local || local.length < 1) return false;
        if (!domain || !domain.includes('.')) return false;
        const tld = domain.split('.').pop() || '';
        if (tld.length < 2) return false;
        if (/^(test|fake|invalid|example|user|temp)/i.test(local)) return false;
        if (/^(example|test|invalid|localhost)\./i.test(domain)) return false;
        return true;
    };
    const canSendCode = isEmailValid(email) && !loading && countdown === 0;
    const canRegister = !!username.trim() && isEmailValid(email) && password.length >= 8 && otp.join('').length === 6 && agreeTerms && !loading;
    const canLogin = isEmailValid(email) && !!password && !loading;

    const handleSendCode = async () => {
        if (!isEmailValid(email)) { setError('请输入有效的邮箱地址'); return; }
        setError(''); setMessage(''); setLoading(true);
        try {
            // 先通过数据库函数检查邮箱是否已被注册（不会发任何邮件）
            const { data: exists, error: rpcError } = await supabase.rpc('check_email_exists', { email_to_check: email.trim() });
            if (exists) {
                setMessage('该邮箱已注册，已自动切换至登录页面');
                setTimeout(() => { setMode('login'); setPassword(''); setMessage(''); }, 1500);
                return;
            }
            // 没注册过 → 正常发验证码
            const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
            if (error) throw error;
            setMessage('验证码已发送，请查看你的邮箱'); setCodeSent(true); setCountdown(60);
        } catch (err: any) {
            const raw = err?.message || err?.error_description || err?.msg || err?.error || '';
            if (typeof raw === 'string' && (raw.includes('function') && raw.includes('check_email_exists'))) {
                setError('请先在 Supabase SQL Editor 中运行 RPC 创建脚本');
            } else {
                setError('发送验证码失败，请检查邮箱地址是否正确');
            }
        }
        finally { setLoading(false); }
    };
    const handleOtpChange = (i: number, v: string) => {
        if (v && !/^\d$/.test(v)) return; const n = [...otp]; n[i] = v; setOtp(n);
        if (error) setError(''); if (v && i < 5) otpRefs.current[i + 1]?.focus();
    };
    const handleOtpKeyDown = (i: number, e: React.KeyboardEvent) => {
        if (e.key === 'Backspace') {
            if (!otp[i] && i > 0) { const n = [...otp]; n[i - 1] = ''; setOtp(n); otpRefs.current[i - 1]?.focus(); }
            else { const n = [...otp]; n[i] = ''; setOtp(n); }
        }
    };
    const handleOtpPaste = (e: React.ClipboardEvent) => { e.preventDefault(); const p = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6); if (p.length !== 6) return; setOtp(p.split('')); };
    const handleRegister = async () => {
        if (!canRegister) return; setLoading(true); setError('');
        if (registerLockRef) registerLockRef.current = true;
        try {
            const { error: verifyErr } = await supabase.auth.verifyOtp({ email: email.trim(), token: otp.join(''), type: 'email' });
            if (verifyErr) throw new Error('验证码无效或已过期');
            // 验证通过后检查该邮箱是否已有画板数据（判断是否已注册过）
            const { data: sessionData } = await supabase.auth.getSession();
            if (sessionData?.session?.user?.id) {
                const { data: existingBoards } = await supabase.from('boards').select('id').eq('user_id', sessionData.session.user.id).limit(1);
                if (existingBoards && existingBoards.length > 0) {
                    await supabase.auth.signOut();
                    throw new Error('该邮箱已被注册，请直接登录');
                }
            }
            await supabase.auth.updateUser({ password, data: { username } });
            await supabase.auth.signOut();
            if (registerLockRef) registerLockRef.current = false;
            setSuccessMsg('注册成功！请登录'); setMode('login'); setCodeSent(false);
            setOtp(Array(6).fill('')); setPassword(''); setUsername(''); setAgreeTerms(false);
        } catch (err: any) { setError(err.message || '注册失败'); if (registerLockRef) registerLockRef.current = false; }
        finally { setLoading(false); }
    };
    const handleLogin = async () => {
        if (!canLogin) return; setLoading(true); setError('');
        try {
            const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
            if (error) {
                if (error.message.includes('Invalid login credentials')) {
                    // 登录失败 → 自动跳转注册，保留邮箱
                    setMessage('该账号未注册，已自动为您跳转注册页面');
                    setMode('register');
                    setPassword('');
                    return;
                }
                throw error;
            }
        } catch (err: any) { setError(err.message || '登录失败'); }
        finally { setLoading(false); }
    };
    const switchMode = () => {
        setMode(mode === 'login' ? 'register' : 'login');
        setError(''); setMessage(''); setCodeSent(false);
        setOtp(Array(6).fill('')); setPassword(''); setUsername(''); setSuccessMsg('');
    };

    const inputClass = "w-full bg-[#0A0A0A] border border-[#222] rounded-xl px-4 py-3 text-white text-sm focus:border-[#00FF9D] outline-none transition-all placeholder:text-gray-700";

    return (
        <div className="min-h-screen relative overflow-hidden bg-black" style={{ height: '100dvh' }}>
            {/* Base image */}
            <div className="absolute inset-0 bg-center bg-cover bg-no-repeat z-10" style={{ backgroundImage: `url(${BG_IMAGE_1})` }} />
            {/* Reveal layer with spotlight */}
            <RevealLayer image={BG_IMAGE_2} cx={cursorPos.x} cy={cursorPos.y} />
            {/* Dark overlay */}
            <div className="absolute inset-0 bg-black/50 z-20" />
            {/* Auth form */}
            <div className="absolute inset-0 z-40 flex items-center justify-center p-4">
                <div className="w-full max-w-sm text-center">
                    <img src="/抠图logo.png" alt="Stella's Note" className="w-32 h-32 mx-auto mb-4 rounded-2xl" />
                    <h1 className="text-2xl font-bold text-white font-playfair mb-8">Stella's Note</h1>
                    <div className="bg-[#141414]/90 backdrop-blur-md border border-[#222] rounded-2xl p-7 shadow-2xl relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-[#00FF9D] via-[#00B8FF] to-[#FF00FF]" />
                        {successMsg && <div className="mb-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs p-3 rounded-xl">{successMsg}</div>}

                        {mode === 'register' && (
                            <div className="space-y-3.5 text-left">
                                <h2 className="text-lg font-bold text-white text-center">创建账号</h2>
                                <input type="text" placeholder="用户名" value={username} onChange={(e) => setUsername(e.target.value)} className={inputClass} />
                                <div className="flex gap-2">
                                    <input type="email" placeholder="邮箱" value={email} onChange={(e) => setEmail(e.target.value)} className={`flex-1 ${inputClass}`} />
                                    <button onClick={handleSendCode} disabled={!canSendCode}
                                        className={`px-3 py-3 font-bold rounded-xl transition-all text-xs whitespace-nowrap ${countdown > 0 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-[#00FF9D]/10 text-[#00FF9D] border border-[#00FF9D]/20 hover:bg-[#00FF9D]/20'} disabled:opacity-40 disabled:cursor-not-allowed`}>
                                        {loading ? <Loader2 className="animate-spin" size={16} /> : countdown > 0 ? `${countdown}s` : '发送验证码'}
                                    </button>
                                </div>
                                {message && <div className="bg-emerald-500/10 text-emerald-400 text-xs p-3 rounded-xl">{message}</div>}
                                {codeSent && (
                                    <div><p className="text-gray-500 text-xs mb-2">请输入6位验证码</p>
                                        <div className="flex justify-center gap-2.5" onPaste={handleOtpPaste}>
                                            {otp.map((d, i) => (<input key={i} ref={(el) => { otpRefs.current[i] = el; }} type="text" inputMode="numeric" maxLength={1} value={d}
                                                onChange={(e) => handleOtpChange(i, e.target.value)} onKeyDown={(e) => handleOtpKeyDown(i, e)} disabled={loading}
                                                className={`w-10 h-12 sm:w-11 sm:h-13 bg-[#0A0A0A] border-2 rounded-xl text-center text-white text-lg font-bold outline-none transition-all ${d ? 'border-[#00FF9D] shadow-[0_0_12px_rgba(0,255,157,0.15)]' : 'border-[#222] focus:border-gray-500'} ${loading ? 'opacity-50' : ''}`} />))}
                                        </div></div>
                                )}
                                <div className="relative">
                                    <input type={showPassword ? 'text' : 'password'} placeholder="密码（至少8个字符）" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass + ' pr-10'} />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                                </div>
                                <label className="flex items-start gap-2 cursor-pointer">
                                    <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} className="mt-0.5 accent-[#00FF9D]" />
                                    <span className="text-gray-500 text-xs text-left">我已阅读并同意服务条款和隐私政策</span>
                                </label>
                                {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl">{error}</div>}
                                <button onClick={handleRegister} disabled={!canRegister}
                                    className="w-full bg-[#00FF9D] hover:bg-[#00FF9D]/90 disabled:bg-[#00FF9D]/20 disabled:text-[#00FF9D]/50 disabled:cursor-not-allowed text-black font-bold py-3.5 rounded-xl transition-all text-sm">
                                    {loading ? <Loader2 className="animate-spin mx-auto" size={18} /> : '注册'}
                                </button>
                                <div className="text-center pt-1"><button onClick={switchMode} className="text-gray-500 hover:text-white text-xs transition-colors">已有账号？去登录</button></div>
                            </div>
                        )}
                        {mode === 'login' && (
                            <div className="space-y-4 text-left">
                                <h2 className="text-lg font-bold text-white text-center">登录</h2>
                                <input type="email" placeholder="邮箱" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && canLogin && handleLogin()} className={inputClass} />
                                <div className="relative">
                                    <input type={showPassword ? 'text' : 'password'} placeholder="密码" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && canLogin && handleLogin()} className={inputClass + ' pr-10'} />
                                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                                </div>
                                {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs p-3 rounded-xl">{error}</div>}
                                <button onClick={handleLogin} disabled={!canLogin}
                                    className="w-full bg-[#00FF9D] hover:bg-[#00FF9D]/90 disabled:bg-[#00FF9D]/20 disabled:text-[#00FF9D]/50 disabled:cursor-not-allowed text-black font-bold py-3.5 rounded-xl transition-all text-sm">
                                    {loading ? <Loader2 className="animate-spin mx-auto" size={18} /> : '登录'}
                                </button>
                                <div className="text-center pt-1"><button onClick={switchMode} className="text-gray-500 hover:text-white text-xs transition-colors">还没有账号？去注册 →</button></div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Root App with Auth + Supabase Sync ---

export default function App() {
    const [session, setSession] = useState<any>(null);
    const [authLoading, setAuthLoading] = useState(true);
    const registerLockRef = useRef(false);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => { if (!registerLockRef.current) setSession(session); setAuthLoading(false); });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!registerLockRef.current) setSession(session);
            setAuthLoading(false);
        });
        return () => subscription.unsubscribe();
    }, []);

    const [boards, setBoards] = useState<Board[]>([]);
    const [boardLoading, setBoardLoading] = useState(true);
    const [activeBoardId, setActiveBoardId] = useState<string | null>(null);

    useEffect(() => {
        if (!session) { setBoardLoading(false); setBoards([]); return; }
        setBoardLoading(true);
        supabase.from('boards').select('*').eq('user_id', session.user.id).order('last_modified', { ascending: false })
            .then(({ data, error }) => {
                if (error) { console.warn('Sync error:', error.message); setBoardLoading(false); return; }
                if (data && data.length > 0) {
                    setBoards(data.map((b: any) => ({
                        id: b.id, name: b.name, icon: b.icon || '📁',
                        elements: b.data?.elements || [], connections: b.data?.connections || [],
                        viewport: b.data?.viewport || { x: 0, y: 0, zoom: 1 }, lastModified: b.last_modified,
                    })));
                } else {
                    const welcome = { id: crypto.randomUUID(), name: '欢迎画板', icon: '👋', elements: [], connections: [], lastModified: Date.now(), viewport: { x: 0, y: 0, zoom: 1 } };
                    setBoards([welcome]);
                    supabase.from('boards').insert({ id: welcome.id, user_id: session.user.id, name: welcome.name, icon: welcome.icon,
                        data: { elements: welcome.elements, connections: welcome.connections, viewport: welcome.viewport }, last_modified: welcome.lastModified }).then(() => {}, (e: any) => console.warn('DB insert error:', e));
                }
                setBoardLoading(false);
            });
    }, [session?.user?.id]);

    useEffect(() => {
        if (!session || boards.length === 0) return;
        const timeout = setTimeout(() => {
            for (const board of boards) {
                supabase.from('boards').upsert({ id: board.id, user_id: session.user.id, name: board.name, icon: board.icon || '📁',
                    data: { elements: board.elements, connections: board.connections, viewport: board.viewport, trashed: board.trashed || false },
                    last_modified: Date.now() }).then(() => {}, (e: any) => console.warn('DB upsert error:', e));
            }
        }, 500);
        return () => clearTimeout(timeout);
    }, [session?.user?.id, boards]);

    const activeBoard = boards.find(b => b.id === activeBoardId);

    const handleCreateBoard = (name: string, icon: string) => {
        const newBoard: Board = { id: crypto.randomUUID(), name, icon, elements: [], connections: [], lastModified: Date.now(), viewport: { x: 0, y: 0, zoom: 1 } };
        setBoards([...boards, newBoard]);
    };
    const handleDeleteBoard = (id: string) => setBoards(boards.filter(b => b.id !== id));
    const handleUpdateBoard = (updatedBoard: Board) => setBoards(boards.map(b => b.id === updatedBoard.id ? updatedBoard : b));
    const handleReorderBoards = (fromIndex: number, toIndex: number) => {
        const newBoards = [...boards]; const [moved] = newBoards.splice(fromIndex, 1); newBoards.splice(toIndex, 0, moved); setBoards(newBoards);
    };
    const handleLogout = () => supabase.auth.signOut();

    if (authLoading) return <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center"><Loader2 className="text-[#00FF9D] animate-spin" size={48} /></div>;
    if (!session) return <AuthScreen registerLockRef={registerLockRef} />;

    return activeBoardId && activeBoard ? (
        <CanvasWorkspace board={activeBoard} onSave={handleUpdateBoard} onBack={() => setActiveBoardId(null)} />
    ) : (
        <HomeDashboard boards={boards} onOpenBoard={setActiveBoardId} onCreateBoard={handleCreateBoard} onDeleteBoard={handleDeleteBoard}
            onUpdateBoard={handleUpdateBoard} onReorderBoards={handleReorderBoards} onLogout={handleLogout}
            username={session?.user?.user_metadata?.username || ''} />
    );
}
    