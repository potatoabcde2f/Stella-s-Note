
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Plus, Minus, Undo, Redo, Trash2, ArrowRight, Sparkles, 
  CheckSquare, Type, Box, Globe, ExternalLink, Layout,
  Quote, FileIcon, ImageIcon, Download, Table as TableIcon,
  AlignLeft, AlignCenter, AlignRight, Calendar, GripVertical, X, MoreVertical, Maximize2, Upload, RefreshCw,
  Home, FolderPlus, Edit2, ChevronLeft, LogOut, Loader2, Lock, Mail, RotateCcw, Pen
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
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// --- Markdown Renderer ---
const MarkdownRenderer = ({ text, style }: { text: string, style?: any }) => {
    if (!text) return <span className="text-gray-500 italic select-none pointer-events-none">Double click to edit...</span>;
    const lines = text.split('\n');
    const renderedLines = [];
    let inCodeBlock = false;
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        if (line.startsWith('```')) { inCodeBlock = !inCodeBlock; continue; }
        if (inCodeBlock) { renderedLines.push(<div key={i} className="font-mono bg-black/30 px-2 py-0.5 text-sm text-green-400 my-1 rounded">{line}</div>); continue; }
        if (line.startsWith('# ')) { renderedLines.push(<h1 key={i} className="text-2xl font-bold mb-2 mt-2">{processInline(line.slice(2))}</h1>); continue; }
        if (line.startsWith('## ')) { renderedLines.push(<h2 key={i} className="text-xl font-bold mb-1 mt-2">{processInline(line.slice(3))}</h2>); continue; }
        if (line.trim().startsWith('- ')) { const indent = line.search(/\S/); renderedLines.push(<div key={i} className="flex gap-2 items-start" style={{ marginLeft: `${indent * 0.5}rem` }}><span className="mt-2 w-1.5 h-1.5 rounded-full bg-current flex-shrink-0" /><span>{processInline(line.trim().slice(2))}</span></div>); continue; }
        if (/^\d+\.\s/.test(line.trim())) { const indent = line.search(/\S/); const content = line.trim().replace(/^\d+\.\s/, ''); renderedLines.push(<div key={i} className="flex gap-2 items-start" style={{ marginLeft: `${indent * 0.5}rem` }}><span className="font-mono text-gray-400 select-none mr-1">{line.trim().split(' ')[0]}</span><span>{processInline(content)}</span></div>); continue; }
        if (line.trim() === '') { renderedLines.push(<div key={i} className="h-2"></div>); } else { renderedLines.push(<div key={i}>{processInline(line)}</div>); }
    }
    return <div className={`md-content w-full h-full text-sm leading-relaxed overflow-y-auto custom-scrollbar pr-2`} style={{ textAlign: style?.textAlign || 'left', fontFamily: getFontFamily(style?.fontFamily) }}>{renderedLines}</div>;
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
    switch(type) { case 'serif': return "'Playfair Display', serif"; case 'mono': return "'JetBrains Mono', monospace"; case 'hand': return "'Caveat', cursive"; default: return "'Inter', sans-serif"; }
};

// --- Helper Components ---

const Lightbox = ({ url, onClose }: { url: string, onClose: () => void }) => (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex items-center justify-center p-10 animate-in fade-in duration-200" onClick={onClose}>
        <button className="absolute top-5 right-5 text-white/50 hover:text-white transition-colors"><X size={32} /></button>
        <img src={url} alt="Lightbox" className="max-w-full max-h-full object-contain shadow-2xl rounded-lg" onClick={e => e.stopPropagation()} />
    </div>
);

const Toolbar = ({ activeTool, onSelectTool, onUndo, onRedo, onHome }: any) => (
  <div className="fixed left-4 top-1/2 -translate-y-1/2 bg-[#1a1a1a] border border-[#333] rounded-2xl p-2 flex flex-col gap-3 shadow-2xl z-50">
    <button onClick={onHome} className="p-2 text-[#00FF9D] hover:bg-[#00FF9D]/10 rounded-xl" title="Back to Home"><Home size={20} /></button>
    <div className="h-px bg-[#333] my-1" />
    {TOOLS.map((tool) => (
      <button key={tool.id} onClick={() => onSelectTool(tool.type || 'select')} className={`p-2 rounded-xl transition-all relative group ${ (activeTool === (tool.type || 'select')) ? 'bg-[#00FF9D] text-black shadow-[0_0_15px_rgba(0,255,157,0.4)]' : 'text-gray-400 hover:text-white hover:bg-[#2A2A2A]' }`} title={tool.label}>
        <tool.icon size={20} />
      </button>
    ))}
    <div className="h-px bg-[#333] my-1" />
    <button onClick={onUndo} className="p-2 text-gray-400 hover:text-white hover:bg-[#2A2A2A] rounded-xl"><Undo size={20} /></button>
    <button onClick={onRedo} className="p-2 text-gray-400 hover:text-white hover:bg-[#2A2A2A] rounded-xl"><Redo size={20} /></button>
  </div>
);

const PropertyPanel = ({ element, onChange, onDelete, onAI }: any) => {
  if (!element) return null;
  const handleResetImage = () => {
    if (element.type === 'image' && element.content.url) {
        const img = new Image();
        img.onload = () => { onChange({ width: Math.min(img.naturalWidth, 800), height: Math.min(img.naturalWidth, 800) / (img.naturalWidth / img.naturalHeight) }); };
        img.src = element.content.url;
    }
  };
  return (
    <div className="fixed right-4 top-20 w-72 bg-[#1a1a1a] border border-[#333] rounded-2xl p-5 shadow-2xl z-50 animate-in slide-in-from-right-10 duration-200" onPointerDown={(e) => e.stopPropagation()}>
      <div className="flex justify-between items-center mb-6 border-b border-[#333] pb-4">
        <h3 className="text-sm font-bold uppercase tracking-wider text-[#00FF9D]">{element.type} Style</h3>
        <button onClick={onDelete} className="text-gray-500 hover:text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-colors" title="Delete"><Trash2 size={16} /></button>
      </div>
      <div className="space-y-6">
        <div>
            <label className="text-xs font-semibold text-gray-500 mb-2 block uppercase tracking-wide">Background</label>
            <div className="flex gap-2 flex-wrap">
                {PALETTE.map(c => ( <button key={c} className={`w-8 h-8 rounded-full border-2 transition-transform hover:scale-110 ${element.style?.backgroundColor === c ? 'border-white' : 'border-transparent'} ${c === 'transparent' ? 'bg-black border-dashed border-gray-600' : ''}`} style={{ backgroundColor: c === 'transparent' ? 'transparent' : c }} onClick={() => onChange({ style: { ...element.style, backgroundColor: c } })} title={c} /> ))}
            </div>
        </div>
        
        {/* Border Controls - Enabled for Text, Note, Container */}
        {(element.type === 'text' || element.type === 'note' || element.type === 'container') && (
            <div>
                <label className="text-xs font-semibold text-gray-500 mb-2 block uppercase tracking-wide">Border</label>
                <div className="flex gap-2 mb-2 items-center">
                    <input
                        type="color"
                        value={element.style?.borderColor || '#333333'}
                        onChange={(e) => onChange({ style: { ...element.style, borderColor: e.target.value } })}
                        className="w-8 h-8 rounded cursor-pointer bg-transparent border-none p-0"
                    />
                    <select
                        value={element.style?.borderStyle || 'none'}
                        onChange={(e) => onChange({ style: { ...element.style, borderStyle: e.target.value } })}
                        className="flex-1 bg-[#222] text-gray-300 text-xs rounded px-2 h-8 outline-none border border-[#333]"
                    >
                        <option value="none">None</option>
                        <option value="solid">Solid</option>
                        <option value="dashed">Dashed</option>
                        <option value="dotted">Dotted</option>
                    </select>
                </div>
                {element.style?.borderStyle !== 'none' && (
                    <div className="flex items-center gap-2">
                         <span className="text-[10px] text-gray-500">Width</span>
                         <input
                            type="range" min="1" max="10" step="1"
                            value={element.style?.borderWidth || 1}
                            onChange={(e) => onChange({ style: { ...element.style, borderWidth: parseInt(e.target.value) } })}
                            className="flex-1 accent-[#00FF9D] h-1 bg-[#333] rounded-lg appearance-none"
                            onPointerDown={(e) => e.stopPropagation()}
                        />
                         <span className="text-[10px] text-gray-500">{element.style?.borderWidth || 1}px</span>
                    </div>
                )}
            </div>
        )}

        {(element.type === 'text' || element.type === 'note') && (
            <>
                <div>
                    <label className="text-xs font-semibold text-gray-500 mb-2 block uppercase tracking-wide">Typography</label>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                         {['sans', 'serif', 'mono', 'hand'].map(font => <button key={font} onClick={() => onChange({ style: { ...element.style, fontFamily: font } })} className={`px-2 py-1 text-xs rounded border capitalize ${element.style?.fontFamily === font ? 'border-[#00FF9D] text-[#00FF9D]' : 'border-[#333] text-gray-400'}`}>{font}</button>)}
                    </div>
                    {element.type !== 'note' && (
                        <div className="flex bg-[#222] rounded-lg p-1 border border border-[#333]">
                            {['left', 'center', 'right'].map((align) => ( <button key={align} onClick={() => onChange({ style: { ...element.style, textAlign: align } })} className={`flex-1 flex justify-center py-1 rounded ${element.style?.textAlign === align ? 'bg-[#333] text-white' : 'text-gray-500'}`}>{align === 'left' ? <AlignLeft size={14} /> : align === 'center' ? <AlignCenter size={14} /> : <AlignRight size={14} />}</button> ))}
                        </div>
                    )}
                </div>
            </>
        )}
        {element.type === 'image' && ( <div><button onClick={handleResetImage} className="w-full flex items-center justify-center gap-2 bg-[#222] hover:bg-[#333] text-gray-300 hover:text-white text-xs font-bold py-2 rounded-xl transition-all border border-[#333]"><RefreshCw size={14} /> Reset Original Size</button></div> )}
        {(['image', 'container', 'text', 'note'].includes(element.type)) && ( <div><label className="text-xs font-semibold text-gray-500 mb-2 block uppercase tracking-wide">Corner Radius: {element.style?.borderRadius || 0}px</label><input type="range" min="0" max="40" step="4" value={element.style?.borderRadius || 0} onChange={(e) => onChange({ style: { ...element.style, borderRadius: parseInt(e.target.value) } })} className="w-full accent-[#00FF9D] h-1 bg-[#333] rounded-lg appearance-none" onPointerDown={(e) => e.stopPropagation()} /></div> )}
        <div>
            <label className="text-xs font-semibold text-gray-500 mb-2 block uppercase tracking-wide">Layering</label>
            <div className="flex gap-2">
                 <button onClick={() => onChange({ style: { ...element.style, zIndex: (element.style?.zIndex || 1) + 1 } })} className="flex-1 bg-[#222] text-xs py-2 px-2 rounded-lg border border-[#333] hover:bg-[#2A2A2A] hover:text-white text-gray-400">Bring Forward</button>
                 <button onClick={() => onChange({ style: { ...element.style, zIndex: Math.max((element.style?.zIndex || 1) - 1, 0) } })} className="flex-1 bg-[#222] text-xs py-2 px-2 rounded-lg border border-[#333] hover:bg-[#2A2A2A] hover:text-white text-gray-400">Send Backward</button>
            </div>
        </div>
        {element.type === 'text' && ( <div className="pt-4 border-t border-[#333]"><button onClick={onAI} className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black text-xs font-bold py-3 rounded-xl transition-all shadow-lg"><Sparkles size={16} /> AI Enhance</button></div> )}
      </div>
    </div>
  );
};

const GridSelector = ({ onSelect, onClose }: { onSelect: (rows: number, cols: number) => void, onClose: () => void }) => {
    const [hover, setHover] = useState({ r: 0, c: 0 });
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-[#1a1a1a] border border-[#333] p-6 rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <h3 className="text-white text-sm font-bold mb-4 text-center">Create Table</h3>
                <div className="grid gap-1 mb-4" style={{ gridTemplateColumns: 'repeat(8, 24px)' }} onMouseLeave={() => setHover({ r: 0, c: 0 })} >
                    {Array.from({ length: 8 }).map((_, r) => ( Array.from({ length: 8 }).map((_, c) => ( <div key={`${r}-${c}`} className={`w-6 h-6 rounded-sm cursor-pointer transition-colors ${ r <= hover.r && c <= hover.c ? 'bg-[#00FF9D]' : 'bg-[#333]' }`} onMouseEnter={() => setHover({ r, c })} onClick={() => onSelect(r + 1, c + 1)} /> )) ))}
                </div>
                <div className="text-center text-sm font-mono text-[#00FF9D]">{hover.r + 1} rows x {hover.c + 1} cols</div>
            </div>
        </div>
    );
};

// --- Element Components (Text, Note, Todo, etc.) ---

const TextElement = ({ element, onChange, isSelected }: any) => {
  const [isEditing, setIsEditing] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (isEditing && textAreaRef.current) textAreaRef.current.focus(); }, [isEditing]);
  
  // Apply border style for Text
  const borderStyle = element.style?.borderStyle && element.style.borderStyle !== 'none' 
    ? `${element.style.borderWidth || 1}px ${element.style.borderStyle} ${element.style.borderColor || '#333'}` 
    : 'none';

  return (
    <div 
        className="w-full h-full p-4 overflow-hidden" 
        style={{ 
            color: COLORS.text, 
            backgroundColor: element.style?.backgroundColor || 'transparent', 
            borderRadius: element.style?.borderRadius || 0,
            border: borderStyle
        }} 
        onDoubleClick={() => setIsEditing(true)}
    >
        {isEditing ? ( <textarea ref={textAreaRef} className="w-full h-full bg-transparent resize-none outline-none custom-scrollbar" style={{ fontFamily: getFontFamily(element.style?.fontFamily), textAlign: element.style?.textAlign, fontSize: '0.875rem', lineHeight: '1.625' }} value={String(element.content || '')} onChange={(e) => onChange({ content: e.target.value })} onBlur={() => setIsEditing(false)} onPointerDown={(e) => e.stopPropagation()} /> ) : ( <div className="w-full h-full"><MarkdownRenderer text={String(element.content || '')} style={element.style} /></div> )}
    </div>
  );
};

const NoteElement = ({ element, onChange }: any) => {
  const [isEditing, setIsEditing] = useState(false);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (isEditing && textAreaRef.current) { textAreaRef.current.style.height = "auto"; textAreaRef.current.style.height = textAreaRef.current.scrollHeight + "px"; textAreaRef.current.focus(); } }, [isEditing]);
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => { const newHeight = Math.max(200, e.target.scrollHeight); onChange({ content: e.target.value, height: newHeight }); e.target.style.height = "auto"; e.target.style.height = e.target.scrollHeight + "px"; };
  
  const borderStyle = element.style?.borderStyle && element.style.borderStyle !== 'none' 
    ? `${element.style.borderWidth || 1}px ${element.style.borderStyle} ${element.style.borderColor || '#333'}` 
    : 'none';

  return (
    <div className="w-full h-full p-6 overflow-hidden flex flex-col items-center justify-center text-center relative transition-all" style={{ color: COLORS.text, backgroundColor: element.style?.backgroundColor || '#1E1E1E', borderRadius: element.style?.borderRadius || 0, border: borderStyle }} onDoubleClick={() => setIsEditing(true)}>
        <Quote className="absolute text-white/5 top-2 left-2" size={32} /> <Quote className="absolute text-white/5 bottom-2 right-2 rotate-180" size={32} />
        {isEditing ? ( <textarea ref={textAreaRef} className="w-full bg-transparent resize-none outline-none text-center text-lg z-10 overflow-hidden" style={{ fontFamily: getFontFamily(element.style?.fontFamily || 'serif') }} value={String(element.content || '')} onChange={handleInput} onBlur={() => setIsEditing(false)} onPointerDown={(e) => e.stopPropagation()} rows={1} /> ) : ( <div className="w-full relative z-10 pointer-events-none text-lg leading-relaxed whitespace-pre-wrap" style={{ fontFamily: getFontFamily(element.style?.fontFamily || 'serif') }}>{String(element.content || '') || <span className="opacity-50">Empty Note</span>}</div> )}
    </div>
  );
};

const TodoElement = ({ element, onChange }: any) => {
    const content = typeof element.content === 'object' && !Array.isArray(element.content) ? element.content : { title: 'To Do', items: Array.isArray(element.content) ? element.content : [] };
    const items = content.items;
    const [focusId, setFocusId] = useState<string | null>(null);

    // Auto-focus effect for new items
    useEffect(() => {
        if (focusId) {
            const el = document.getElementById(`todo-input-${focusId}`);
            if (el) {
                (el as HTMLInputElement).focus();
                setFocusId(null);
            }
        }
    }, [focusId, items]);

    const updateContent = (newContent: any) => onChange({ content: newContent });
    const updateItem = (id: string, patch: Partial<TodoItem>) => { const newItems = items.map((i: TodoItem) => i.id === id ? {...i, ...patch} : i); updateContent({ ...content, items: newItems }); };
    const deleteItem = (id: string) => { updateContent({ ...content, items: items.filter((i: TodoItem) => i.id !== id) }); };
    const addItem = () => { 
        const newId = generateId();
        updateContent({ ...content, items: [...items, { id: newId, text: '', done: false, level: 0 }] });
        setFocusId(newId);
    };
    const handleSortStart = (e: React.DragEvent, index: number) => { e.dataTransfer.setData('text/plain', index.toString()); e.dataTransfer.effectAllowed = 'move'; e.stopPropagation(); };
    const handleSortDrop = (e: React.DragEvent, dropIndex: number) => { e.preventDefault(); e.stopPropagation(); const dragIndex = parseInt(e.dataTransfer.getData('text/plain')); if (isNaN(dragIndex) || dragIndex === dropIndex) return; const newItems = [...items]; const [moved] = newItems.splice(dragIndex, 1); newItems.splice(dropIndex, 0, moved); updateContent({ ...content, items: newItems }); };
    
    // Improved Keyboard handling
    const handleKeyDown = (e: React.KeyboardEvent, index: number, id: string) => { 
        if (e.key === 'Enter') { 
            e.preventDefault(); 
            const newId = generateId();
            const newItems = [...items]; 
            // Insert new item after current
            newItems.splice(index + 1, 0, { id: newId, text: '', done: false, level: items[index].level }); 
            updateContent({ ...content, items: newItems }); 
            setFocusId(newId); // Auto-focus new item
        } else if (e.key === 'Backspace' && items[index].text === '') { 
            e.preventDefault(); 
            deleteItem(id); 
            // Focus previous if exists
            if (index > 0) setFocusId(items[index - 1].id);
        } else if (e.key === 'Tab') { 
            e.preventDefault(); 
            const newLevel = Math.max(0, Math.min((items[index].level || 0) + (e.shiftKey ? -1 : 1), 3)); 
            updateItem(id, { level: newLevel }); 
        } 
    };

    return (
        <div className="w-full h-full p-4 flex flex-col" style={{ backgroundColor: element.style?.backgroundColor || '#1E1E1E', borderRadius: element.style?.borderRadius || 0 }}>
            <input className="text-[#00FF9D] bg-transparent text-sm font-bold uppercase mb-4 tracking-wider w-full outline-none placeholder-[#00FF9D]/50" value={content.title} onChange={(e) => updateContent({...content, title: e.target.value})} placeholder="TODO LIST" onPointerDown={(e) => e.stopPropagation()} />
            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar">
                {items.map((item: TodoItem, index: number) => (
                    <div key={item.id} draggable onDragStart={(e) => handleSortStart(e, index)} onDragOver={(e) => e.preventDefault()} onDrop={(e) => handleSortDrop(e, index)} onPointerDown={(e) => e.stopPropagation()} className="flex items-start gap-2 mb-2 p-1 rounded group animate-in fade-in slide-in-from-left-2 duration-300 hover:bg-white/5" style={{ marginLeft: `${(item.level || 0) * 1.5}rem` }}>
                        <div className="mt-1 cursor-grab opacity-0 group-hover:opacity-50 hover:opacity-100 text-gray-500"><GripVertical size={12} /></div>
                        <div onClick={(e) => { e.stopPropagation(); updateItem(item.id, { done: !item.done }); }} className={`w-4 h-4 mt-1 rounded border cursor-pointer flex items-center justify-center transition-all flex-shrink-0 ${item.done ? 'bg-[#00FF9D] border-[#00FF9D]' : 'border-gray-600 hover:border-gray-400'}`}>{item.done && <span className="text-black text-[10px] font-bold">✓</span>}</div>
                        <div className="flex-1 min-w-0">
                            <input id={`todo-input-${item.id}`} className={`w-full bg-transparent outline-none text-sm font-sans ${item.done ? 'line-through text-gray-500' : 'text-gray-200'}`} value={item.text} onChange={(e) => updateItem(item.id, { text: e.target.value })} onKeyDown={(e) => handleKeyDown(e, index, item.id)} placeholder="Task..." />
                            <div className="flex items-center gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"><div className="flex items-center gap-1 text-[10px] text-gray-500 hover:text-[#00FF9D] cursor-pointer relative"><Calendar size={10} /><input type="date" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => updateItem(item.id, { dueDate: e.target.value })} /><span>{item.dueDate ? new Date(item.dueDate).toLocaleDateString(undefined, {month:'short', day:'numeric'}) : 'Date'}</span></div></div>
                        </div>
                         <button className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-500 transition-opacity" onClick={(e) => { e.stopPropagation(); deleteItem(item.id); }}><X size={12} /></button>
                    </div>
                ))}
            </div>
            <button onClick={(e) => { e.stopPropagation(); addItem(); }} className="mt-2 flex items-center justify-center gap-2 w-full py-2 rounded border border-dashed border-[#333] text-gray-500 text-xs hover:text-[#00FF9D] hover:border-[#00FF9D] transition-colors"><Plus size={12} /> Add Item</button>
        </div>
    )
}

const LinkElement = ({ element, onChange }: any) => {
    const content = typeof element.content === 'object' ? element.content : { url: String(element.content || ''), title: '' };
    const isUrl = content.url && (content.url.startsWith('http') || content.url.startsWith('www'));
    const updateLink = (patch: any) => onChange({ content: { ...content, ...patch } });
    useEffect(() => { if (isUrl && !content.title) { try { const hostname = new URL(content.url).hostname.replace('www.', ''); updateLink({ title: hostname }); } catch (e) {} } }, [isUrl, content.url]);
    if (!isUrl) return ( <div className="w-full h-full flex flex-col items-center justify-center p-4"><Globe className="text-gray-500 mb-2" /><input className="w-full bg-[#333] text-white px-2 py-1 rounded text-sm outline-none border border-transparent focus:border-[#00FF9D]" placeholder="Paste URL..." value={content.url} onChange={(e) => updateLink({ url: e.target.value })} onPointerDown={(e) => e.stopPropagation()} onPaste={(e) => e.stopPropagation()} /></div> );
    return (
        <div className="w-full h-full flex flex-col relative group cursor-pointer overflow-hidden bg-[#1a1a1a]" onDoubleClick={(e) => { e.stopPropagation(); window.open(content.url, '_blank'); }} title="Double click to open link">
            <div className="h-2/3 bg-gradient-to-br from-[#2A2A2A] to-[#111] flex items-center justify-center relative"><Globe size={48} className="text-[#00FF9D] opacity-20 group-hover:scale-110 transition-transform duration-500" /></div>
            <div className="flex-1 bg-[#1a1a1a] p-3 flex flex-col justify-center border-t border-[#333]"><div className="flex items-center gap-2 mb-1"><input className="flex-1 bg-transparent text-white font-bold text-sm outline-none placeholder-gray-600 truncate hover:text-[#00FF9D]" value={content.title || ''} onChange={(e) => updateLink({ title: e.target.value })} onClick={e => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()} placeholder="Link Title" /><ExternalLink size={14} className="text-[#00FF9D]" /></div><div className="text-[10px] text-gray-500 font-mono truncate">{content.url}</div></div>
        </div>
    )
}

const ImageElement = ({ element, onChange, onOpenLightbox }: any) => {
    const content = typeof element.content === 'object' ? element.content : { url: String(element.content || ''), caption: '' };
    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = (event) => { const img = new Image(); img.onload = () => { onChange({ content: { url: event.target?.result as string, caption: file.name } }); }; img.src = event.target?.result as string; }; reader.readAsDataURL(file); } };
    return (
        <div className="w-full h-full flex flex-col overflow-hidden" style={{ borderRadius: element.style?.borderRadius || 0 }} onDoubleClick={(e) => { e.stopPropagation(); if (content.url) onOpenLightbox(content.url); }}>
            <div className="flex-1 relative overflow-hidden bg-black/20 group flex items-center justify-center">{content.url ? ( <><img src={content.url} alt="Upload" className="w-full h-full object-cover pointer-events-none" /><div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 p-1 rounded text-white cursor-pointer"><Maximize2 size={14} /></div></> ) : ( <label className="flex flex-col items-center justify-center h-full text-gray-500 cursor-pointer hover:text-[#00FF9D] transition-colors p-4 text-center"><input type="file" accept="image/*" className="hidden" onChange={handleUpload} onPointerDown={e => e.stopPropagation()} /><Upload size={32} /><span className="text-xs mt-2 font-bold">Click to Upload Image</span><span className="text-[10px] opacity-50 mt-1">or drag & drop</span></label> )}</div>
            {content.url && ( <div className="h-8 bg-[#1a1a1a] flex items-center px-2 border-t border-[#333]"><input className="w-full bg-transparent text-xs text-gray-400 outline-none text-center placeholder-gray-700" value={content.caption || ''} onChange={(e) => onChange({ content: { ...content, caption: e.target.value } })} onPointerDown={(e) => e.stopPropagation()} placeholder="Add caption..." /></div> )}
        </div>
    )
}

const FileElement = ({ element, onChange }: any) => {
    const hasFile = element.content?.url;
    const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (file) { const reader = new FileReader(); reader.onload = (ev) => { onChange({ content: { name: file.name, size: formatBytes(file.size), url: ev.target?.result as string } }); }; reader.readAsDataURL(file); } };
    if (!hasFile) return ( <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-[#1a1a1a] border border-[#333] border-dashed"><label className="flex flex-col items-center justify-center cursor-pointer text-gray-500 hover:text-[#00FF9D] transition-colors"><input type="file" className="hidden" onChange={handleUpload} onPointerDown={e => e.stopPropagation()} /><Upload size={24} /><span className="text-xs mt-2 font-bold">Upload File</span></label></div> );
    return ( <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-[#1a1a1a] border border-[#333] transition-colors hover:border-gray-500" title={element.content?.name}><div className="p-3 bg-[#222] rounded-full mb-3 shadow-inner"><FileIcon size={24} className="text-[#00FF9D]" /></div><div className="text-sm font-bold w-full text-center px-2 overflow-hidden text-ellipsis whitespace-nowrap text-gray-200 z-10">{element.content?.name || 'Unknown File'}</div><div className="text-xs text-gray-500 mt-1 uppercase tracking-wide">{element.content?.size || '0 KB'}</div><a href={element.content?.url} download className="mt-4 bg-[#333] hover:bg-[#00FF9D] hover:text-black px-4 py-1.5 rounded-full text-xs font-bold flex items-center gap-2 transition-all"><Download size={12} /> Download</a></div> )
}

const TableElement = ({ element, onChange, isSelected }: any) => {
    const [isEditing, setIsEditing] = useState(false);
    const rows = element.content.rows || 3;
    const cols = element.content.cols || 3;
    const data = element.content.data || {};
    useEffect(() => { if (!isSelected) setIsEditing(false); }, [isSelected]);
    const updateCell = (r: number, c: number, val: string) => { const newData = { ...data, [`${r}-${c}`]: val }; onChange({ content: { ...element.content, data: newData } }); };
    return (
        <div className="w-full h-full bg-[#1a1a1a] flex flex-col relative group overflow-hidden border border-[#333] rounded-lg">
            <div className="grid gap-[1px] bg-[#333] w-full h-full" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}>
                {Array.from({ length: rows }).map((_, r) => ( Array.from({ length: cols }).map((_, c) => { const isHeader = r === 0; const bgClass = isHeader ? 'bg-[#333]' : 'bg-[#1a1a1a]'; return ( <div key={`${r}-${c}`} className={`relative ${bgClass}`}><input className={`w-full h-full bg-transparent text-xs px-2 outline-none text-gray-300 focus:bg-[#00FF9D]/10 text-center ${isHeader ? 'font-bold text-[#00FF9D]' : ''}`} value={data[`${r}-${c}`] || ''} onChange={(e) => updateCell(r, c, e.target.value)} onPointerDown={(e) => isEditing && e.stopPropagation()} readOnly={!isEditing} placeholder={isHeader ? `Col ${c+1}` : ''} /></div> ) }) ))}
            </div>
            {!isEditing && ( <div className="absolute inset-0 z-20 bg-transparent" onDoubleClick={(e) => { e.stopPropagation(); setIsEditing(true); }} title="Double click to edit cells" /> )}
        </div>
    )
}

const ContainerElement = ({ element, children, onChange, cardCount }: any) => {
    const borderStyle = element.style?.borderStyle && element.style.borderStyle !== 'none' 
    ? `${element.style.borderWidth || 1}px ${element.style.borderStyle} ${element.style.borderColor || '#333'}` 
    : '1px solid #333';

    return (
        <div className="w-full h-full flex flex-col shadow-2xl transition-all relative overflow-hidden group transition-colors duration-200" style={{ borderRadius: element.style?.borderRadius || 12, backgroundColor: element.style?.backgroundColor || '#1A1A1A', border: borderStyle }}>
            <div className="h-14 flex flex-col justify-center px-4 border-b border-[#333] bg-black/20 flex-shrink-0"><input className="bg-transparent text-xl font-bold font-serif text-white outline-none placeholder-gray-600 truncate w-full text-center" value={String(element.content || '')} onChange={(e) => onChange({ content: e.target.value })} onPointerDown={(e) => e.stopPropagation()} placeholder="New Column" /><div className="text-[10px] text-gray-500 uppercase tracking-widest text-center mt-0.5">{cardCount} cards</div></div>
            <div className="flex-1 relative rounded-b-[inherit] min-h-[50px]" />
        </div>
    )
}

const ConnectionLayer = ({ connections, elements }: any) => {
    const getCenter = (id: string) => { const el = elements.find((e: any) => e.id === id); if (!el) return { x: 0, y: 0 }; return { x: el.x + el.width / 2, y: el.y + el.height / 2 }; };
    return ( <svg className="absolute inset-0 pointer-events-none w-full h-full overflow-visible">{connections.map((conn: any) => { const start = getCenter(conn.fromId); const end = getCenter(conn.toId); return ( <g key={conn.id}><path d={`M ${start.x} ${start.y} C ${(start.x + end.x)/2} ${start.y}, ${(start.x + end.x)/2} ${end.y}, ${end.x} ${end.y}`} stroke="#555" strokeWidth="2" fill="none" strokeDasharray="5,5" /><circle cx={end.x} cy={end.y} r="3" fill="#555" /></g> ); })}</svg> )
}

// --- Auth Component ---

const AuthScreen = ({ onAuthSuccess }: { onAuthSuccess: () => void }) => {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const { error } = isLogin 
                ? await supabase.auth.signInWithPassword({ email, password })
                : await supabase.auth.signUp({ email, password });
            
            if (error) throw error;
            if (isLogin) {
                onAuthSuccess();
            } else {
                setError("Account created! Please sign in.");
                setIsLogin(true);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#121212] flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#1E1E1E] border border-[#333] p-8 rounded-3xl shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-[#00FF9D] to-[#00B8FF]" />
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-[#2A2A2A] rounded-2xl mb-4 text-[#00FF9D]">
                        <Sparkles size={32} />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2 font-serif">Stella's Note</h1>
                    <p className="text-gray-500">Your infinite creative space.</p>
                </div>

                <form onSubmit={handleAuth} className="space-y-4">
                    <div>
                        <div className="relative">
                            <Mail className="absolute left-3 top-3 text-gray-500" size={18} />
                            <input 
                                type="email" placeholder="Email" required 
                                className="w-full bg-[#121212] border border-[#333] rounded-xl pl-10 pr-4 py-3 text-white focus:border-[#00FF9D] outline-none"
                                value={email} onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>
                    <div>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 text-gray-500" size={18} />
                            <input 
                                type="password" placeholder="Password" required minLength={6}
                                className="w-full bg-[#121212] border border-[#333] rounded-xl pl-10 pr-4 py-3 text-white focus:border-[#00FF9D] outline-none"
                                value={password} onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    {error && <div className="text-red-500 text-sm text-center bg-red-500/10 p-2 rounded">{error}</div>}

                    <button disabled={loading} className="w-full bg-[#00FF9D] hover:bg-[#00FF9D]/90 text-black font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2">
                        {loading ? <Loader2 className="animate-spin" size={20} /> : (isLogin ? 'Sign In' : 'Create Account')}
                    </button>
                </form>

                <div className="mt-6 text-center">
                    <button onClick={() => setIsLogin(!isLogin)} className="text-gray-500 hover:text-white text-sm">
                        {isLogin ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
                    </button>
                </div>
            </div>
        </div>
    )
}

// --- Canvas Workspace ---

const CanvasWorkspace = ({ board, onSave, onBack }: { board: Board, onSave: (b: Board) => void, onBack: () => void }) => {
  const [activeTool, setActiveTool] = useState('select');
  const [currentBoard, setCurrentBoard] = useState<Board>(board);
  const [dragInfo, setDragInfo] = useState<DragInfo>({ isDragging: false, startPos: { x: 0, y: 0 } });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ containerId: string, y: number, width: number } | null>(null);
  const [showTableGrid, setShowTableGrid] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedElement = currentBoard.elements.find(el => el.id === selectedId);

  useEffect(() => { setCurrentBoard(board); }, [board.id]);

  const updateBoard = useCallback((newBoard: Board) => {
    setCurrentBoard(newBoard);
    // Debounce save or direct save
    onSave(newBoard);
  }, [onSave]);

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

  const layoutContainer = useCallback((containerId: string, elements: CanvasElement[]): CanvasElement[] => {
      const container = elements.find(e => e.id === containerId);
      if (!container || container.type !== 'container') return elements;
      const padding = 16, headerHeight = 56, gap = 16;
      const children = elements.filter(e => e.parentId === containerId).sort((a, b) => a.y - b.y);
      
      // If no children, just make sure container is big enough for header
      if (children.length === 0) return elements.map(e => e.id === containerId ? { ...e, height: Math.max(e.height, 150) } : e);
      
      let currentY = container.y + headerHeight + padding;
      const updatedChildren = new Map<string, CanvasElement>();
      
      children.forEach(child => {
          const newWidth = container.width - (padding * 2);
          let newHeight = child.height;
          // Only force aspect ratio for images if width changes significantly, but let users resize other things freely vertical
          if (child.type === 'image') { const ratio = child.width / child.height; newHeight = newWidth / ratio; }
          
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
      // Expand container if needed, but allow it to be larger than content (min height)
      return elements.map(e => { 
          if (e.id === containerId) return { ...e, height: Math.max(newContainerHeight, e.height) }; 
          if (updatedChildren.has(e.id)) return updatedChildren.get(e.id)!; 
          return e; 
      });
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    const pos = { x: e.clientX, y: e.clientY };
    const worldPos = screenToWorld({ x: e.clientX - canvasRef.current!.getBoundingClientRect().left, y: e.clientY - canvasRef.current!.getBoundingClientRect().top }, currentBoard.viewport);
    if (selectedElement) {
        const hs = 10 / currentBoard.viewport.zoom;
        const el = selectedElement;
        const corners = { nw: { x: el.x, y: el.y }, ne: { x: el.x + el.width, y: el.y }, sw: { x: el.x, y: el.y + el.height }, se: { x: el.x + el.width, y: el.y + el.height } };
        for (const [key, corner] of Object.entries(corners)) { if (Math.abs(worldPos.x - corner.x) < hs && Math.abs(worldPos.y - corner.y) < hs) { setDragInfo({ isDragging: true, startPos: pos, startElPos: { x: el.x, y: el.y, w: el.width, h: el.height }, type: 'resize', handle: key as any }); return; } }
    }
    let hitId = null;
    for (let i = currentBoard.elements.length - 1; i >= 0; i--) { const el = currentBoard.elements[i]; if (worldPos.x >= el.x && worldPos.x <= el.x + el.width && worldPos.y >= el.y && worldPos.y <= el.y + el.height) { hitId = el.id; break; } }
    if (activeTool === 'select') {
        if (hitId) {
            setSelectedId(hitId);
            const el = currentBoard.elements.find(e => e.id === hitId)!;
            const childrenStartPos: Record<string, Point> = {};
            if (el.type === 'container') currentBoard.elements.filter(c => c.parentId === el.id).forEach(c => childrenStartPos[c.id] = { x: c.x, y: c.y });
            setDragInfo({ isDragging: true, startPos: pos, startElPos: { x: el.x, y: el.y, w: el.width, h: el.height }, childrenStartPos, type: 'move' });
        } else { setSelectedId(null); setDragInfo({ isDragging: true, startPos: pos, type: 'move' }); }
    } else {
        if (['image', 'file', 'table'].includes(activeTool)) return;
        const newEl: CanvasElement = { id: generateId(), type: activeTool as ElementType, x: worldPos.x, y: worldPos.y, width: activeTool === 'container' ? 300 : 200, height: 150, content: activeTool === 'todo' ? { title: 'To Do', items: [{ id: '1', text: 'Task 1', done: false, level: 0 }] } : '', style: { backgroundColor: (activeTool === 'note' || activeTool === 'todo') ? '#1E1E1E' : 'transparent', zIndex: activeTool === 'container' ? 0 : 10 } };
        if (activeTool === 'note') { newEl.width = 200; newEl.height = 200; newEl.style!.borderRadius = 0; }
        if (activeTool === 'text') { newEl.height = 100; newEl.width = 300; }
        if (activeTool === 'link') { newEl.height = 200; newEl.width = 200; }
        updateBoard({ ...currentBoard, elements: [...currentBoard.elements, newEl] });
        setSelectedId(newEl.id);
        setActiveTool('select');
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragInfo.isDragging) return;
    const dx = e.clientX - dragInfo.startPos.x, dy = e.clientY - dragInfo.startPos.y;
    const worldPos = screenToWorld({ x: e.clientX - canvasRef.current!.getBoundingClientRect().left, y: e.clientY - canvasRef.current!.getBoundingClientRect().top }, currentBoard.viewport);
    if (dragInfo.type === 'move' && selectedId) {
        const deltaX = dx / currentBoard.viewport.zoom, deltaY = dy / currentBoard.viewport.zoom;
        const newElements = currentBoard.elements.map(el => { if (el.id === selectedId) return { ...el, x: (dragInfo.startElPos?.x || 0) + deltaX, y: (dragInfo.startElPos?.y || 0) + deltaY }; if (dragInfo.childrenStartPos && dragInfo.childrenStartPos[el.id]) return { ...el, x: dragInfo.childrenStartPos[el.id].x + deltaX, y: dragInfo.childrenStartPos[el.id].y + deltaY }; return el; });
        const draggedEl = newElements.find(e => e.id === selectedId);
        if (draggedEl && draggedEl.type !== 'container') {
             const targetContainer = currentBoard.elements.find(e => e.type === 'container' && e.id !== selectedId && worldPos.x >= e.x && worldPos.x <= e.x + e.width && worldPos.y >= e.y && worldPos.y <= e.y + e.height);
             if (targetContainer) {
                 const padding = 16; draggedEl.x = targetContainer.x + padding; draggedEl.width = targetContainer.width - (padding * 2);
                 const children = currentBoard.elements.filter(e => e.parentId === targetContainer.id && e.id !== selectedId).sort((a, b) => a.y - b.y);
                 let insertY = targetContainer.y + 56 + padding, inserted = false;
                 if (children.length > 0) { for (const child of children) { if (worldPos.y < child.y + child.height/2) { insertY = child.y - 8; inserted = true; break; } } if (!inserted) { const last = children[children.length - 1]; insertY = last.y + last.height + 8; } } else { insertY = targetContainer.y + 56 + padding; }
                 setDropTarget({ containerId: targetContainer.id, y: insertY, width: targetContainer.width - (padding * 2) });
             } else setDropTarget(null);
        }
        setCurrentBoard({ ...currentBoard, elements: newElements });
    } else if (dragInfo.type === 'resize' && selectedId && dragInfo.startElPos) {
        let newX = dragInfo.startElPos.x, newY = dragInfo.startElPos.y, newW = dragInfo.startElPos.w, newH = dragInfo.startElPos.h;
        const deltaX = dx / currentBoard.viewport.zoom, deltaY = dy / currentBoard.viewport.zoom;
        const isShift = e.shiftKey, aspectRatio = dragInfo.startElPos.w / dragInfo.startElPos.h;
        if (dragInfo.handle?.includes('e')) newW += deltaX; if (dragInfo.handle?.includes('w')) { newX += deltaX; newW -= deltaX; } if (dragInfo.handle?.includes('s')) newH += deltaY; if (dragInfo.handle?.includes('n')) { newY += deltaY; newH -= deltaY; }
        if (isShift) { if (dragInfo.handle?.includes('e') || dragInfo.handle?.includes('w')) { const intendedH = newW / aspectRatio; if (dragInfo.handle.includes('n')) newY = newY + (newH - intendedH); newH = intendedH; } else { const intendedW = newH * aspectRatio; if (dragInfo.handle.includes('w')) newX = newX + (newW - intendedW); newW = intendedW; } }
        if (newW < 50) newW = 50; if (newH < 50) newH = 50;
        setCurrentBoard({ ...currentBoard, elements: currentBoard.elements.map(e => e.id === selectedId ? { ...e, x: newX, y: newY, width: newW, height: newH } : e) });
    } else if (!selectedId) { setCurrentBoard({ ...currentBoard, viewport: { ...currentBoard.viewport, x: currentBoard.viewport.x + dx, y: currentBoard.viewport.y + dy } }); setDragInfo({ ...dragInfo, startPos: { x: e.clientX, y: e.clientY } }); }
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
                     // More generous hit detection for "drag out"
                     if (p && c.x + c.width/2 > p.x && c.x + c.width/2 < p.x + p.width) stillInside = true; 
                 } 
                 if (!stillInside) draggedEl.parentId = undefined; 
                 else if (oldParentId) updatedElements = layoutContainer(oldParentId, updatedElements); 
             }
             if (oldParentId && oldParentId !== (dropTarget?.containerId) && draggedEl.parentId !== oldParentId) updatedElements = layoutContainer(oldParentId, updatedElements);
        }
        if (dragInfo.type === 'resize' && draggedEl) { if (draggedEl.type === 'container') updatedElements = layoutContainer(draggedEl.id, updatedElements); else if (draggedEl.parentId) updatedElements = layoutContainer(draggedEl.parentId, updatedElements); }
        updateBoard({ ...currentBoard, elements: updatedElements });
    }
    setDragInfo({ ...dragInfo, isDragging: false }); setDropTarget(null);
  };

  const handleToolSelect = (toolId: string) => { if (toolId === 'image') imageInputRef.current?.click(); else if (toolId === 'file') fileInputRef.current?.click(); else if (toolId === 'table') setShowTableGrid(true); else setActiveTool(toolId); };
  const renderElement = (el: CanvasElement) => { 
      const isSelected = selectedId === el.id; 
      let Component; switch(el.type) { case 'text': Component = TextElement; break; case 'note': Component = NoteElement; break; case 'todo': Component = TodoElement; break; case 'image': Component = ImageElement; break; case 'file': Component = FileElement; break; case 'link': Component = LinkElement; break; case 'table': Component = TableElement; break; case 'container': Component = ContainerElement; break; default: Component = () => null; }
      let extraProps = {}; if (el.type === 'container') extraProps = { cardCount: currentBoard.elements.filter(c => c.parentId === el.id).length };
      let finalZ = el.style?.zIndex || 0; if (el.type === 'container') finalZ = isSelected ? 10 : 0; else { finalZ = Math.max(finalZ, 0) + 20; if (isSelected) finalZ += 1000; }
      const handleElementChange = (patch: any) => { let newElements = currentBoard.elements.map(e => e.id === el.id ? { ...e, ...patch, style: { ...e.style, ...patch?.style } } : e); const updatedEl = newElements.find(e => e.id === el.id); if (updatedEl && updatedEl.parentId) newElements = layoutContainer(updatedEl.parentId, newElements); updateBoard({ ...currentBoard, elements: newElements }); };
      return ( <div key={el.id} className={`absolute transition-shadow ${isSelected ? 'ring-1 ring-[#00FF9D]' : ''} ${el.type === 'note' ? 'shadow-lg' : ''}`} style={{ left: el.x, top: el.y, width: el.width, height: el.height, zIndex: finalZ, borderRadius: el.style?.borderRadius || 0 }}> <Component element={el} isSelected={isSelected} onChange={handleElementChange} onOpenLightbox={(url: string) => setLightboxUrl(url)} {...extraProps} /> {isSelected && ( <> {['nw', 'ne', 'sw', 'se'].map((h) => ( <div key={h} className="absolute w-3 h-3 bg-white border border-[#00FF9D] rounded-full z-[101]" style={{ top: h.startsWith('n') ? -4 : 'auto', bottom: h.startsWith('s') ? -4 : 'auto', left: h.endsWith('w') ? -4 : 'auto', right: h.endsWith('e') ? -4 : 'auto', cursor: `${h}-resize` }} /> ))} <div className="absolute -top-8 right-0 bg-red-500/80 p-1 rounded text-white cursor-pointer hover:bg-red-500" onClick={(e) => { e.stopPropagation(); updateBoard({...currentBoard, elements: currentBoard.elements.filter(e => e.id !== el.id)})}}> <Trash2 size={12} /> </div> </> )} </div> );
  };

  return (
    <div className="w-screen h-screen bg-[#121212] overflow-hidden relative select-none" onPaste={async (e) => { /* paste logic same as before */ }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { /* drop logic */ }} tabIndex={0} style={{ backgroundImage: 'radial-gradient(#333 1px, transparent 1px)', backgroundSize: `${20 * currentBoard.viewport.zoom}px ${20 * currentBoard.viewport.zoom}px`, backgroundPosition: `${currentBoard.viewport.x}px ${currentBoard.viewport.y}px` }}>
      <div ref={canvasRef} className="w-full h-full relative origin-top-left" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onWheel={(e) => { if (e.ctrlKey || e.metaKey) { const d = -e.deltaY * 0.001; setCurrentBoard({ ...currentBoard, viewport: { ...currentBoard.viewport, zoom: Math.min(Math.max(currentBoard.viewport.zoom + d, 0.1), 5) } }); } else { setCurrentBoard({ ...currentBoard, viewport: { ...currentBoard.viewport, x: currentBoard.viewport.x - e.deltaX, y: currentBoard.viewport.y - e.deltaY } }); } }}>
         <div className="absolute origin-top-left w-[10000px] h-[10000px]" style={{ transform: `translate(${currentBoard.viewport.x}px, ${currentBoard.viewport.y}px) scale(${currentBoard.viewport.zoom})` }}>
             <ConnectionLayer connections={currentBoard.connections} elements={currentBoard.elements} />
             {currentBoard.elements.map(renderElement)}
             {dropTarget && ( <div className="absolute h-1 bg-[#00FF9D] rounded-full shadow-[0_0_10px_#00FF9D] transition-all pointer-events-none z-[50]" style={{ left: currentBoard.elements.find(e => e.id === dropTarget.containerId)!.x + 16, top: dropTarget.y, width: dropTarget.width }} /> )}
         </div>
      </div>
      <Toolbar activeTool={activeTool} onSelectTool={handleToolSelect} onUndo={() => {}} onRedo={() => {}} onHome={onBack} />
      <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleDirectUpload(e, 'image')} />
      <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => handleDirectUpload(e, 'file')} />
      <PropertyPanel element={selectedElement} onChange={(patch: any) => updateBoard({ ...currentBoard, elements: currentBoard.elements.map(e => e.id === selectedId ? { ...e, ...patch, style: { ...e.style, ...patch.style } } : e) })} onDelete={() => { updateBoard({ ...currentBoard, elements: currentBoard.elements.filter(e => e.id !== selectedId) }); setSelectedId(null); }} onAI={async () => { if (selectedElement && selectedElement.type === 'text') { const newText = await generateTextEnhancement("Improve clarity and fix grammar", selectedElement.content); updateBoard({ ...currentBoard, elements: currentBoard.elements.map(e => e.id === selectedId ? { ...e, content: newText } : e) }); } }} />
      {showTableGrid && <GridSelector onClose={() => setShowTableGrid(false)} onSelect={(rows, cols) => { const centerPos = { x: (window.innerWidth / 2 - currentBoard.viewport.x) / currentBoard.viewport.zoom - (cols * 50), y: (window.innerHeight / 2 - currentBoard.viewport.y) / currentBoard.viewport.zoom - (rows * 20) }; const newEl: CanvasElement = { id: generateId(), type: 'table', x: centerPos.x, y: centerPos.y, width: cols * 100, height: rows * 40, content: { rows, cols, data: {} }, style: { backgroundColor: '#1a1a1a', zIndex: currentBoard.elements.length + 1 } }; updateBoard({ ...currentBoard, elements: [...currentBoard.elements, newEl] }); setShowTableGrid(false); setSelectedId(newEl.id); setActiveTool('select'); }} />}
      {lightboxUrl && <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
      <div className="fixed bottom-4 right-4 bg-black/50 px-3 py-1 rounded-full text-xs text-gray-500 font-mono pointer-events-none">{Math.round(currentBoard.viewport.zoom * 100)}%</div>
    </div>
  );
}

// --- Home Dashboard ---

const HomeDashboard = ({ boards, onOpenBoard, onCreateBoard, onDeleteBoard, onRestoreBoard, onPermanentDelete, onRenameBoard, onLogout, loading }: any) => {
    const [isCreating, setIsCreating] = useState(false);
    const [view, setView] = useState<'all' | 'trash'>('all');
    const [newBoardName, setNewBoardName] = useState('');
    const [newBoardIcon, setNewBoardIcon] = useState('📁');
    const [showIconPicker, setShowIconPicker] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    
    const EMOJIS = ['📁', '🚀', '💡', '🎨', '📝', '🧠', '💼', '🏠', '🎯', '✨', '🔥', '🌈', '💻', '📚', '🛠️', '🎮'];

    const handleCreate = () => {
        if (!newBoardName.trim()) return;
        onCreateBoard(newBoardName, newBoardIcon);
        setIsCreating(false);
        setNewBoardName('');
        setNewBoardIcon('📁');
    };

    const handleStartEdit = (e: React.MouseEvent, board: Board) => {
        e.stopPropagation();
        setEditingId(board.id);
        setEditName(board.name);
    }

    const handleSaveRename = (id: string) => {
        if (editName.trim()) {
            onRenameBoard(id, editName);
        }
        setEditingId(null);
    }

    const filteredBoards = boards.filter((b: Board) => view === 'trash' ? b.trashed : !b.trashed);

    return (
        <div className="min-h-screen bg-[#121212] text-white p-10 font-sans">
            <header className="mb-12 flex items-center justify-between">
                 <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-[#00FF9D] rounded-lg flex items-center justify-center text-black">
                        <Sparkles size={20} />
                    </div>
                    <h1 className="text-3xl font-bold font-serif tracking-tight">Stella's Note</h1>
                    
                    <div className="ml-8 flex gap-2 bg-[#1E1E1E] p-1 rounded-xl">
                        <button onClick={() => setView('all')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${view === 'all' ? 'bg-[#333] text-white' : 'text-gray-400 hover:text-white'}`}>
                            My Boards
                        </button>
                        <button onClick={() => setView('trash')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${view === 'trash' ? 'bg-[#333] text-red-400' : 'text-gray-400 hover:text-white'}`}>
                            <Trash2 size={14} /> Trash
                        </button>
                    </div>
                 </div>
                 <button onClick={onLogout} className="flex items-center gap-2 text-gray-400 hover:text-white bg-[#1E1E1E] px-4 py-2 rounded-xl transition-colors">
                     <LogOut size={16} /> Sign Out
                 </button>
            </header>

            {loading ? (
                <div className="flex items-center justify-center h-64 text-[#00FF9D]"><Loader2 className="animate-spin" size={40} /></div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                    {view === 'all' && (
                        <div onClick={() => setIsCreating(true)} className="aspect-square bg-[#1E1E1E] border border-dashed border-[#333] hover:border-[#00FF9D] hover:bg-[#1E1E1E]/80 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all group">
                            <div className="w-12 h-12 rounded-full bg-[#2A2A2A] group-hover:bg-[#00FF9D] flex items-center justify-center transition-colors mb-4"><Plus className="text-gray-400 group-hover:text-black" size={24} /></div>
                            <span className="text-gray-400 font-medium group-hover:text-white">New Board</span>
                        </div>
                    )}
                    
                    {filteredBoards.map((board: Board) => (
                        <div key={board.id} onClick={() => view === 'all' && onOpenBoard(board.id)} className={`aspect-square bg-[#1E1E1E] border border-[#333] hover:border-gray-500 rounded-2xl p-6 flex flex-col relative group cursor-pointer transition-all hover:translate-y-[-2px] hover:shadow-xl ${view === 'trash' ? 'opacity-70 grayscale' : ''}`}>
                            <div className="flex-1 flex flex-col items-center justify-center w-full">
                                <div className="text-5xl mb-4 select-none">{board.icon}</div>
                                
                                {editingId === board.id ? (
                                    <input 
                                        className="w-full bg-[#333] text-white text-center rounded px-2 py-1 outline-none border border-[#00FF9D]"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(board.id)}
                                        onBlur={() => handleSaveRename(board.id)}
                                        onClick={(e) => e.stopPropagation()}
                                        autoFocus
                                    />
                                ) : (
                                    <div className="group/title flex items-center gap-2 max-w-full">
                                        <h3 className="text-lg font-bold text-center text-gray-200 group-hover:text-white truncate px-2">{board.name}</h3>
                                        {view === 'all' && <button onClick={(e) => handleStartEdit(e, board)} className="opacity-0 group-hover/title:opacity-100 text-gray-500 hover:text-[#00FF9D]"><Pen size={12} /></button>}
                                    </div>
                                )}
                                
                                <span className="text-xs text-gray-600 mt-2">{board.elements.length} items</span>
                            </div>
                            
                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                {view === 'trash' ? (
                                    <>
                                        <button onClick={(e) => { e.stopPropagation(); onRestoreBoard(board.id); }} className="p-2 bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white rounded-lg" title="Restore"><RotateCcw size={14} /></button>
                                        <button onClick={(e) => { e.stopPropagation(); onPermanentDelete(board.id); }} className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg" title="Delete Permanently"><X size={14} /></button>
                                    </>
                                ) : (
                                    <button onClick={(e) => { e.stopPropagation(); onDeleteBoard(board.id); }} className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg" title="Move to Trash"><Trash2 size={14} /></button>
                                )}
                            </div>
                        </div>
                    ))}
                    
                    {filteredBoards.length === 0 && (
                        <div className="col-span-full flex flex-col items-center justify-center text-gray-600 py-20">
                            <Box size={48} className="mb-4 opacity-20" />
                            <p>No boards found in {view}.</p>
                        </div>
                    )}
                </div>
            )}

            {isCreating && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 animate-in fade-in duration-200">
                    <div className="bg-[#1E1E1E] border border-[#333] p-6 rounded-2xl w-96 shadow-2xl">
                        <h2 className="text-xl font-bold mb-4">Create New Board</h2>
                        <div className="flex gap-4 mb-4">
                            <div className="relative">
                                <button onClick={() => setShowIconPicker(!showIconPicker)} className="w-12 h-12 bg-[#2A2A2A] rounded-xl flex items-center justify-center text-2xl border border-[#333] hover:border-[#00FF9D]">{newBoardIcon}</button>
                                {showIconPicker && ( <div className="absolute top-14 left-0 bg-[#2A2A2A] border border-[#333] p-2 rounded-xl grid grid-cols-4 gap-1 w-48 shadow-xl z-10">{EMOJIS.map(emoji => ( <button key={emoji} onClick={() => { setNewBoardIcon(emoji); setShowIconPicker(false); }} className="p-2 hover:bg-[#333] rounded text-xl">{emoji}</button> ))}</div> )}
                            </div>
                            <input className="flex-1 bg-[#121212] border border-[#333] rounded-xl px-4 outline-none focus:border-[#00FF9D] text-white" placeholder="Board Name" autoFocus value={newBoardName} onChange={(e) => setNewBoardName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleCreate()} />
                        </div>
                        <div className="flex justify-end gap-2"><button onClick={() => setIsCreating(false)} className="px-4 py-2 text-gray-400 hover:text-white">Cancel</button><button onClick={handleCreate} className="px-4 py-2 bg-[#00FF9D] text-black font-bold rounded-xl hover:bg-[#00FF9D]/90">Create</button></div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Root App with Supabase Sync ---

export default function App() {
    const [session, setSession] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [boards, setBoards] = useState<Board[]>([]);
    const [activeBoardId, setActiveBoardId] = useState<string | null>(null);

    // 1. Check Auth Session
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });
        return () => subscription.unsubscribe();
    }, []);

    // 2. Fetch Boards when Session exists
    useEffect(() => {
        if (!session) return;
        const fetchBoards = async () => {
            setLoading(true);
            const { data, error } = await supabase.from('boards').select('*').order('last_modified', { ascending: false });
            if (!error && data) {
                // Map Supabase columns to our Board type
                const mappedBoards: Board[] = data.map(b => ({
                    id: b.id,
                    name: b.name,
                    icon: b.icon,
                    lastModified: b.last_modified,
                    // Parse JSONB data back into TS types
                    elements: b.data.elements || [],
                    connections: b.data.connections || [],
                    viewport: b.data.viewport || { x: 0, y: 0, zoom: 1 },
                    trashed: b.data.trashed || false
                }));
                setBoards(mappedBoards);
            }
            setLoading(false);
        };
        fetchBoards();
    }, [session]);

    const activeBoard = boards.find(b => b.id === activeBoardId);

    // 3. Handlers with Supabase Sync
    const handleCreateBoard = async (name: string, icon: string) => {
        const newBoard: Board = {
            id: crypto.randomUUID(), // Use UUID for DB compatibility
            name,
            icon,
            elements: [],
            connections: [],
            lastModified: Date.now(),
            viewport: { x: 0, y: 0, zoom: 1 },
            trashed: false
        };
        
        // Optimistic UI update
        setBoards(prev => [newBoard, ...prev]);

        // Sync to Supabase
        await supabase.from('boards').insert({
            id: newBoard.id,
            user_id: session.user.id,
            name: newBoard.name,
            icon: newBoard.icon,
            data: { elements: [], connections: [], viewport: newBoard.viewport, trashed: false },
            last_modified: newBoard.lastModified
        });
    };

    const handleDeleteBoard = async (id: string) => {
        const board = boards.find(b => b.id === id);
        if (!board) return;
        
        // Move to trash (Soft Delete)
        const updated = { ...board, trashed: true };
        handleUpdateBoard(updated);
    };

    const handleRestoreBoard = async (id: string) => {
        const board = boards.find(b => b.id === id);
        if (!board) return;
        const updated = { ...board, trashed: false };
        handleUpdateBoard(updated);
    };

    const handlePermanentDelete = async (id: string) => {
        // Optimistic
        setBoards(prev => prev.filter(b => b.id !== id));
        // Sync
        await supabase.from('boards').delete().eq('id', id);
    };

    const handleRenameBoard = async (id: string, newName: string) => {
        const board = boards.find(b => b.id === id);
        if (!board) return;
        
        // Local Update (Instant)
        const updated = { ...board, name: newName };
        setBoards(prev => prev.map(b => b.id === id ? updated : b));

        // Sync to DB
        await supabase.from('boards').update({ name: newName }).eq('id', id);
    }

    const handleUpdateBoard = async (updatedBoard: Board) => {
        // Local Update (Instant)
        setBoards(prev => prev.map(b => b.id === updatedBoard.id ? updatedBoard : b));
        
        // Sync to DB (Could debounce this further in production)
        await supabase.from('boards').upsert({
            id: updatedBoard.id,
            user_id: session.user.id,
            name: updatedBoard.name,
            icon: updatedBoard.icon,
            data: { 
                elements: updatedBoard.elements, 
                connections: updatedBoard.connections, 
                viewport: updatedBoard.viewport,
                trashed: updatedBoard.trashed 
            },
            last_modified: Date.now()
        });
    };

    if (loading && !boards.length) return <div className="min-h-screen bg-[#121212] flex items-center justify-center"><Loader2 className="text-[#00FF9D] animate-spin" size={48} /></div>;

    if (!session) {
        return <AuthScreen onAuthSuccess={() => {}} />;
    }

    return activeBoardId && activeBoard ? (
        <CanvasWorkspace 
            board={activeBoard} 
            onSave={handleUpdateBoard} 
            onBack={() => setActiveBoardId(null)} 
        />
    ) : (
        <HomeDashboard 
            boards={boards} 
            onOpenBoard={setActiveBoardId} 
            onCreateBoard={handleCreateBoard} 
            onDeleteBoard={handleDeleteBoard}
            onRestoreBoard={handleRestoreBoard}
            onPermanentDelete={handlePermanentDelete}
            onRenameBoard={handleRenameBoard}
            onLogout={() => supabase.auth.signOut()}
            loading={loading}
        />
    );
}
