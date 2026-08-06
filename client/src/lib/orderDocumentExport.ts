export const ORDER_DOCUMENT_EXPORT_HOST_STYLE = {
  position: "fixed",
  top: "0",
  left: "-10000px",
  zIndex: "2147483647",
  opacity: "1",
  visibility: "visible",
  pointerEvents: "none",
  isolation: "isolate",
} as const;

export function prepareOrderDocumentExportHost(container: HTMLDivElement) {
  Object.assign(container.style, ORDER_DOCUMENT_EXPORT_HOST_STYLE);
  container.setAttribute("aria-hidden", "true");
}
