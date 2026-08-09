# XTC Export Image Root Cause Analysis

## Root Cause Found
XTC orders have products with `coverImageUrl` pointing to `https://images.unsplash.com/...` (external URLs).
When html2canvas tries to render these images, it hits CORS issues because unsplash.com doesn't allow cross-origin canvas access.
The `useCORS: true` and `allowTaint: true` options in html2canvas don't help because unsplash doesn't send the `Access-Control-Allow-Origin` header.

For XT (local) orders, product images use `/manus-storage/...` paths which are same-origin, so html2canvas works fine.

## Evidence
- XTC00001: Product "SUC 多肉拼盘" (id=150023) has coverImageUrl = `https://images.unsplash.com/photo-1459411552884-841db9b3b0f0?auto=format&fit=crop&w=800&q=80`
- XTC00002: Products with unsplash URLs
- XTC00003: Product "PHI 粉红佳人" (id=3) has coverImageUrl = `https://images.unsplash.com/photo-1611211232933-da89f258b7f1?auto=format&fit=crop&w=800&q=80`
- XT orders: Products use `/manus-storage/uploads/...` paths (same-origin, no CORS issues)

## Fix Plan
1. In handleExportImage (OrderBrowsePage.tsx), pre-convert ALL product images to base64 dataURLs before rendering with html2canvas (similar to how the logo is already pre-converted)
2. Pass the pre-converted images to OrderDocument via a new prop or by modifying order.items in place
3. Add error handling: if image conversion fails, use placeholder
4. This ensures all images are same-origin dataURLs and html2canvas won't have CORS issues

## Files to Modify
- `/home/ubuntu/xintian_system/client/src/pages/OrderBrowsePage.tsx` - handleExportImage function (pre-convert product images)
- `/home/ubuntu/xintian_system/client/src/pages/OrderBrowsePage.tsx` - handlePrint function (same fix for print)
