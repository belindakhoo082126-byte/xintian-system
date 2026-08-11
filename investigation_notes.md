# V2.1.27 Investigation Notes - 9 Product/Mall Issues

## Issue 1: Bundle cover image upload button
- **File**: ProductBundles.tsx lines 603-607 (create), 837-838 (edit)
- **Current**: Only URL input field, no upload button
- **Fix**: Add upload button like ProductsV2.tsx (uses /api/upload endpoint)
- **Pattern**: FileReader -> base64 -> POST /api/upload -> get URL back

## Issue 2: Purchase order number custom input
- **File**: PurchaseOrders.tsx, db.ts line 2535
- **Current**: poNumber auto-generated as `PO${Date.now()}${random}`
- **Fix**: Add poNumber input field in create dialog, pass to createPurchaseOrder

## Issue 3: Purchase order actions (view/edit)
- **File**: PurchaseOrders.tsx lines 211-225
- **Current**: Only "确认收货" button for ordered status, no view/edit
- **Fix**: Add view detail dialog and edit functionality

## Issue 4: New products not showing in mall
- **Root cause**: syncToMall defaults to false in schema (line 153)
- **ProductsV2.tsx**: No syncToMall toggle in the form UI
- **getMallProducts**: Filters by `syncToMall: true` (line 4829)
- **Fix**: Add syncToMall toggle in ProductsV2 form (Display & Recommendation step)

## Issue 5: Mall not showing product photos
- **MallHome.tsx line 202**: Uses `p.coverImageUrl` - products may not have coverImageUrl set
- **getMallProducts**: Returns all product fields including coverImageUrl via `db.select().from(products)`
- **Fix**: Products need coverImageUrl populated. Also check if productImages are used

## Issue 6: Mall categories not clickable
- **MallHome.tsx lines 91-104**: Categories use `<Link href={/mall?categoryId=${c.id}}>` - should work
- **Need to verify**: Maybe categories table is empty or links not working properly

## Issue 7: Mall design too simple
- **MallHome.tsx**: Basic grid layout, minimal styling
- **Fix**: Enhance with better card design, hero section, animations, etc.

## Issue 8: Theme switch not working
- **MallHome.tsx**: No theme application code at all! Uses hardcoded colors (#2d6a4f, etc.)
- **MallSettings.tsx**: Has THEMES array with color definitions, saves activeTheme to DB
- **Fix**: Apply theme colors dynamically in MallHome.tsx based on settings.activeTheme

## Issue 9: Mall logo wrong
- **MallHome.tsx line 57-61**: Uses `settings?.logoUrl` from mall settings
- **VITE_APP_LOGO**: Points to user's logo at https://files.manuscdn.com/user_upload_by_module/web_dev_logo/...
- **Fix**: Default logoUrl to VITE_APP_LOGO if not set, or set it in mall settings

## Key Files:
- /home/ubuntu/xintian_system/client/src/pages/ProductBundles.tsx (1032 lines)
- /home/ubuntu/xintian_system/client/src/pages/PurchaseOrders.tsx (~400 lines)
- /home/ubuntu/xintian_system/client/src/pages/ProductsV2.tsx (large file)
- /home/ubuntu/xintian_system/client/src/pages/mall/MallHome.tsx (~310 lines)
- /home/ubuntu/xintian_system/client/src/pages/MallSettings.tsx
- /home/ubuntu/xintian_system/server/db.ts
- /home/ubuntu/xintian_system/server/routers.ts
- /home/ubuntu/xintian_system/drizzle/schema.ts

## Upload API Pattern (from ProductsV2.tsx):
```javascript
const reader = new FileReader();
reader.onload = async (ev) => {
  const base64 = ev.target?.result as string;
  const res = await fetch("/api/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ file: base64, filename: file.name }),
  });
  if (res.ok) {
    const data = await res.json();
    // data.url contains the uploaded image URL
  }
};
reader.readAsDataURL(file);
```

## Theme System (from MallSettings.tsx):
THEMES array with keys: xintian_nature, lavender_purple, sakura_pink, nature_green, warm_brown, christmas, cny, hari_raya, merdeka, mid_autumn, valentine, custom
Each has: { primary, secondary, button, background, font } colors

## Product Form (ProductsV2.tsx):
- ProductForm interface does NOT include syncToMall
- EMPTY_FORM does NOT include syncToMall
- Need to add syncToMall to form interface, default value, and UI toggle
