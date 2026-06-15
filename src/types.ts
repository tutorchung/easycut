export type ShapeType = 'circle' | 'ellipse' | 'square' | 'rect' | 'heart';

export interface Shape {
  id: string;
  type: ShapeType;
  left: number;   // 0 to 1 relative to image width
  top: number;    // 0 to 1 relative to image height
  width: number;  // 0 to 1 relative to image width
  height: number; // 0 to 1 relative to image height
}

export type SplitMode = 'grid' | 'shape' | 'free';

export type FreeMode = 'region' | 'divider';

export interface Point {
  x: number;
  y: number;
}
