import { useState } from "react";
import { Eye, ImageOff } from "lucide-react";
import { ImageZoomDialog } from "@/components/ImageZoomDialog";
import { cn } from "@/lib/utils";

type ProductImagePreviewProps = {
  src?: string | null;
  alt: string;
  className?: string;
  imageClassName?: string;
  label?: string;
};

/** A compact thumbnail that opens the original product image in an accessible dialog. */
export function ProductImagePreview({
  src,
  alt,
  className,
  imageClassName,
  label = "预览商品图片",
}: ProductImagePreviewProps) {
  const [open, setOpen] = useState(false);

  if (!src) {
    return (
      <div
        aria-label="暂无商品图片"
        className={cn("flex shrink-0 items-center justify-center rounded-md border border-dashed bg-muted/40 text-muted-foreground", className)}
      >
        <ImageOff className="h-4 w-4" aria-hidden="true" />
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen(true);
        }}
        className={cn(
          "group relative block shrink-0 overflow-hidden rounded-md border bg-muted text-left outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className,
        )}
        aria-label={`${label}：${alt}`}
        title={label}
      >
        <img src={src} alt={alt} className={cn("h-full w-full object-cover", imageClassName)} />
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100 group-focus-visible:bg-black/45 group-focus-visible:opacity-100">
          <Eye className="h-4 w-4" aria-hidden="true" />
        </span>
      </button>

      <ImageZoomDialog open={open} onOpenChange={setOpen} src={src} alt={alt} />
    </>
  );
}
