import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import JSZip from 'jszip';
import {
  Image as ImageIcon,
  Columns,
  Layers,
  Scissors,
  Trash2,
  Plus,
  RotateCcw,
  Download,
  Grid,
  Sliders,
  HelpCircle,
  Lock,
  Move,
  CheckCircle,
  HelpCircle as HelpIcon,
  Check,
  ChevronRight,
  Sparkles,
  Info
} from 'lucide-react';
import { ShapeType, Shape, SplitMode, FreeMode, Point } from './types';

// Heart shape helper paths
function drawHeartPath(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.beginPath();
  ctx.moveTo(0.50 * w, 0.92 * h);
  ctx.bezierCurveTo(0.50 * w, 0.92 * h, 0.05 * w, 0.55 * h, 0.05 * w, 0.30 * h);
  ctx.bezierCurveTo(0.05 * w, 0.10 * h, 0.20 * w, 0.00 * h, 0.35 * w, 0.00 * h);
  ctx.bezierCurveTo(0.45 * w, 0.00 * h, 0.50 * w, 0.07 * h, 0.50 * w, 0.07 * h);
  ctx.bezierCurveTo(0.50 * w, 0.07 * h, 0.55 * w, 0.00 * h, 0.65 * w, 0.00 * h);
  ctx.bezierCurveTo(0.80 * w, 0.00 * h, 0.95 * w, 0.10 * h, 0.95 * w, 0.30 * h);
  ctx.bezierCurveTo(0.95 * w, 0.55 * h, 0.50 * w, 0.92 * h, 0.50 * w, 0.92 * h);
  ctx.closePath();
}

const SHAPE_LABELS: Record<ShapeType, string> = {
  circle: '원 (Circle)',
  ellipse: '타원 (Ellipse)',
  square: '정사각형 (Square)',
  rect: '직사각형 (Rectangle)',
  heart: '하트 (Heart)'
};

const HEART_SVG = (
  <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full">
    <path
      d="M 50 92 C 50 92 5 55 5 30 C 5 10 20 0 35 0 C 45 0 50 7 50 7 C 50 7 55 0 65 0 C 80 0 95 10 95 30 C 95 55 50 92 50 92 Z"
      fill="currentColor"
    />
  </svg>
);

export default function App() {
  const [selectedMode, setSelectedMode] = useState<SplitMode>('grid');
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [originalFileName, setOriginalFileName] = useState<string>('image');

  // Image layout dimensions (natural structure vs UI aspect mapping)
  const [naturalWidth, setNaturalWidth] = useState(0);
  const [naturalHeight, setNaturalHeight] = useState(0);

  // Status for general processing states
  const [isProcessing, setIsProcessing] = useState(false);

  // Drag & drop highlight state
  const [isDragOver, setIsDragOver] = useState(false);

  // 1. GRID SPLIT STATE
  const [hGuides, setHGuides] = useState<number[]>([]);
  const [vGuides, setVGuides] = useState<number[]>([]);
  const [rowsInput, setRowsInput] = useState<number>(2);
  const [colsInput, setColsInput] = useState<number>(2);

  // 2. SHAPE CROP STATE
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [shapeType, setShapeType] = useState<ShapeType>('circle');

  // 3. FREEFORM PEN STATE
  const [freePoints, setFreePoints] = useState<Point[]>([]);
  const [freeMode, setFreeMode] = useState<FreeMode>('region');
  const [freeSmooth, setFreeSmooth] = useState<boolean>(true);
  const [freeDrawing, setFreeDrawing] = useState<boolean>(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const imageElementRef = useRef<HTMLImageElement>(null);

  // Handle Drag & Drop / Image Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processImageFile(file);
  };

  const processImageFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 지원합니다.');
      return;
    }
    const sanitizedBase = file.name
      .replace(/\.[^.]+$/, '')
      .replace(/[^\w.\-가-힣]+/g, '_')
      .replace(/^[._-]+/, '')
      .slice(0, 100) || 'image';

    setOriginalFileName(sanitizedBase);

    const imageUrl = URL.createObjectURL(file);
    setImageSrc(imageUrl);

    // Initial resets
    setHGuides([]);
    setVGuides([]);
    setShapes([]);
    setSelectedShapeId(null);
    setFreePoints([]);
    setFreeDrawing(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processImageFile(file);
    }
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalWidth(img.naturalWidth);
    setNaturalHeight(img.naturalHeight);
  };

  // Helper: Find middle of the largest empty gap
  const getNextGuidePos = (guides: number[]) => {
    if (guides.length === 0) return 0.5;
    const sorted = [0, ...[...guides].sort((a, b) => a - b), 1];
    let bestGap = -1;
    let bestPos = 0.5;
    for (let i = 1; i < sorted.length; i++) {
      const gap = sorted[i] - sorted[i - 1];
      if (gap > bestGap) {
        bestGap = gap;
        bestPos = (sorted[i] + sorted[i - 1]) / 2;
      }
    }
    return bestPos;
  };

  // GRID HANDLERS
  const addHGuide = () => {
    setHGuides((prev) => [...prev, getNextGuidePos(prev)]);
  };

  const addVGuide = () => {
    setVGuides((prev) => [...prev, getNextGuidePos(prev)]);
  };

  const applyGridSplit = () => {
    const rows = Math.max(1, Math.min(20, rowsInput));
    const cols = Math.max(1, Math.min(20, colsInput));

    const newH: number[] = [];
    for (let i = 1; i < rows; i++) {
      newH.push(i / rows);
    }
    const newV: number[] = [];
    for (let i = 1; i < cols; i++) {
      newV.push(i / cols);
    }
    setHGuides(newH);
    setVGuides(newV);
  };

  const clearGuides = () => {
    setHGuides([]);
    setVGuides([]);
  };

  const handleGuideDrag = (
    e: React.PointerEvent<HTMLDivElement>,
    type: 'h' | 'v',
    index: number
  ) => {
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);

    const updatePosition = (pe: PointerEvent) => {
      const rect = workspaceRef.current?.getBoundingClientRect();
      if (!rect) return;

      if (type === 'h') {
        let ratio = (pe.clientY - rect.top) / rect.height;
        ratio = Math.min(0.999, Math.max(0.001, ratio));
        setHGuides((prev) => {
          const next = [...prev];
          next[index] = ratio;
          return next;
        });
      } else {
        let ratio = (pe.clientX - rect.left) / rect.width;
        ratio = Math.min(0.999, Math.max(0.001, ratio));
        setVGuides((prev) => {
          const next = [...prev];
          next[index] = ratio;
          return next;
        });
      }
    };

    const onPointerMove = (pe: PointerEvent) => {
      updatePosition(pe);
    };

    const onPointerUp = (pe: PointerEvent) => {
      el.releasePointerCapture(pe.pointerId);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const deleteGuide = (type: 'h' | 'v', index: number) => {
    if (type === 'h') {
      setHGuides((prev) => prev.filter((_, i) => i !== index));
    } else {
      setVGuides((prev) => prev.filter((_, i) => i !== index));
    }
  };

  // SHAPE DESIGN HANDLERS
  const addShapeInstance = () => {
    const id = Date.now().toString() + Math.random().toString().slice(2, 6);
    let w = 0.35;
    let h = 0.35;

    if (shapeType === 'rect' || shapeType === 'ellipse') {
      h = 0.22;
    }

    // Force standard square matching pixel ratios if background exists
    const container = workspaceRef.current;
    if (container && (shapeType === 'circle' || shapeType === 'square')) {
      const rect = container.getBoundingClientRect();
      const side = Math.min(w * rect.width, h * rect.height);
      w = side / rect.width;
      h = side / rect.height;
    }

    const cascadeOffset = (shapes.length % 5) * 0.03;
    const newShape: Shape = {
      id,
      type: shapeType,
      left: Math.min((1 - w) / 2 + cascadeOffset, 1 - w),
      top: Math.min((1 - h) / 2 + cascadeOffset, 1 - h),
      width: w,
      height: h
    };

    setShapes((prev) => [...prev, newShape]);
    setSelectedShapeId(id);
  };

  const deleteShapeInstance = (id: string, e?: React.PointerEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setShapes((prev) => prev.filter((s) => s.id !== id));
    if (selectedShapeId === id) {
      setSelectedShapeId(null);
    }
  };

  const clearAllShapes = () => {
    setShapes([]);
    setSelectedShapeId(null);
  };

  // Interactive dragging of shapes
  const handleShapeDragStart = (e: React.PointerEvent<HTMLDivElement>, shapeId: string) => {
    if ((e.target as HTMLElement).closest('.shape-handle') || (e.target as HTMLElement).closest('.shape-delete-btn')) {
      return;
    }
    e.preventDefault();
    setSelectedShapeId(shapeId);

    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!rect) return;

    const shape = shapes.find((s) => s.id === shapeId);
    if (!shape) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = shape.left;
    const startTop = shape.top;

    const onPointerMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / rect.width;
      const dy = (ev.clientY - startY) / rect.height;

      let left = startLeft + dx;
      let top = startTop + dy;

      left = Math.min(Math.max(left, 0), 1 - shape.width);
      top = Math.min(Math.max(top, 0), 1 - shape.height);

      setShapes((prev) =>
        prev.map((s) => (s.id === shapeId ? { ...s, left, top } : s))
      );
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // Dynamic reshaping from edge resize handles
  const handleShapeResizeStart = (
    e: React.PointerEvent<HTMLDivElement>,
    shapeId: string,
    corner: 'nw' | 'ne' | 'sw' | 'se'
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!rect) return;

    const shape = shapes.find((s) => s.id === shapeId);
    if (!shape) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const start = { ...shape };
    const lockAspect = start.type === 'square' || start.type === 'circle';

    const onPointerMove = (ev: PointerEvent) => {
      let dx = (ev.clientX - startX) / rect.width;
      let dy = (ev.clientY - startY) / rect.height;

      let left = start.left;
      let top = start.top;
      let width = start.width;
      let height = start.height;

      if (corner === 'se') {
        width = start.width + dx;
        height = start.height + dy;
      } else if (corner === 'sw') {
        width = start.width - dx;
        height = start.height + dy;
        left = start.left + dx;
      } else if (corner === 'ne') {
        width = start.width + dx;
        height = start.height - dy;
        top = start.top + dy;
      } else {
        // nw
        width = start.width - dx;
        height = start.height - dy;
        left = start.left + dx;
        top = start.top + dy;
      }

      if (lockAspect) {
        // Enforce aspect-locked pixel proportions
        const pixelW = width * rect.width;
        const pixelH = height * rect.height;
        const side = Math.max(Math.min(pixelW, pixelH), 15);
        width = side / rect.width;
        height = side / rect.height;

        if (corner === 'sw' || corner === 'nw') {
          left = start.left + start.width - width;
        }
        if (corner === 'ne' || corner === 'nw') {
          top = start.top + start.height - height;
        }
      }

      const minScale = 0.02;
      if (width < minScale) {
        width = minScale;
        if (corner === 'sw' || corner === 'nw') left = start.left + start.width - width;
      }
      if (height < minScale) {
        height = minScale;
        if (corner === 'ne' || corner === 'nw') top = start.top + start.height - height;
      }

      left = Math.max(0, left);
      top = Math.max(0, top);
      if (left + width > 1) width = 1 - left;
      if (top + height > 1) height = 1 - top;

      setShapes((prev) =>
        prev.map((s) =>
          s.id === shapeId ? { ...s, left, top, width, height } : s
        )
      );
    };

    const onPointerUp = () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  // 3. FREEFORM DRAWING CONTROLLERS
  const handleFreePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!imageSrc) return;
    e.preventDefault();
    setFreeDrawing(true);

    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const pt = { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };

    setFreePoints([pt]);
  };

  const handleFreePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!freeDrawing) return;
    const rect = workspaceRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const pt = { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };

    const last = freePoints[freePoints.length - 1];
    if (last) {
      const dx = pt.x - last.x;
      const dy = pt.y - last.y;
      // Skip redundant micro-points
      if (dx * dx + dy * dy < 0.00002) return;
    }

    setFreePoints((prev) => [...prev, pt]);
  };

  const handleFreePointerUp = () => {
    setFreeDrawing(false);
  };

  const clearFreePath = () => {
    setFreePoints([]);
    setFreeDrawing(false);
  };

  // Validating Divider edges (3% border gap limit)
  const EDGE_TOL = 0.03;
  const isPtOnEdge = (p: Point) => {
    return p.x <= EDGE_TOL || p.x >= 1 - EDGE_TOL || p.y <= EDGE_TOL || p.y >= 1 - EDGE_TOL;
  };

  const isDividerValid = () => {
    if (freePoints.length < 2) return false;
    const first = freePoints[0];
    const last = freePoints[freePoints.length - 1];
    const dx = first.x - last.x;
    const dy = first.y - last.y;
    if (dx * dx + dy * dy < 0.01) return false; // Endpoints cannot converge
    return isPtOnEdge(first) && isPtOnEdge(last);
  };

  // Convert normalized scale path to SVG path string (Bezier / Smoothed Quad curves)
  const getFreeSvgPath = (closed: boolean) => {
    if (freePoints.length === 0) return '';
    let d = '';
    const f = (n: number) => (n * 100).toFixed(2);

    const p0 = freePoints[0];
    d += `M ${f(p0.x)} ${f(p0.y)} `;

    if (!freeSmooth || freePoints.length < 3) {
      for (let i = 1; i < freePoints.length; i++) {
        d += `L ${f(freePoints[i].x)} ${f(freePoints[i].y)} `;
      }
    } else {
      for (let i = 1; i < freePoints.length - 1; i++) {
        const c = freePoints[i];
        const n = freePoints[i + 1];
        const mx = (c.x + n.x) / 2;
        const my = (c.y + n.y) / 2;
        d += `Q ${f(c.x)} ${f(c.y)} ${f(mx)} ${f(my)} `;
      }
      const last = freePoints[freePoints.length - 1];
      d += `L ${f(last.x)} ${f(last.y)} `;
    }

    if (closed && freeMode === 'region') {
      d += 'Z';
    }
    return d;
  };

  // -------------------------------------------------------------
  // CROPPING / SLICING COMPILATION & EXPORTS
  // -------------------------------------------------------------

  // Base canvas loader helper
  const loadImageElement = (): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = imageSrc || '';
    });
  };

  const handleDownloadGrid = async () => {
    if (!imageSrc) return;
    setIsProcessing(true);

    try {
      const originalImage = await loadImageElement();
      const wNative = originalImage.naturalWidth;
      const hNative = originalImage.naturalHeight;

      // Clean, sorted distinct ratio lists
      const xs = [0, ...[...vGuides].sort((a, b) => a - b), 1].map((r) =>
        Math.round(r * wNative)
      );
      const ys = [0, ...[...hGuides].sort((a, b) => a - b), 1].map((r) =>
        Math.round(r * hNative)
      );

      // Deduplicate coordinates
      const cleanArray = (arr: number[], limit: number) => {
        const out = [arr[0]];
        for (let i = 1; i < arr.length; i++) {
          let v = Math.max(arr[i], out[out.length - 1] + 1);
          v = Math.min(v, limit);
          out.push(v);
        }
        out[out.length - 1] = limit;
        return out;
      };

      const finalXs = cleanArray(xs, wNative);
      const finalYs = cleanArray(ys, hNative);

      const zip = new JSZip();
      const folder = zip.folder(`${originalFileName}_pieces`);

      let idx = 1;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Canvas context could not be created');
      }

      for (let r = 0; r < finalYs.length - 1; r++) {
        for (let c = 0; c < finalXs.length - 1; c++) {
          const x0 = finalXs[c];
          const x1 = finalXs[c + 1];
          const y0 = finalYs[r];
          const y1 = finalYs[r + 1];

          const cropW = x1 - x0;
          const cropH = y1 - y0;

          if (cropW <= 0 || cropH <= 0) continue;

          canvas.width = cropW;
          canvas.height = cropH;

          ctx.clearRect(0, 0, cropW, cropH);
          ctx.drawImage(originalImage, x0, y0, cropW, cropH, 0, 0, cropW, cropH);

          const blob = await new Promise<Blob | null>((res) =>
            canvas.toBlob((b) => res(b), 'image/png')
          );
          if (blob) {
            const name = `${String(r + 1).padStart(2, '0')}_${String(c + 1).padStart(
              2,
              '0'
            )}.png`;
            folder?.file(name, blob);
          }
          idx++;
        }
      }

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      triggerBlobDownload(zipBlob, `${originalFileName}_divided_grid.zip`);
    } catch (err) {
      console.error(err);
      alert('격자 분할 처리 중 오류 발생');
    } finally {
      setIsProcessing(false);
    }
  };

  const cropShapeToBlob = async (
    shape: Shape,
    originalImage: HTMLImageElement
  ): Promise<Blob | null> => {
    const W = originalImage.naturalWidth;
    const H = originalImage.naturalHeight;

    const x0 = Math.round(shape.left * W);
    const y0 = Math.round(shape.top * H);
    const targetW = Math.max(1, Math.round(shape.width * W));
    const targetH = Math.max(1, Math.round(shape.height * H));

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');

    if (!ctx) return null;

    if (shape.type === 'circle' || shape.type === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(targetW / 2, targetH / 2, targetW / 2, targetH / 2, 0, 0, Math.PI * 2);
      ctx.clip();
    } else if (shape.type === 'heart') {
      drawHeartPath(ctx, targetW, targetH);
      ctx.clip();
    }

    ctx.drawImage(originalImage, x0, y0, targetW, targetH, 0, 0, targetW, targetH);

    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  };

  const handleDownloadShapes = async () => {
    if (!imageSrc || shapes.length === 0) return;
    setIsProcessing(true);

    try {
      const originalImage = await loadImageElement();

      // Dual path: single direct download, or package zip
      if (shapes.length === 1) {
        const blob = await cropShapeToBlob(shapes[0], originalImage);
        if (blob) {
          triggerBlobDownload(
            blob,
            `${originalFileName}_shape_${shapes[0].type}.png`
          );
        }
      } else {
        const zip = new JSZip();
        const folder = zip.folder(`${originalFileName}_shapes`);

        for (let i = 0; i < shapes.length; i++) {
          const s = shapes[i];
          const blob = await cropShapeToBlob(s, originalImage);
          if (blob) {
            folder?.file(
              `${String(i + 1).padStart(2, '0')}_shape_${s.type}.png`,
              blob
            );
          }
        }

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        triggerBlobDownload(zipBlob, `${originalFileName}_shapes.zip`);
      }
    } catch (err) {
      console.error(err);
      alert('도형 자르기 연산 중 오류 발생');
    } finally {
      setIsProcessing(false);
    }
  };

  // Convert trace lines onto canvas structure
  const traceCanvasPath = (
    pts: Point[],
    ctx: CanvasRenderingContext2D,
    sx: number,
    sy: number,
    ox: number,
    oy: number,
    closed: boolean
  ) => {
    if (pts.length === 0) return;
    const scalePt = (i: number) => ({
      x: pts[i].x * sx - ox,
      y: pts[i].y * sy - oy
    });

    const p0 = scalePt(0);
    ctx.moveTo(p0.x, p0.y);

    if (!freeSmooth || pts.length < 3) {
      for (let i = 1; i < pts.length; i++) {
        const pt = scalePt(i);
        ctx.lineTo(pt.x, pt.y);
      }
    } else {
      for (let i = 1; i < pts.length - 1; i++) {
        const c = scalePt(i);
        const n = scalePt(i + 1);
        ctx.quadraticCurveTo(c.x, c.y, (c.x + n.x) / 2, (c.y + n.y) / 2);
      }
      const last = scalePt(pts.length - 1);
      ctx.lineTo(last.x, last.y);
    }

    if (closed) {
      ctx.closePath();
    }
  };

  // Crop Region (Freehand)
  const handleDownloadFreeRegion = async () => {
    if (freePoints.length < 3) return;
    setIsProcessing(true);

    try {
      const originalImage = await loadImageElement();
      const W = originalImage.naturalWidth;
      const H = originalImage.naturalHeight;

      const pxX = freePoints.map((p) => p.x * W);
      const pxY = freePoints.map((p) => p.y * H);

      const minX = Math.max(0, Math.floor(Math.min(...pxX)));
      const minY = Math.max(0, Math.floor(Math.min(...pxY)));
      const maxX = Math.min(W, Math.ceil(Math.max(...pxX)));
      const maxY = Math.min(H, Math.ceil(Math.max(...pxY)));

      const cropW = Math.max(1, maxX - minX);
      const cropH = Math.max(1, maxY - minY);

      const canvas = document.createElement('canvas');
      canvas.width = cropW;
      canvas.height = cropH;
      const ctx = canvas.getContext('2d');

      if (!ctx) throw new Error('Could not get Canvas API context');

      ctx.beginPath();
      traceCanvasPath(freePoints, ctx, W, H, minX, minY, true);
      ctx.clip();

      ctx.drawImage(originalImage, -minX, -minY);

      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, 'image/png')
      );
      if (blob) {
        triggerBlobDownload(blob, `${originalFileName}_freeform_region.png`);
      }
    } catch (err) {
      console.error(err);
      alert('영역 자르기 도중 오류 발생');
    } finally {
      setIsProcessing(false);
    }
  };

  // Coordinate math helpers for Freehand divider splits
  const snapToEdgePx = (pt: Point, W: number, H: number): Point => {
    const x = Math.min(W, Math.max(0, pt.x));
    const y = Math.min(H, Math.max(0, pt.y));
    const dist = { left: x, right: W - x, top: y, bottom: H - y };
    const m = Math.min(dist.left, dist.right, dist.top, dist.bottom);

    if (m === dist.left) return { x: 0, y };
    if (m === dist.right) return { x: W, y };
    if (m === dist.top) return { x, y: 0 };
    return { x, y: H };
  };

  const getPerimeterPosition = (p: Point, W: number, H: number): number => {
    if (p.y === 0) return p.x; // Top boundary: 0 -> W
    if (p.x === W) return W + p.y; // Right boundary: W -> W+H
    if (p.y === H) return W + H + (W - p.x); // Bottom boundary: W+H -> 2W+H
    return 2 * W + H + (H - p.y); // Left boundary: 2W+H -> 2W+2H
  };

  const getCornersBetween = (from: number, to: number, W: number, H: number): Point[] => {
    const perimeter = 2 * W + 2 * H;
    const corners = [
      { p: 0, x: 0, y: 0 },
      { p: W, x: W, y: 0 },
      { p: W + H, x: W, y: H },
      { p: 2 * W + H, x: 0, y: H }
    ];

    const span = (to - from + perimeter) % perimeter;
    const found: { x: number; y: number; delta: number }[] = [];

    for (const c of corners) {
      const d = (c.p - from + perimeter) % perimeter;
      if (d > 1e-6 && d < span - 1e-6) {
        found.push({ x: c.x, y: c.y, delta: d });
      }
    }

    found.sort((a, b) => a.delta - b.delta);
    return found.map((c) => ({ x: c.x, y: c.y }));
  };

  const cropPolygonToBlob = async (
    poly: Point[],
    originalImage: HTMLImageElement
  ): Promise<Blob | null> => {
    const W = originalImage.naturalWidth;
    const H = originalImage.naturalHeight;

    const xs = poly.map((p) => p.x);
    const ys = poly.map((p) => p.y);

    const minX = Math.max(0, Math.floor(Math.min(...xs)));
    const minY = Math.max(0, Math.floor(Math.min(...ys)));
    const maxX = Math.min(W, Math.ceil(Math.max(...xs)));
    const maxY = Math.min(H, Math.ceil(Math.max(...ys)));

    const wCrop = Math.max(1, maxX - minX);
    const hCrop = Math.max(1, maxY - minY);

    const canvas = document.createElement('canvas');
    canvas.width = wCrop;
    canvas.height = hCrop;
    const ctx = canvas.getContext('2d');

    if (!ctx) return null;

    ctx.beginPath();
    ctx.moveTo(poly[0].x - minX, poly[0].y - minY);
    for (let i = 1; i < poly.length; i++) {
      ctx.lineTo(poly[i].x - minX, poly[i].y - minY);
    }
    ctx.closePath();
    ctx.clip();

    ctx.drawImage(originalImage, -minX, -minY);

    return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  };

  const handleDownloadFreeDivider = async () => {
    if (!isDividerValid()) return;
    setIsProcessing(true);

    try {
      const originalImage = await loadImageElement();
      const W = originalImage.naturalWidth;
      const H = originalImage.naturalHeight;

      // Map scale line to actual pixel dimensions
      const line = freePoints.map((p) => ({ x: p.x * W, y: p.y * H }));
      // Anchor boundary endpoints solidly to closest borders
      line[0] = snapToEdgePx(line[0], W, H);
      line[line.length - 1] = snapToEdgePx(line[line.length - 1], W, H);

      const pA = getPerimeterPosition(line[0], W, H);
      const pB = getPerimeterPosition(line[line.length - 1], W, H);

      // Sub-polygon 1: Line forward A -> B, then perimeter clock-wise back B -> A
      const poly1 = [...line, ...getCornersBetween(pB, pA, W, H)];
      // Sub-polygon 2: Line forward A -> B, then perimeter counter-clockwise back (reversed clock-wise A -> B)
      const poly2 = [...line, ...getCornersBetween(pA, pB, W, H).reverse()];

      // Sort so higher piece (smaller mean Y) emerges first
      const meanY = (points: Point[]) =>
        points.reduce((sum, p) => sum + p.y, 0) / points.length;

      const items = meanY(poly1) <= meanY(poly2) ? [poly1, poly2] : [poly2, poly1];

      const blob1 = await cropPolygonToBlob(items[0], originalImage);
      const blob2 = await cropPolygonToBlob(items[1], originalImage);

      const zip = new JSZip();
      const folder = zip.folder(`${originalFileName}_split_divider`);

      if (blob1) folder?.file('01_top_portion.png', blob1);
      if (blob2) folder?.file('02_bottom_portion.png', blob2);

      const zipBlob = await zip.generateAsync({ type: 'blob' });
      triggerBlobDownload(zipBlob, `${originalFileName}_split_divider.zip`);
    } catch (err) {
      console.error(err);
      alert('분할선 자르기 적용 중 오류 발생');
    } finally {
      setIsProcessing(false);
    }
  };

  // Base download dispatcher
  const triggerBlobDownload = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-[#f8fafc] bg-[radial-gradient(at_top_right,#eff6ff_0%,transparent_50%)] min-h-screen text-[#0f172a] flex flex-col items-center py-8 px-4 md:px-8 selection:bg-blue-100 font-sans">
      
      {/* 1. APP HEADER DESIGN - Professional Polish Theme */}
      <header className="flex flex-col items-center mb-10 w-full max-w-4xl text-center">
        {/* Release / Privacy Badge */}
        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#dbeafe] text-[#1e40af] rounded-full text-xs font-bold uppercase tracking-wider shadow-sm mb-4 select-none">
          <Sparkles className="w-3.5 h-3.5 text-[#3b82f6]" />
          <span>오프라인 100% 프라이버시</span>
        </div>
        
        {/* Main Title resembling elegant display headers */}
        <h1 className="text-4xl md:text-5xl font-bold text-[#0f172a] tracking-tight leading-tight select-none">
          이미지 자유 분할기
        </h1>
        
        {/* Segmented subtitle */}
        <div className="font-semibold text-[#64748b] text-[11px] md:text-xs text-center mb-3 mt-2.5">
          한 장에 들어있는 여러 이모티콘 이미지들을 한방에 자를 때도 편해요~^^
        </div>
      </header>

      {/* 2. MODE CAROUSEL TAB SWITCHER (Refined Professional Pill Styling) */}
      <div className="w-full max-w-xl bg-white border border-[#e2e8f0] p-1 rounded-xl flex gap-1 mb-8 shadow-sm">
        <button
          onClick={() => setSelectedMode('grid')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm transition-all duration-150 ${
            selectedMode === 'grid'
              ? 'bg-[#0f172a] text-white shadow-sm'
              : 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9]'
          }`}
        >
          <Grid className="w-4 h-4" />
          <span>격자 분할</span>
        </button>

        <button
          onClick={() => setSelectedMode('shape')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm transition-all duration-150 ${
            selectedMode === 'shape'
              ? 'bg-[#0f172a] text-white shadow-sm'
              : 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>도형 오리기</span>
        </button>

        <button
          onClick={() => setSelectedMode('free')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm transition-all duration-150 ${
            selectedMode === 'free'
              ? 'bg-[#0f172a] text-white shadow-sm'
              : 'text-[#64748b] hover:text-[#0f172a] hover:bg-[#f1f5f9]'
          }`}
        >
          <Scissors className="w-4 h-4" />
          <span>자유형 (펜)</span>
        </button>
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* LEFT COLUMN: ACTIVE MODE CONTROL STATION & ACTIONS */}
        <div className="lg:col-span-4 flex flex-col gap-6">

          {/* 1) CHOOSE TARGET IMAGE CARD */}
          <div className="bg-white border border-[#e2e8f0] p-6 rounded-xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.05)]">
            <h3 className="font-bold text-[#0f172a] text-base mb-3.5 flex items-center gap-2">
              <ImageIcon className="w-4.5 h-4.5 text-[#3b82f6]" />
              <span>이미지 불러오기</span>
            </h3>

            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                isDragOver
                  ? 'border-[#3b82f6] bg-[#eff6ff]/40 scale-[0.98]'
                  : 'border-slate-200 hover:border-[#3b82f6]/60 bg-slate-50/50 hover:bg-white'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              <ImageIcon className="w-8 h-8 mx-auto text-slate-400 mb-2" />
              <p className="font-semibold text-xs text-slate-700">
                {imageSrc ? '새로운 이미지 선택' : '클릭하거나 드래그하여 드롭'}
              </p>
              <p className="text-[10px] text-slate-400 mt-1 font-medium">PNG, JPG, BMP 등</p>
            </div>

            {imageSrc && (
              <div className="mt-4 p-3 bg-[#eff6ff]/70 border border-[#dbeafe]/40 rounded-xl flex items-center gap-3">
                <Check className="w-4 h-4 text-[#3b82f6] flex-none" />
                <div className="overflow-hidden">
                  <p className="font-bold text-xs text-[#1e40af] truncate">
                    {originalFileName}
                  </p>
                  <p className="text-[10px] text-[#3b82f6] font-medium">
                    실제 해상도 {naturalWidth} × {naturalHeight} px
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* 2) CONFIGURATOR CARD SPECIFIC TO TARGET SPLIT MODE */}
          <AnimatePresence mode="wait">
            <motion.div
              key={selectedMode}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-white border border-[#e2e8f0] p-6 rounded-xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.05)]"
            >
              
              {/* INTERACTIVE CONTROLS: GRID */}
              {selectedMode === 'grid' && (
                <div>
                  <h3 className="font-bold text-[#0f172a] text-base mb-4 flex items-center gap-2">
                    <Grid className="w-4.5 h-4.5 text-[#3b82f6]" />
                    <span>격자 분할 옵션</span>
                  </h3>

                  <div className="flex flex-col gap-4">
                    {/* Fast Auto Equal Split Form */}
                    <div className="bg-slate-50/50 border border-slate-200/60 rounded-lg p-4 flex flex-col gap-3">
                      <p className="font-bold text-[10px] text-slate-500 uppercase tracking-wider">
                        균등 자동 바둑판식 분할
                      </p>
                      
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-[#64748b] mb-1">
                            가로 칸수 (행)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="20"
                            value={rowsInput}
                            onChange={(e) =>
                              setRowsInput(Math.max(1, parseInt(e.target.value) || 1))
                            }
                            className="w-full font-semibold text-sm bg-white border border-slate-200 rounded-lg p-2 text-center focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] transition"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-[#64748b] mb-1">
                            세로 칸수 (열)
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="20"
                            value={colsInput}
                            onChange={(e) =>
                              setColsInput(Math.max(1, parseInt(e.target.value) || 1))
                            }
                            className="w-full font-semibold text-sm bg-white border border-slate-200 rounded-lg p-2 text-center focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] transition"
                          />
                        </div>
                      </div>

                      <button
                        onClick={applyGridSplit}
                        disabled={!imageSrc}
                        className="w-full bg-[#0f172a] hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold text-xs py-2.5 rounded-lg transition duration-150"
                      >
                        균등 분할선 적용하기
                      </button>
                    </div>

                    {/* Manual Guide Adds */}
                    <div className="flex flex-col gap-2">
                      <p className="font-bold text-[10px] text-slate-500 uppercase tracking-wider">
                        가이드라인 개별 수동 조율
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={addHGuide}
                          disabled={!imageSrc}
                          className="flex items-center justify-center gap-1 bg-[#eff6ff] hover:bg-[#dbeafe] disabled:opacity-30 disabled:cursor-not-allowed text-[#1e40af] font-semibold text-xs py-2.5 rounded-lg border border-[#dbeafe]/50 transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>가로선 추가</span>
                        </button>
                        <button
                          onClick={addVGuide}
                          disabled={!imageSrc}
                          className="flex items-center justify-center gap-1 bg-[#eff6ff] hover:bg-[#dbeafe] disabled:opacity-30 disabled:cursor-not-allowed text-[#1e40af] font-semibold text-xs py-2.5 rounded-lg border border-[#dbeafe]/50 transition"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>세로선 추가</span>
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={clearGuides}
                      disabled={!imageSrc || (hGuides.length === 0 && vGuides.length === 0)}
                      className="flex items-center justify-center gap-1.5 bg-[#fef2f2] hover:bg-[#fee2e2] text-[#991b1b] font-semibold text-xs py-2.5 rounded-lg border border-[#fca5a5]/30 transition disabled:opacity-30"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>모든 가이드라인 완전히 투명화</span>
                    </button>
                  </div>
                </div>
              )}

              {/* INTERACTIVE CONTROLS: SHAPE */}
              {selectedMode === 'shape' && (
                <div>
                  <h3 className="font-bold text-[#0f172a] text-base mb-4 flex items-center gap-2">
                    <Sliders className="w-4.5 h-4.5 text-[#3b82f6]" />
                    <span>도형 오리기 옵션</span>
                  </h3>

                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-[#64748b] uppercase tracking-wider mb-2">
                        도형 템플릿 종류 선택
                      </label>
                      <div className="grid grid-cols-2 gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-150">
                        {(['circle', 'ellipse', 'square', 'rect', 'heart'] as ShapeType[]).map(
                          (t) => (
                            <button
                              key={t}
                              onClick={() => setShapeType(t)}
                              className={`py-1.5 px-1 rounded-md text-[11px] font-semibold transition-all ${
                                shapeType === t
                                  ? 'bg-[#0f172a] text-white shadow-sm'
                                  : 'text-slate-500 hover:text-slate-800'
                              }`}
                            >
                              {SHAPE_LABELS[t].split(' ')[0]}
                            </button>
                          )
                        )}
                      </div>
                    </div>

                    <button
                      onClick={addShapeInstance}
                      disabled={!imageSrc}
                      className="w-full flex items-center justify-center gap-2 bg-[#0f172a] hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed text-white font-semibold text-xs py-2.5 rounded-lg shadow-sm transition-all active:scale-[0.98]"
                    >
                      <Plus className="w-4 h-4" />
                      <span>작업대에 도형 추가</span>
                    </button>

                    <button
                      onClick={clearAllShapes}
                      disabled={!imageSrc || shapes.length === 0}
                      className="flex items-center justify-center gap-1.5 bg-[#fef2f2] hover:bg-[#fee2e2] text-[#991b1b] font-semibold text-xs py-2.5 rounded-lg border border-[#fca5a5]/30 transition disabled:opacity-30"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>모든 배치된 도형 일괄 제거</span>
                    </button>
                  </div>
                </div>
              )}

              {/* INTERACTIVE CONTROLS: FREEFORM */}
              {selectedMode === 'free' && (
                <div>
                  <h3 className="font-bold text-[#0f172a] text-base mb-4 flex items-center gap-2">
                    <Scissors className="w-4.5 h-4.5 text-[#3b82f6]" />
                    <span>자유형 펜 옵션</span>
                  </h3>

                  <div className="flex flex-col gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                        오려내기 작동 연산 방식
                      </label>
                      <div className="grid grid-cols-2 gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-150">
                        <button
                          onClick={() => setFreeMode('region')}
                          className={`py-2 rounded-md text-[11px] font-semibold transition-all ${
                            freeMode === 'region'
                              ? 'bg-[#0f172a] text-white shadow-sm'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          다각형 영역 오리기
                        </button>
                        <button
                          onClick={() => setFreeMode('divider')}
                          className={`py-2 rounded-md text-[11px] font-semibold transition-all ${
                            freeMode === 'divider'
                              ? 'bg-[#0f172a] text-white shadow-sm'
                              : 'text-slate-500 hover:text-slate-800'
                          }`}
                        >
                          단일선 분할 오리기
                        </button>
                      </div>
                    </div>

                    <label className="flex items-center gap-3 bg-slate-50/50 hover:bg-slate-50 border border-slate-100 rounded-lg p-3 cursor-pointer select-none transition">
                      <input
                        type="checkbox"
                        checked={freeSmooth}
                        onChange={(e) => setFreeSmooth(e.target.checked)}
                        className="rounded text-[#3b82f6] focus:ring-[#3b82f6] w-4 h-4"
                      />
                      <div className="text-left">
                        <p className="font-semibold text-xs text-slate-700">부드러운 스플라인 곡선</p>
                        <p className="text-[10px] text-slate-400 font-medium">삐뚤삐뚤하지 않게 펜선을 부드럽게 조정</p>
                      </div>
                    </label>

                    <button
                      onClick={clearFreePath}
                      disabled={!imageSrc || freePoints.length === 0}
                      className="flex items-center justify-center gap-1.5 bg-[#fef2f2] hover:bg-[#fee2e2] text-[#991b1b] font-semibold text-xs py-2.5 rounded-lg border border-[#fca5a5]/30 transition disabled:opacity-30"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>그린 펜선 지우고 처음부터 다시 그리기</span>
                    </button>
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>

          {/* HELP INFO CHIPS (Design inspired by steps layout) */}
          <div className="bg-white border border-[#e2e8f0] p-5 rounded-xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.05)] text-xs">
            <span className="font-bold text-[#0f172a] flex items-center gap-1.5 mb-2.5 text-sm">
              <HelpIcon className="w-4 h-4 text-[#3b82f6]" />
              <span>간단 사용 설명서</span>
            </span>
            <ul className="space-y-2 text-[#475569] font-medium list-none pl-0">
              {selectedMode === 'grid' && (
                <>
                  <li className="flex gap-2">
                    <span className="text-[#3b82f6] font-bold flex-none">1.</span>
                    <span>균등 분할을 적용하거나 가로/세로 가이드 추가 버튼을 클릭하세요.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#3b82f6] font-bold flex-none">2.</span>
                    <span>화면 위 가이드를 직접 드래그하여 자를 세부 비율을 정밀 조절합니다.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#3b82f6] font-bold flex-none">3.</span>
                    <span>가이드라인 구석의 <span className="text-[#ef4444] font-bold">×</span> 단추를 클릭하면 개별 가이드가 순식간에 사라집니다.</span>
                  </li>
                </>
              )}
              {selectedMode === 'shape' && (
                <>
                  <li className="flex gap-2">
                    <span className="text-[#3b82f6] font-bold flex-none">1.</span>
                    <span>원하는 모양을 고르고 가방끈 모양처럼 도형을 작업대에 추가하세요.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#3b82f6] font-bold flex-none">2.</span>
                    <span>도형 영역 안을 끌어 이동하고, 네 모퉁이 작은 동그라미를 잡고 크기를 늘릴 수 있습니다.</span>
                  </li>
                  <li className="flex gap-2">
                    <span className="text-[#3b82f6] font-bold flex-none">3.</span>
                    <span>도형별 우상단 <span className="font-bold text-[#ef4444]">×</span> 패널로 개별 조각을 삭제할 수 있습니다.</span>
                  </li>
                </>
              )}
              {selectedMode === 'free' && (
                <>
                  <li className="flex gap-2">
                    <span className="text-[#3b82f6] font-bold flex-none">1.</span>
                    <span>이미지 자르기 작업판 위를 연필로 스케치하듯 연속으로 드래그해 선을 그려넣으세요.</span>
                  </li>
                  {freeMode === 'region' ? (
                    <li className="flex gap-2">
                      <span className="text-[#3b82f6] font-bold flex-none">2.</span>
                      <span>손가락을 떼며 드로잉을 멈추면, 시작점과 종점이 즉시 연결되어 다각형 바운더리를 땝니다.</span>
                    </li>
                  ) : (
                    <li className="flex gap-2">
                      <span className="text-[#3b82f6] font-bold flex-none">2.</span>
                      <span>반드시 이미지 왼쪽/오른쪽/위/아래 <span className="font-bold text-[#1e40af]">가장자리 끝자락에서 시작해 맞은편 가장자리 끝자락으로</span> 일관되게 그어주어야 참값으로 분석됩니다.</span>
                    </li>
                  )}
                </>
              )}
            </ul>
          </div>
        </div>

        {/* RIGHT COLUMN: REVELATION CANVAS & MAIN ACTION PORTAL */}
        <div className="lg:col-span-8 flex flex-col gap-6">

          {/* 1) ACTIVE CANVAS WORKSPACE CONTAINER */}
          <div className="bg-white border border-[#e2e8f0] rounded-xl shadow-[0_20px_40px_-10px_rgba(0,0,0,0.05)] p-6 text-center flex flex-col items-center justify-center min-h-[500px]">
            {!imageSrc ? (
              // Enhanced premium empty state
              <div className="max-w-md py-12 flex flex-col items-center">
                <div className="w-14 h-14 bg-[#eff6ff] rounded-full flex items-center justify-center mb-5 text-[#3b82f6] border border-[#dbeafe]">
                  <ImageIcon className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-[#0f172a] text-lg tracking-tight mb-2">
                  편집할 이미지를 대기 중입니다
                </h4>
                <p className="text-[#64748b] text-xs md:text-sm leading-relaxed mb-6 max-w-sm font-medium">
                  안심하세요! 모든 자르기 및 압축 처리가 서버를 일절 거치지 않고 사용자 디바이스 내부에서 순수하게 오프라인 상태로만 연산되어, 개인정보 유출 위험이 원천 차단됩니다.
                </p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-[#0f172a] hover:bg-slate-800 transition text-white font-semibold text-xs py-2.5 px-5 rounded-lg flex items-center gap-1.5 shadow-sm hover:shadow-md"
                >
                  참조 이미지 선택하기
                </button>
              </div>
            ) : (
              // Active Interactive Sandbox Canvas Layout
              <div
                ref={workspaceRef}
                className="relative select-none touch-none rounded-lg overflow-hidden shadow-sm border border-slate-200"
                style={{
                  background: 'repeating-conic-gradient(#f8f9fa 0% 25%, #ffffff 0% 50%) 50% / 16px 16px',
                  maxWidth: '100%'
                }}
              >
                {/* 1. Underlying Base Image */}
                <img
                  ref={imageElementRef}
                  src={imageSrc}
                  alt="Work Sandbox"
                  onLoad={handleImageLoad}
                  className="block select-none pointer-events-none"
                  style={{
                    maxHeight: '65vh',
                    maxWidth: '100%',
                    WebkitUserDrag: 'none'
                  }}
                />

                {/* 2. GRID OVERLAY LAYER */}
                {selectedMode === 'grid' && (
                  <>
                    {/* Horizontal Guides */}
                    {hGuides.map((ratio, idx) => (
                      <div
                        key={`h-guide-${idx}`}
                        className="absolute left-0 right-0 h-1 cursor-row-resize z-30 group"
                        style={{
                          top: `${ratio * 100}%`,
                          marginTop: '-2px'
                        }}
                        onPointerDown={(e) => handleGuideDrag(e, 'h', idx)}
                      >
                        {/* Beautiful guide dashed visual bar resembling neon magenta */}
                        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-[2px] bg-[#3b82f6] group-hover:bg-[#2563eb] group-hover:h-[3px] shadow-sm transition-all" />
                        
                        {/* Floating Drag Handles */}
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteGuide('h', idx);
                            }}
                            className="shape-delete-btn w-5 h-5 rounded-full bg-rose-500 hover:bg-rose-600 border border-white text-white flex items-center justify-center text-[10px] font-bold shadow-sm transition transform group-hover:scale-105 active:scale-95"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Vertical Guides */}
                    {vGuides.map((ratio, idx) => (
                      <div
                        key={`v-guide-${idx}`}
                        className="absolute top-0 bottom-0 w-1 cursor-col-resize z-30 group"
                        style={{
                          left: `${ratio * 100}%`,
                          marginLeft: '-2px'
                        }}
                        onPointerDown={(e) => handleGuideDrag(e, 'v', idx)}
                      >
                        {/* Vertical guide line style matches clock hands */}
                        <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px] bg-[#3b82f6] group-hover:bg-[#2563eb] group-hover:w-[3px] shadow-sm transition-all" />
                        
                        {/* Delete circular badge */}
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center justify-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteGuide('v', idx);
                            }}
                            className="shape-delete-btn w-5 h-5 rounded-full bg-rose-500 hover:bg-rose-600 border border-white text-white flex items-center justify-center text-[10px] font-bold shadow-sm transition transform group-hover:scale-105 active:scale-95"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* 3. SHAPE BUILDER LAYER */}
                {selectedMode === 'shape' &&
                  shapes.map((s) => {
                    const isSelected = selectedShapeId === s.id;
                    return (
                      <div
                        key={s.id}
                        onPointerDown={(e) => handleShapeDragStart(e, s.id)}
                        className={`absolute box-border select-none z-20 ${
                          s.type === 'heart'
                            ? (isSelected
                                ? 'border border-dashed border-[#3b82f6]/30 shadow-sm cursor-move'
                                : 'border border-transparent hover:border-dashed hover:border-slate-300/50 cursor-pointer')
                            : (isSelected
                                ? 'border-2 border-[#3b82f6] bg-[#3b82f6]/5 shadow-md cursor-move'
                                : 'border-2 border-slate-300/85 bg-slate-400/5 hover:border-[#3b82f6]/80 cursor-pointer')
                        }`}
                        style={{
                          left: `${s.left * 100}%`,
                          top: `${s.top * 100}%`,
                          width: `${s.width * 100}%`,
                          height: `${s.height * 100}%`,
                          borderRadius:
                            s.type === 'circle' || s.type === 'ellipse' ? '50%' : '0'
                        }}
                      >
                        {/* If it's a Heart, draw custom clip preview */}
                        {s.type === 'heart' && (
                          <div className="absolute inset-0">
                            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                              <path
                                d="M 50 92 C 50 92 5 55 5 30 C 5 10 20 0 35 0 C 45 0 50 7 50 7 C 50 7 55 0 65 0 C 80 0 95 10 95 30 C 95 55 50 92 50 92 Z"
                                className={`${
                                  isSelected 
                                    ? 'fill-rose-500/20 stroke-[#3b82f6] stroke-[3]' 
                                    : 'fill-rose-500/10 stroke-rose-400/80 stroke-[2]'
                                } transition-all duration-150`}
                                strokeLinejoin="round"
                              />
                            </svg>
                          </div>
                        )}

                        {/* Shape Tag Label */}
                        <span
                          className={`absolute top-1.5 left-2 px-1.5 py-0.5 rounded-sm text-[8px] font-bold text-white selection:bg-slate-300 pointer-events-none uppercase shadow-sm ${
                            isSelected ? 'bg-[#3b82f6]' : 'bg-slate-500'
                          }`}
                        >
                          {SHAPE_LABELS[s.type].split(' ')[0]}
                        </span>

                        {/* Drag Move Handle Indicator */}
                        {isSelected && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-[#3b82f6]/40">
                            <Move className="w-5 h-5 animate-pulse" />
                          </div>
                        )}

                        {/* Delete Shape Button */}
                        {isSelected && (
                          <button
                            onPointerDown={(e) => deleteShapeInstance(s.id, e)}
                            className="shape-delete-btn absolute -top-2.5 -right-2.5 w-5.5 h-5.5 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center text-xs font-bold border border-white shadow-sm active:scale-90"
                          >
                            ×
                          </button>
                        )}

                        {/* Edge Resizers */}
                        {isSelected && (
                          <>
                            <div
                              className="shape-handle absolute w-3 h-3 bg-[#3b82f6] border border-white rounded-full z-30 -top-1.5 -left-1.5 cursor-nwse-resize shadow"
                              onPointerDown={(e) => handleShapeResizeStart(e, s.id, 'nw')}
                            />
                            <div
                              className="shape-handle absolute w-3 h-3 bg-[#3b82f6] border border-white rounded-full z-30 -top-1.5 -right-1.5 cursor-nesw-resize shadow"
                              onPointerDown={(e) => handleShapeResizeStart(e, s.id, 'ne')}
                            />
                            <div
                              className="shape-handle absolute w-3 h-3 bg-[#3b82f6] border border-white rounded-full z-30 -bottom-1.5 -left-1.5 cursor-nesw-resize shadow"
                              onPointerDown={(e) => handleShapeResizeStart(e, s.id, 'sw')}
                            />
                            <div
                              className="shape-handle absolute w-3 h-3 bg-[#3b82f6] border border-white rounded-full z-30 -bottom-1.5 -right-1.5 cursor-nwse-resize shadow"
                              onPointerDown={(e) => handleShapeResizeStart(e, s.id, 'se')}
                            />
                          </>
                        )}
                      </div>
                    );
                  })}

                {/* 4. FREEFORM DRAWING CANVAS LAYER */}
                {selectedMode === 'free' && (
                  <svg
                    onPointerDown={handleFreePointerDown}
                    onPointerMove={handleFreePointerMove}
                    onPointerUp={handleFreePointerUp}
                    onPointerLeave={handleFreePointerUp}
                    className="absolute inset-0 w-full h-full z-20 cursor-crosshair"
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                  >
                    {/* Path stroke line */}
                    {freePoints.length > 0 && (
                      <path
                        d={getFreeSvgPath(true)}
                        fill={freeMode === 'region' ? 'rgba(59, 130, 246, 0.1)' : 'none'}
                        stroke={freeMode === 'divider' ? '#ef4444' : '#3b82f6'}
                        strokeWidth={freeMode === 'divider' ? 1.5 : 1}
                        strokeDasharray={freeMode === 'region' ? '2 1.5' : 'none'}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    )}

                    {/* Simple indicator node on endpoints */}
                    {freePoints.length > 0 && (
                      <>
                        <circle
                          cx={freePoints[0].x * 100}
                          cy={freePoints[0].y * 100}
                          r="1"
                          fill={isPtOnEdge(freePoints[0]) ? '#10b981' : '#3b82f6'}
                          stroke="white"
                          strokeWidth="0.3"
                        />
                        {freePoints.length > 1 && (
                          <circle
                            cx={freePoints[freePoints.length - 1].x * 100}
                            cy={freePoints[freePoints.length - 1].y * 100}
                            r="1"
                            fill={
                              freeMode === 'divider'
                                ? isPtOnEdge(freePoints[freePoints.length - 1])
                                  ? '#10b981'
                                  : '#ef4444'
                                : '#3b82f6'
                            }
                            stroke="white"
                            strokeWidth="0.3"
                          />
                        )}
                      </>
                    )}
                  </svg>
                )}

              </div>
            )}
          </div>

          {/* 2) MAIN DOWN ACTION CARD - Inspired by the sleek dashboard status panel */}
          <div className="bg-white border border-[#e2e8f0] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.05)] text-[#0f172a] p-6 md:p-8 rounded-xl z-10 w-full flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="text-left flex-1">
              
              {/* Badge representing current stats */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#eff6ff] text-[#1e40af] border border-[#dbeafe] rounded-full text-[10px] uppercase font-bold tracking-widest mb-3.5 shadow-sm">
                <CheckCircle className="w-3.5 h-3.5 text-[#3b82f6]" />
                <span>스튜디오 분할 요약</span>
              </div>

              {/* Status Header text */}
              <div className="text-3xl md:text-3xl font-bold tracking-tight text-[#0f172a] mb-2 font-sans flex items-baseline gap-2">
                {selectedMode === 'grid' && (
                  <span>
                    {(hGuides.length + 1) * (vGuides.length + 1)} <span className="text-sm font-semibold text-[#64748b]">개 가공 조각 대기 중</span>
                  </span>
                )}
                {selectedMode === 'shape' && (
                  <span>
                    {shapes.length} <span className="text-sm font-semibold text-[#64748b]">개 도형 프레임 보관 중</span>
                  </span>
                )}
                {selectedMode === 'free' && (
                  <span>
                    {freePoints.length > 0 ? '1' : '0'}{' '}
                    <span className="text-sm font-semibold text-[#64748b]">개 패스 설계 완료</span>
                  </span>
                )}
              </div>

              {/* Custom micro status description */}
              <p className="text-[#475569] text-xs font-semibold leading-normal max-w-md">
                {selectedMode === 'grid' &&
                  `현재 가로 행수 ${hGuides.length + 1}개 × 세로 열수 ${vGuides.length + 1}개 레이아웃`}
                {selectedMode === 'shape' &&
                  (shapes.length > 0
                    ? '배치된 도형 프레임 구조만큼 개별 영역이 투명 PNG로 분할 마스킹 가공됩니다.'
                    : '작업대 추가 단추를 이용하여 원형, 혹은 하트 프레임을 그려 올리세요.')}
                {selectedMode === 'free' &&
                  (freeMode === 'region'
                    ? '가공한 다각형 점선 바운더리 영역 안쪽 비주얼만 고밀도 투명 PNG로 따냅니다.'
                    : isDividerValid()
                    ? '성공! 가장자리 끝자락에 두 안착점이 잘 정렬되어 정상 분할 추진이 가능합니다.'
                    : '에러: 분할선의 시작점/끝점을 작업용 모니터의 전체 가장자리 끝부분까지 닿게 이어주세요.')}
              </p>

              {/* Gradient style progress bar resembles PNG tracker indicators */}
              <div className="w-full max-w-sm h-1.5 bg-[#f1f5f9] border border-[#e2e8f0]/60 rounded-full overflow-hidden mt-4">
                <div
                  className="h-full bg-gradient-to-r from-[#3b82f6] to-[#6366f1] transition-all duration-300"
                  style={{
                    width:
                      selectedMode === 'grid'
                        ? `${Math.min(100, ((hGuides.length + vGuides.length) / 10) * 100)}%`
                        : selectedMode === 'shape'
                        ? `${Math.min(100, (shapes.length / 5) * 100)}%`
                        : freePoints.length > 0
                        ? '100%'
                        : '0%'
                  }}
                />
              </div>
            </div>

            {/* Ultimate Action Buttons styled in clean dark button */}
            <div className="flex-none flex flex-col justify-center sm:items-end gap-2.5">
              
              {/* Main Download compiled element trigger */}
              {selectedMode === 'grid' && (
                <button
                  onClick={handleDownloadGrid}
                  disabled={!imageSrc || isProcessing}
                  className="w-full sm:w-auto bg-[#0f172a] hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed justify-center transition-all text-white font-semibold text-xs py-3 px-6 rounded-lg flex items-center gap-2 shadow-sm hover:shadow-md active:scale-95"
                >
                  <Download className="w-4 h-4 text-white" />
                  <span>
                    {isProcessing ? '압축 조율 중...' : '격자 잘라서 ZIP 다운로드'}
                  </span>
                </button>
              )}

              {selectedMode === 'shape' && (
                <button
                  onClick={handleDownloadShapes}
                  disabled={!imageSrc || shapes.length === 0 || isProcessing}
                  className="w-full sm:w-auto bg-[#0f172a] hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed justify-center transition-all text-white font-semibold text-xs py-3 px-6 rounded-lg flex items-center gap-2 shadow-sm hover:shadow-md active:scale-95"
                >
                  <Download className="w-4 h-4 text-white" />
                  <span>
                    {isProcessing
                      ? '도형 연산 중...'
                      : shapes.length === 1
                      ? '도형 자르기 다운로드 (PNG)'
                      : '도형 잘라서 ZIP 다운로드'}
                  </span>
                </button>
              )}

              {selectedMode === 'free' && (
                <button
                  onClick={
                    freeMode === 'region'
                      ? handleDownloadFreeRegion
                      : handleDownloadFreeDivider
                  }
                  disabled={
                    !imageSrc ||
                    isProcessing ||
                    (freeMode === 'region' && freePoints.length < 3) ||
                    (freeMode === 'divider' && !isDividerValid())
                  }
                  className="w-full sm:w-auto bg-[#0f172a] hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed justify-center transition-all text-white font-semibold text-xs py-3 px-6 rounded-lg flex items-center gap-2 shadow-sm hover:shadow-md active:scale-95"
                >
                  <Download className="w-4 h-4 text-white" />
                  <span>
                    {isProcessing
                      ? '연필선 가공 중...'
                      : freeMode === 'region'
                      ? '자유 영역 다운로드 (PNG)'
                      : '분할선 잘라 ZIP 다운로드'}
                  </span>
                </button>
              )}

              {/* Mini subtle footer credit under tracker */}
              <div className="hidden sm:block text-[9px] text-[#64748b] uppercase tracking-widest text-right mt-1 w-full font-bold">
                EVERY PROCESS RUNS LOCAL · PRIVACY FIRST
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* FOOTER INFORMATIONAL COMPASSIONATE DISCLAIMERS */}
      <footer className="mt-16 text-center select-none max-w-sm flex flex-col gap-2">
        <div className="flex items-center justify-center gap-1.5 text-[#475569] font-bold text-[11px] uppercase tracking-widest">
          <Lock className="w-3.5 h-3.5 text-[#3b82f6]" />
          <span>브라우저 단독 보안 처리 보장</span>
        </div>
        <p className="text-[10px] text-[#64748b] leading-relaxed font-semibold">
          이 공간 안에서 업로드하고 작업하시는 이미지 원본 파일 및 결과 파일은 외부 클라우드나 개인 서버로 절대 송신되지 않고 오직 회원님의 컴퓨터 캐시 영역 위에서만 분석 소멸하므로 대외 비보정 문서 등의 가공에도 완전히 기밀이 보장됩니다.
        </p>
      </footer>
    </div>
  );
}
