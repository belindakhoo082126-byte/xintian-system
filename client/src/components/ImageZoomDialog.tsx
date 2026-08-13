import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import { Minus, Move, Plus, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

type ImageZoomDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src?: string | null;
  alt: string;
  title?: string;
};

type Offset = { x: number; y: number };

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(value * 100) / 100));
}

/**
 * A shared image lightbox that preserves the original preview flow while adding
 * zoom controls, mouse/touch drag panning and a safe reset action.
 */
export function ImageZoomDialog({ open, onOpenChange, src, alt, title = alt }: ImageZoomDialogProps) {
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStart = useRef<{ pointerId: number; x: number; y: number; offset: Offset } | null>(null);

  const resetView = () => {
    dragStart.current = null;
    setIsDragging(false);
    setZoom(MIN_ZOOM);
    setOffset({ x: 0, y: 0 });
  };

  useEffect(() => {
    if (open) resetView();
  }, [open, src]);

  const updateZoom = (nextZoom: number) => {
    const normalized = clampZoom(nextZoom);
    setZoom(normalized);
    if (normalized === MIN_ZOOM) setOffset({ x: 0, y: 0 });
  };

  const handleWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    updateZoom(zoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP));
  };

  const handlePointerDown = (event: PointerEvent<HTMLImageElement>) => {
    if (zoom <= MIN_ZOOM) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStart.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      offset,
    };
    setIsDragging(true);
  };

  const handlePointerMove = (event: PointerEvent<HTMLImageElement>) => {
    const start = dragStart.current;
    if (!start || start.pointerId !== event.pointerId) return;
    setOffset({
      x: start.offset.x + event.clientX - start.x,
      y: start.offset.y + event.clientY - start.y,
    });
  };

  const finishPointerDrag = (event: PointerEvent<HTMLImageElement>) => {
    if (dragStart.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragStart.current = null;
    setIsDragging(false);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) resetView();
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-hidden p-0 sm:rounded-xl">
        <DialogHeader className="border-b px-5 py-4 pr-12">
          <DialogTitle className="truncate text-base">{title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-background px-4 py-2.5">
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Move className="h-3.5 w-3.5" aria-hidden="true" />
            滚轮可缩放，放大后可拖动查看
          </p>
          <div className="flex items-center gap-1" aria-label="图片缩放控制">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => updateZoom(zoom - ZOOM_STEP)}
              disabled={zoom <= MIN_ZOOM}
              aria-label="缩小图片"
              title="缩小"
            >
              <Minus className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            <span className="min-w-12 text-center text-xs font-medium tabular-nums" aria-live="polite">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => updateZoom(zoom + ZOOM_STEP)}
              disabled={zoom >= MAX_ZOOM}
              aria-label="放大图片"
              title="放大"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-1 h-8 gap-1 px-2 text-xs"
              onClick={resetView}
              aria-label="重置图片缩放与位置"
              title="重置图片位置与缩放"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              重置
            </Button>
          </div>
        </div>

        <div
          className="flex min-h-[18rem] max-h-[68vh] items-center justify-center overflow-hidden bg-muted/35 p-4"
          onWheel={handleWheel}
        >
          {src ? (
            <img
              src={src}
              alt={alt}
              draggable={false}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishPointerDrag}
              onPointerCancel={finishPointerDrag}
              className={`max-h-[60vh] max-w-full select-none rounded-lg object-contain shadow-sm transition-transform duration-200 ${
                zoom > MIN_ZOOM ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-zoom-in"
              }`}
              style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})` }}
            />
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export const IMAGE_ZOOM_LIMITS = { min: MIN_ZOOM, max: MAX_ZOOM, step: ZOOM_STEP };
