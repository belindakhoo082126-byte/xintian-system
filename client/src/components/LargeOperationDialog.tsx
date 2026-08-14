import type * as React from "react";

import { DialogContent, DialogFooter, DialogHeader } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * 用于多步骤、表格或大量字段的后台操作。
 * 外层负责尺寸与防横向溢出；调用端仅需将内容放入 LargeOperationDialogBody。
 */
export function LargeOperationDialogContent({
  className,
  ...props
}: React.ComponentProps<typeof DialogContent>) {
  return (
    <DialogContent
      className={cn(
        "h-[90vh] max-h-[90vh] w-[90vw] max-w-[1400px] min-w-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-[1400px] max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-screen max-sm:max-w-none max-sm:rounded-none",
        className,
      )}
      {...props}
    />
  );
}

export function LargeOperationDialogHeader({
  className,
  ...props
}: React.ComponentProps<typeof DialogHeader>) {
  return (
    <DialogHeader
      className={cn("shrink-0 border-b px-6 py-5 pr-14 sm:px-8 max-sm:px-5", className)}
      {...props}
    />
  );
}

export function LargeOperationDialogBody({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("min-h-0 min-w-0 overflow-y-auto overflow-x-hidden px-6 py-5 sm:px-8 max-sm:px-5", className)}
      {...props}
    />
  );
}

export function LargeOperationDialogFooter({
  className,
  ...props
}: React.ComponentProps<typeof DialogFooter>) {
  return (
    <DialogFooter
      className={cn("shrink-0 border-t bg-background px-6 py-4 sm:px-8 max-sm:px-5", className)}
      {...props}
    />
  );
}
