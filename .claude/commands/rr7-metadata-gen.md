# AI Agent Guide: React Router 7 + React 19 Metadata Implementation & Audit

**Purpose:** Reference for AI agents implementing and auditing SEO metadata in React Router 7 projects using React 19.

---

## 🤖 Claude Code Slash Command Instructions

**This guide covers TWO use cases:**

### Use Case 1: Implement Metadata for Routes

**When user wants to add/update metadata on routes:**

1. **Identify target routes** - Ask which routes need metadata
2. **Choose approach** - React 19 inline (recommended) or `meta` export
3. **Gather requirements:**
   - Static vs dynamic metadata?
   - Need loader data for titles?
   - Open Graph / Twitter cards needed?
4. **Present plan** with code examples
5. **Implement** after approval
6. **Run typecheck** and report results

### Use Case 2: Audit Existing Metadata

**When user wants to audit metadata across routes:**

1. **Scan all route files** - Find `routes/` directory
2. **Check each route for:**
   - Missing `<title>` or `meta` export
   - Missing description
   - Missing Open Graph tags
   - Missing canonical URL
   - Duplicate titles across routes
3. **Generate report** with findings and recommendations
4. **Offer to fix** issues found

---

## Two Approaches to Metadata

### Approach 1: React 19 Inline (RECOMMENDED)

React 19 hoists `<title>`, `<meta>`, and `<link>` tags to `<head>` automatically.

```tsx
// app/routes/products.$id.tsx
import type { Route } from "./+types/products.$id";

export async function loader({ params }: Route.LoaderArgs) {
  const product = await getProduct(params.id);
  return { product };
}

export default function ProductPage({ loaderData }: Route.ComponentProps) {
  const { product } = loaderData;

  return (
    <>
      {/* React 19 hoists these to <head> */}
      <title>{product.name} | My Store</title>
      <meta name="description" content={product.description} />
      <meta property="og:title" content={product.name} />
      <meta property="og:description" content={product.description} />
      <meta property="og:image" content={product.imageUrl} />
      <meta property="og:type" content="product" />
      <meta name="twitter:card" content="summary_large_image" />
      <link rel="canonical" href={`https://mystore.com/products/${product.id}`} />

      {/* Page content */}
      <div>
        <h1>{product.name}</h1>
        {/* ... */}
      </div>
    </>
  );
}
```

**Pros:**

- Simpler, no extra API to learn
- Co-located with component logic
- Dynamic data readily available
- Works with React Suspense/Streaming

**Cons:**

- Metadata renders with component (not before)
- Less suitable for error boundaries

---

### Approach 2: `meta` Export Function

Traditional React Router approach. Still fully supported.

```tsx
// app/routes/products.$id.tsx
import type { Route } from "./+types/products.$id";

export function meta({ data, params, location }: Route.MetaArgs) {
  if (!data?.product) {
    return [{ title: "Product Not Found" }, { name: "robots", content: "noindex" }];
  }

  const { product } = data;

  return [
    { title: `${product.name} | My Store` },
    { name: "description", content: product.description },
    { property: "og:title", content: product.name },
    { property: "og:description", content: product.description },
    { property: "og:image", content: product.imageUrl },
    { property: "og:type", content: "product" },
    { name: "twitter:card", content: "summary_large_image" },
    { tagName: "link", rel: "canonical", href: `https://mystore.com/products/${product.id}` },
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  const product = await getProduct(params.id);
  return { product };
}

export default function ProductPage({ loaderData }: Route.ComponentProps) {
  // Component doesn't need to render meta tags
  return <div>...</div>;
}
```

**Pros:**

- Metadata available before component renders
- Better for SSR/SEO crawlers
- Can access parent route data via `matches`
- Works well with error boundaries

**Cons:**

- Separate API to learn
- Data must come from loader (can't use component state)

---

## Root Layout Setup

**CRITICAL:** The root layout MUST include `<Meta />` for the `meta` export approach:

```tsx
// app/root.tsx
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";

export default function Root() {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta /> {/* Renders meta tags from route meta exports */}
        <Links /> {/* Renders link tags from route links exports */}
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
```

---

## MetaDescriptor Types

The `meta` function returns an array of `MetaDescriptor` objects:

```tsx
// Title tag
{ title: "Page Title" }

// Meta tags with name attribute
{ name: "description", content: "Page description" }
{ name: "robots", content: "noindex, nofollow" }
{ name: "author", content: "Author Name" }
{ name: "keywords", content: "keyword1, keyword2" }

// Meta tags with property attribute (Open Graph)
{ property: "og:title", content: "Title" }
{ property: "og:description", content: "Description" }
{ property: "og:image", content: "https://example.com/image.jpg" }
{ property: "og:url", content: "https://example.com/page" }
{ property: "og:type", content: "website" }
{ property: "og:site_name", content: "Site Name" }

// Twitter cards
{ name: "twitter:card", content: "summary_large_image" }
{ name: "twitter:site", content: "@handle" }
{ name: "twitter:creator", content: "@handle" }

// Other link tags
{ tagName: "link", rel: "canonical", href: "https://example.com/page" }
{ tagName: "link", rel: "alternate", hreflang: "fr", href: "https://example.com/fr/page" }

// HTTP equiv
{ httpEquiv: "refresh", content: "3;url=https://example.com" }

// Charset (usually set in root)
{ charSet: "utf-8" }
```

---

## Accessing Loader Data in Meta

### Current Route Data

```tsx
export function meta({ data }: Route.MetaArgs) {
  // data is typed based on your loader's return type
  return [{ title: data?.title ?? "Default Title" }];
}
```

### Parent Route Data via `matches`

```tsx
export function meta({ data, matches }: Route.MetaArgs) {
  // Find parent route data
  const rootMatch = matches.find((m) => m.id === "root");
  const siteName = rootMatch?.data?.siteName ?? "My Site";

  return [{ title: `${data.pageTitle} | ${siteName}` }];
}
```

### Type-Safe Parent Data

```tsx
import type { Route } from "./+types/products.$id";
import type { loader as rootLoader } from "../root";

export function meta({ data, matches }: Route.MetaArgs) {
  const rootData = matches.find((m) => m.id === "root")?.data as Awaited<ReturnType<typeof rootLoader>> | undefined;

  return [{ title: `${data.name} | ${rootData?.siteName ?? "Store"}` }];
}
```

---

## Common Patterns

### Static Page Metadata

```tsx
// app/routes/about.tsx
export function meta() {
  return [
    { title: "About Us | Company Name" },
    { name: "description", content: "Learn about our company history and mission." },
    { property: "og:title", content: "About Us" },
    { property: "og:type", content: "website" },
  ];
}
```

### Dynamic Product/Article Page

```tsx
export function meta({ data }: Route.MetaArgs) {
  if (!data) {
    return [{ title: "Not Found" }];
  }

  return [
    { title: `${data.title} | Blog` },
    { name: "description", content: data.excerpt },
    { property: "og:title", content: data.title },
    { property: "og:description", content: data.excerpt },
    { property: "og:image", content: data.featuredImage },
    { property: "og:type", content: "article" },
    { property: "article:published_time", content: data.publishedAt },
    { property: "article:author", content: data.author.name },
    { name: "twitter:card", content: "summary_large_image" },
  ];
}
```

### Error Page Metadata

```tsx
export function meta({ error }: Route.MetaArgs) {
  if (error) {
    return [{ title: "Error | Site Name" }, { name: "robots", content: "noindex" }];
  }
  return [{ title: "Page | Site Name" }];
}
```

### Merging Parent Meta (Custom Logic)

By default, child route meta REPLACES parent meta. To merge:

```tsx
export function meta({ matches }: Route.MetaArgs) {
  // Get parent meta
  const parentMeta = matches.flatMap((match) => match.meta ?? []);

  // Filter out titles (we'll provide our own)
  const filteredParent = parentMeta.filter((meta) => !("title" in meta));

  return [...filteredParent, { title: "Child Page Title" }, { name: "description", content: "Child description" }];
}
```

---

## SEO Audit Checklist

When auditing routes, check for:

### Required Tags

- [ ] `<title>` - Unique, descriptive, 50-60 chars
- [ ] `meta[name="description"]` - Unique, 150-160 chars
- [ ] `meta[name="viewport"]` - Mobile responsive (usually in root)

### Recommended Tags

- [ ] `link[rel="canonical"]` - Prevents duplicate content
- [ ] `meta[property="og:title"]` - Social sharing
- [ ] `meta[property="og:description"]` - Social sharing
- [ ] `meta[property="og:image"]` - Social preview image (1200x630px ideal)
- [ ] `meta[property="og:type"]` - website, article, product, etc.
- [ ] `meta[name="twitter:card"]` - summary or summary_large_image

### Conditional Tags

- [ ] `meta[name="robots"]` - noindex for private/error pages
- [ ] `link[rel="alternate"][hreflang]` - Multi-language sites
- [ ] `meta[property="article:*"]` - Blog/article pages
- [ ] `meta[property="product:*"]` - E-commerce pages

### Common Issues

- ❌ Missing title or description
- ❌ Duplicate titles across routes
- ❌ Title too long (>60 chars) or too short (<30 chars)
- ❌ Description too long (>160 chars) or too short (<70 chars)
- ❌ Missing Open Graph for shareable pages
- ❌ Missing canonical URL (causes duplicate content)
- ❌ Hardcoded URLs instead of using request URL
- ❌ Missing error handling in meta (crashes on missing data)

---

## Implementation Workflow

### For New Routes

1. Determine if page is static or dynamic
2. Choose React 19 inline or `meta` export
3. Add required tags (title, description)
4. Add Open Graph tags if page is shareable
5. Add canonical URL
6. Test with social sharing debuggers:
   - https://developers.facebook.com/tools/debug/
   - https://cards-dev.twitter.com/validator

### For Audit/Fix

1. List all route files
2. For each route, check:
   ```bash
   grep -l "export function meta\|export const meta\|<title>\|<meta" app/routes/**/*.tsx
   ```
3. Generate report of missing metadata
4. Prioritize: homepage > landing pages > dynamic pages > utility pages
5. Implement fixes route by route
6. Verify with `bun run typecheck`

---

## Quick Reference

### Minimal Static Page

```tsx
export function meta() {
  return [{ title: "Page Title | Site" }, { name: "description", content: "Page description here." }];
}
```

### Minimal Dynamic Page

```tsx
export function meta({ data }: Route.MetaArgs) {
  return [
    { title: data?.title ? `${data.title} | Site` : "Site" },
    { name: "description", content: data?.description ?? "Default description" },
  ];
}
```

### Full SEO Dynamic Page

```tsx
export function meta({ data, location }: Route.MetaArgs) {
  const title = data?.title ?? "Default";
  const description = data?.description ?? "Default description";
  const image = data?.image ?? "https://site.com/default-og.jpg";
  const url = `https://site.com${location.pathname}`;

  return [
    { title: `${title} | Site Name` },
    { name: "description", content: description },
    { tagName: "link", rel: "canonical", href: url },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: image },
    { property: "og:url", content: url },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "Site Name" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
  ];
}
```

---

## Sources

- [React Router Route Module docs](https://reactrouter.com/start/framework/route-module)
- [React Router Meta component](https://reactrouter.com/api/components/Meta)
- [React Router MetaFunction API](https://api.reactrouter.com/v7/interfaces/react_router.MetaFunction.html)
- [React 19 meta component](https://react.dev/reference/react-dom/components/meta)
- [LogRocket: React 19 Document Metadata](https://blog.logrocket.com/guide-react-19-new-document-metadata-feature/)

---

**End of Guide**
