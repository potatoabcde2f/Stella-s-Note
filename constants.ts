
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
  { id: 'select', icon: MousePointer2, label: 'Select (V)' },
  { id: 'text', type: 'text', icon: Type, label: 'Text (T)' },
  { id: 'note', type: 'note', icon: Box, label: 'Note' },
  { id: 'todo', type: 'todo', icon: CheckSquare, label: 'Todo (C)' },
  { id: 'container', type: 'container', icon: Layout, label: 'Board' },
  { id: 'table', type: 'table', icon: Table, label: 'Table' },
  { id: 'link', type: 'link', icon: Link, label: 'Link' },
  { id: 'image', type: 'image', icon: ImageIcon, label: 'Image' },
  { id: 'file', type: 'file', icon: FileText, label: 'File' },
];

export const INITIAL_BOARD_ID = 'default-board';
