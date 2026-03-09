---
argument-hint: [css-variables]
description: Convert :root/.dark CSS variables to light-dark() format for app.css
---

# Convert Tweakcn Theme to app.css

Take CSS from https://tweakcn.com/ and surgically replace the color variables in `app/app.css`.

## First: Check Input

Look at `$ARGUMENTS` below. If empty or doesn't contain CSS variables (`:root` and `.dark` blocks), ask:

"Paste your CSS from tweakcn.com (the `:root { ... }` and `.dark { ... }` blocks)"

Do NOT proceed until you have valid CSS input.

## What To Do

1. Read `app/app.css`
2. Parse the tweakcn `:root` block (light values)
3. Parse the tweakcn `.dark` block (dark values)
4. For each color variable:
   - Different values → `light-dark(lightVal, darkVal)`
   - Same value → just the value
5. Update `app/app.css`:
   - If variable already uses `light-dark()` → replace the whole value
   - If variable is plain (old format) → replace with `light-dark()` version
   - If there's a separate `.dark { }` block with variable overrides → **DELETE IT** (those values are now in `light-dark()`)
6. Run `bun run typecheck`

**Important:** The old tweakcn format has separate `:root` and `.dark` blocks. We're converting TO the unified `light-dark()` format. After conversion, there should be NO `.dark` block with color variable overrides - only the force-mode utility rule.

## Examples

### If app.css already has light-dark() format:

**Find:**
```css
--background: light-dark(oklch(0.98 0.01 95), oklch(0.27 0.004 107));
```
**Replace with:**
```css
--background: light-dark(oklch(1 0 0), oklch(0.2 0 0));
```

### If app.css has OLD format (separate blocks):

**Before:**
```css
:root {
  --background: oklch(0.98 0.01 95);
}
.dark {
  --background: oklch(0.27 0.004 107);
}
```

**After:**
```css
:root {
  --background: light-dark(oklch(1 0 0), oklch(0.2 0 0));
}
/* .dark block with variable overrides is DELETED */
```

The `.dark` variable override block gets removed - those values are now inside `light-dark()`.

## Required Infrastructure

These MUST exist in `app/app.css` for `light-dark()` to work:

```css
/* Dark variant: applies when .dark class OR system prefers dark (unless .light forced) */
@custom-variant dark {
  &:where(.dark, .dark *);
  @media (prefers-color-scheme: dark) {
    &:where(:not(.light, .light *))
  }
}
```

```css
/* Force light mode */
:root.light,
.light {
  color-scheme: light only;
}

/* Force dark mode */
:root.dark,
.dark {
  color-scheme: dark only;
}
```

If missing, add them.

---

$ARGUMENTS
