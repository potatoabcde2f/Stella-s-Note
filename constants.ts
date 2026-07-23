
import { Box, Type, CheckSquare, Link, Image as ImageIcon, Layout, MousePointer2, Table, FileText } from 'lucide-react';
import { ElementType } from './types';

export const COLORS = {
  background: '#000000',
  surface: '#121212',
  surfaceLight: '#1E1E1E',
  border: '#333333',
  primary: '#00FF9D', // Neon Green
  accent: '#FF00FF', // Neon Magenta
  text: '#E0E0E0',
  textMuted: '#A0A0A0',
};

// Dark-mode friendly palette for card backgrounds (white text compliant)
export const PALETTE = [
    '#1E1E1E', // Default Dark
    '#2C2C2C', // Gray
    '#3B2A2A', // Muted Red
    '#2A3B2A', // Muted Green
    '#2A2F3B', // Muted Blue
    '#3B2A3B', // Muted Purple
    '#3B352A', // Muted Orange/Brown
    'transparent'
];

export const TOOLS = [
  { id: 'select', icon: MousePointer2, label: '选择 (V)' },
  { id: 'text', type: 'text', icon: Type, label: '文字 (T)' },
  { id: 'note', type: 'note', icon: Box, label: '笔记' },
  { id: 'todo', type: 'todo', icon: CheckSquare, label: '待办 (C)' },
  { id: 'container', type: 'container', icon: Layout, label: '容器' },
  { id: 'table', type: 'table', icon: Table, label: '表格' },
  { id: 'link', type: 'link', icon: Link, label: '链接' },
  { id: 'image', type: 'image', icon: ImageIcon, label: '图片' },
  { id: 'file', type: 'file', icon: FileText, label: '文件' },
];

export const INITIAL_BOARD_ID = 'default-board';
