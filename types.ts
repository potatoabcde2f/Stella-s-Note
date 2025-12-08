
export type ElementType = 'text' | 'note' | 'image' | 'file' | 'todo' | 'link' | 'container' | 'table';

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface TodoItem {
    id: string;
    text: string;
    done: boolean;
    level?: number; // 0 is root, 1 is indented
    dueDate?: string; // ISO date string
}

export interface CanvasElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  width: number;
  height: number;
  content: any; // Structure varies by type
  // content structure per type:
  // text: string
  // note: string
  // todo: { title: string, items: TodoItem[] }
  // link: { url: string, title?: string }
  // image: { url: string, caption?: string }
  // file: { name: string, size: string, url: string }
  // container: string (title)
  // table: { rows: number, cols: number, data: Record<string, string> }

  style?: {
    backgroundColor?: string;
    borderColor?: string;
    zIndex?: number;
    fontSize?: number;
    borderRadius?: number;
    textAlign?: 'left' | 'center' | 'right';
    fontFamily?: 'sans' | 'serif' | 'mono' | 'hand';
  };
  parentId?: string; // For containers
  selected?: boolean;
}

export interface Connection {
  id: string;
  fromId: string;
  toId: string;
  label?: string;
  type: 'straight' | 'curve' | 'step';
}

export interface Board {
  id: string;
  name: string;
  icon?: string;
  elements: CanvasElement[];
  connections: Connection[];
  lastModified: number;
  viewport: { x: number; y: number; zoom: number };
}

export interface ViewTransform {
  x: number;
  y: number;
  zoom: number;
}

export interface DragInfo {
    isDragging: boolean;
    startPos: Point;
    startElPos?: { x: number; y: number; w: number; h: number };
    childrenStartPos?: Record<string, Point>; // Track initial positions of children
    handle?: 'nw' | 'ne' | 'sw' | 'se'; // Corner handles
    type?: 'move' | 'resize';
}
