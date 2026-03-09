---
argument-hint: [minimal|full]
description: Implement light/dark/system theme switcher with SSR support
---

# Implement Theme Switcher (RR7)

Add a complete light/dark/system theme system with SSR, cookie persistence, and live system preference detection.

## First: Check Existing Implementation

Check if theme system already exists:

1. Does `app/hooks/use-theme.ts` exist?
2. Does `app/root.tsx` have `getThemeFromRequest` import?
3. Does `app/app.css` have `light-dark()` CSS functions?

If YES to all → ask user if they want to update/modify existing system.
If NO → proceed with implementation below.

## What You're Building

**Three-mode system:**
- `light` - Force light
- `dark` - Force dark
- `system` - Follow OS (default)

**Features:**
- SSR-aware (no flash on load)
- Cookie persistence (1 year)
- System preference detection + live updates
- CSS `light-dark()` (no duplicate rules)
- Class-based overrides (`.light`/`.dark` on `<html>`)

**Flow:**
1. Server reads cookie → passes theme to root loader
2. Root applies class to `<html>` element
3. Client hook syncs with cookie, listens for system changes
4. CSS `light-dark()` + classes control theming

## Implementation Mode

Check `$ARGUMENTS`:
- If contains "minimal" → Skip ColorSchemeToggle component (steps 1-5 only)
- If contains "full" or empty → Full implementation (all steps)

## Step-by-Step Implementation

### 1. Type Definitions

Create `app/lib/preferences/preference-types.ts`:

```typescript
export type Theme = "light" | "dark" | "system";

export type UserPreferences = {
  theme: Theme;
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: "system",
};

export const THEME_VALUES: Theme[] = ["light", "dark", "system"] as const;
```

**Note:** If user has other preferences (sidebar, etc.), merge with existing types.

### 2. Server Cookie Parsing

Create `app/lib/preferences/preference-cookie.server.ts`:

```typescript
import {
  DEFAULT_PREFERENCES,
  THEME_VALUES,
  type Theme,
  type UserPreferences,
} from "./preference-types";

const PREFERENCE_COOKIE_NAME = "user_preferences";

export function getPreferencesFromRequest(request: Request): UserPreferences {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return DEFAULT_PREFERENCES;

  const cookies = parseCookieHeader(cookieHeader);
  const preferencesStr = cookies[PREFERENCE_COOKIE_NAME];
  if (!preferencesStr) return DEFAULT_PREFERENCES;

  try {
    const parsed = JSON.parse(decodeURIComponent(preferencesStr));
    return {
      theme: parseTheme(parsed.theme),
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function parseTheme(value: unknown): Theme {
  if (typeof value === "string" && THEME_VALUES.includes(value as Theme)) {
    return value as Theme;
  }
  return DEFAULT_PREFERENCES.theme;
}

function parseCookieHeader(cookieHeader: string): Record<string, string> {
  return cookieHeader.split(";").reduce(
    (acc, cookie) => {
      const [key, value] = cookie.trim().split("=");
      if (key && value) acc[key] = value;
      return acc;
    },
    {} as Record<string, string>
  );
}
```

### 3. Theme Server Utilities

Create `app/lib/theme/theme.server.ts`:

```typescript
import { getPreferencesFromRequest } from "~/lib/preferences/preference-cookie.server";
import type { Theme } from "~/lib/preferences/preference-types";

export function getThemeFromRequest(request: Request): Theme {
  const preferences = getPreferencesFromRequest(request);
  return preferences.theme;
}

export function getThemeClass(theme: Theme): string {
  if (theme === "light") return "light";
  if (theme === "dark") return "dark";
  return ""; // system mode
}
```

### 4. Update Root Loader & Layout

Edit `app/root.tsx`:

**Add imports:**
```typescript
import { getThemeFromRequest } from "~/lib/theme/theme.server";
import { cn } from "~/lib/utils";
```

**Update loader:**
```typescript
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const theme = getThemeFromRequest(request);

  // ... merge with existing loader data

  return { theme /* , ...otherData */ };
};
```

**Update Layout:**
```typescript
export function Layout({ children }: { children: React.ReactNode }) {
  const data = useRouteLoaderData<typeof loader>("root");

  const theme = data?.theme || "system";
  const themeClass = theme === "system" ? "" : theme;

  return (
    <html lang="en" className={cn("notranslate", themeClass)}>
      {/* ... rest of html/head/body */}
    </html>
  );
}
```

**CRITICAL:** Theme class MUST be on `<html>` element for SSR consistency.

### 5. Theme Hook (Client)

Create `app/hooks/use-theme.ts`:

```typescript
import { useCallback, useEffect, useState } from "react";
import { useRouteLoaderData } from "react-router";
import type { Theme } from "~/lib/preferences/preference-types";
import type { loader as rootLoader } from "~/root";

const PREFERENCE_COOKIE_NAME = "user_preferences";

export function useTheme() {
  const rootData = useRouteLoaderData<typeof rootLoader>("root");
  const [theme, setThemeState] = useState<Theme>(rootData?.theme ?? "system");

  const updateDOMClass = useCallback((newTheme: Theme) => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");

    if (newTheme === "light" || newTheme === "dark") {
      root.classList.add(newTheme);
    }
  }, []);

  const setTheme = useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme);
      updateDOMClass(newTheme);

      // Update cookie - merge with existing preferences
      const existingCookie = document.cookie.split("; ").find((row) => row.startsWith(`${PREFERENCE_COOKIE_NAME}=`));

      let preferences: Record<string, unknown> = {};
      if (existingCookie) {
        try {
          preferences = JSON.parse(decodeURIComponent(existingCookie.split("=")[1]));
        } catch {
          // ignore parse errors
        }
      }

      preferences.theme = newTheme;
      document.cookie = `${PREFERENCE_COOKIE_NAME}=${encodeURIComponent(JSON.stringify(preferences))}; Path=/; SameSite=Lax; Max-Age=31536000`;
    },
    [updateDOMClass]
  );

  // Sync with root loader data
  useEffect(() => {
    if (rootData?.theme && rootData.theme !== theme) {
      setThemeState(rootData.theme);
      updateDOMClass(rootData.theme);
    }
  }, [rootData?.theme]);

  const resolvedTheme = useResolvedTheme(theme);

  return {
    theme, // Preference: "light" | "dark" | "system"
    resolvedTheme, // What's displayed: "light" | "dark"
    setTheme,
  };
}

function useResolvedTheme(theme: Theme): "light" | "dark" {
  const [systemPreference, setSystemPreference] = useState<"light" | "dark">("light");

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemPreference(mediaQuery.matches ? "dark" : "light");

    const handler = (e: MediaQueryListEvent) => {
      setSystemPreference(e.matches ? "dark" : "light");
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  if (theme === "system") {
    return systemPreference;
  }
  return theme;
}
```

### 6. CSS Theme Variables (REQUIRED)

Edit `app/app.css` - add these sections:

**Dark variant definition:**
```css
/* Dark variant: applies when .dark class OR system prefers dark (unless .light forced) */
@custom-variant dark {
  &:where(.dark, .dark *);
  @media (prefers-color-scheme: dark) {
    &:where(:not(.light, .light *))
  }
}
```

**Theme variables with light-dark():**
```css
:root {
  /* Default: follow system preference */
  color-scheme: light dark;

  /* Theme colors using light-dark() - no duplication! */
  --background: light-dark(oklch(0.9673 0.007 88.6426), oklch(0.2189 0.0065 78.1847));
  --foreground: light-dark(oklch(0.1448 0 0), oklch(0.9851 0 0));
  --card: light-dark(oklch(0.9741 0.0074 80.7212), oklch(0.2519 0.0057 91.5937));
  --card-foreground: light-dark(oklch(0.1448 0 0), oklch(0.9851 0 0));
  --popover: light-dark(oklch(1 0 0), oklch(0.2519 0.0057 91.5937));
  --popover-foreground: light-dark(oklch(0.1448 0 0), oklch(0.9851 0 0));
  --primary: light-dark(oklch(0.844 0.1132 88.5742), oklch(0.7651 0.1173 87.7685));
  --primary-foreground: light-dark(oklch(0.1822 0 0), oklch(0.2478 0 0));
  --secondary: light-dark(oklch(0.9316 0.0128 86.8316), oklch(0.3257 0.0075 84.5917));
  --secondary-foreground: light-dark(oklch(0.2735 0.0559 87.078), oklch(0.9851 0 0));
  --muted: light-dark(oklch(0.9374 0.0099 87.4728), oklch(0.3051 0.0055 91.5582));
  --muted-foreground: light-dark(oklch(0.5486 0 0), oklch(0.7572 0 0));
  --accent: light-dark(oklch(0.9316 0.0128 86.8316), oklch(0.367 0.0085 97.5574));
  --accent-foreground: light-dark(oklch(0.2046 0 0), oklch(0.9551 0 0));
  --destructive: light-dark(oklch(0.583 0.2387 28.4765), oklch(0.7022 0.1892 22.2279));
  --destructive-foreground: light-dark(oklch(0.9702 0 0), oklch(0.2686 0 0));
  --border: light-dark(oklch(0.8607 0 0), oklch(0.3407 0 0));
  --input: light-dark(oklch(0.8583 0.0088 84.5756), oklch(0.4386 0 0));
  --ring: oklch(0.709 0 0);
}

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

**Tailwind integration:**
```css
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
}
```

**Note:** If user already has existing theme variables, convert them to `light-dark()` format. Delete any `.dark { ... }` override blocks.

### 7. Theme Toggle Component (Full Mode Only)

**ONLY IF "full" mode or default:**

Create `app/components/misc/theme-toggle.tsx`:

```typescript
import { Sun, Moon, Monitor, ChevronDown } from "lucide-react";
import { useTheme } from "~/hooks/use-theme";
import type { Theme } from "~/lib/preferences/preference-types";
import { cn } from "~/lib/utils";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "~/components/ui/dropdown-menu";

const THEME_OPTIONS: { value: Theme; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function ColorSchemeToggle({ className }: { className?: string }) {
  const { theme, setTheme, resolvedTheme } = useTheme();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "h-8 px-2.5 rounded-full",
            "bg-card border border-border",
            "flex items-center justify-center gap-1",
            "hover:bg-accent active:scale-95",
            "transition-all duration-200 ease-out",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            className
          )}
          aria-label="Change color scheme"
        >
          <div className="relative w-5 h-5">
            <Sun
              className={cn(
                "absolute inset-0 w-5 h-5 transition-all duration-300",
                theme === "light" ? "opacity-100 rotate-0 scale-100 text-amber-500" : "opacity-0 -rotate-90 scale-50"
              )}
            />
            <Moon
              className={cn(
                "absolute inset-0 w-5 h-5 transition-all duration-300",
                theme === "dark" ? "opacity-100 rotate-0 scale-100 text-indigo-400" : "opacity-0 rotate-90 scale-50"
              )}
            />
            <Monitor
              className={cn(
                "absolute inset-0 w-5 h-5 transition-all duration-300",
                theme === "system"
                  ? "opacity-100 rotate-0 scale-100 text-muted-foreground"
                  : "opacity-0 rotate-90 scale-50"
              )}
            />
            {theme === "system" && (
              <span
                className={cn(
                  "absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full",
                  "border-2 border-card flex items-center justify-center",
                  resolvedTheme === "dark" ? "bg-indigo-400" : "bg-amber-500"
                )}
              >
                {resolvedTheme === "light" ? (
                  <Sun className="w-2 h-2 text-white" />
                ) : (
                  <Moon className="w-2 h-2 text-white" />
                )}
              </span>
            )}
          </div>
          <ChevronDown className="w-3 h-3 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[140px]">
        <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as Theme)}>
          {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
            <DropdownMenuRadioItem key={value} value={value} className="cursor-pointer">
              <Icon
                className={cn(
                  "w-4 h-4 mr-1",
                  value === "light" && "text-amber-500",
                  value === "dark" && "text-indigo-400",
                  value === "system" && "text-muted-foreground"
                )}
              />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

**Dependencies check:**
- If `lucide-react` not installed → `bun add lucide-react`
- If dropdown-menu not installed → `bunx --bun shadcn@latest add dropdown-menu`

## Verification Steps

After implementation:

1. Run `bun run typecheck` - must pass
2. Start dev server (user does this)
3. Check:
   - [ ] Default loads in system mode (no class on `<html>`)
   - [ ] Changing OS preference updates UI
   - [ ] Switching themes updates immediately (no reload)
   - [ ] Theme persists after reload
   - [ ] No flash on SSR load
   - [ ] Toggle shows correct icon (if full mode)

## Troubleshooting

**Flash on page load:**
- Verify root loader returns theme
- Check `<html>` class applied in Layout
- Cookie name must match client/server

**System mode not working:**
- Confirm `color-scheme: light dark` in `:root`
- No class on `<html>` when theme is "system"
- Browser must support `light-dark()` (Chrome 117+, Safari 17.4+)

**Cookie not persisting:**
- Check `Max-Age=31536000` in cookie string
- Verify `Path=/`
- Cookie name matches across all files

## Usage Example

**Add toggle to layout (full mode):**
```typescript
import { ColorSchemeToggle } from "~/components/misc/theme-toggle";

export function Header() {
  return (
    <header>
      <ColorSchemeToggle />
    </header>
  );
}
```

**Programmatic theme control:**
```typescript
import { useTheme } from "~/hooks/use-theme";

export function MyComponent() {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <button onClick={() => setTheme("dark")}>
      Force Dark Mode
    </button>
  );
}
```

## File Summary

**Minimal mode (6 files):**
- `app/lib/preferences/preference-types.ts`
- `app/lib/preferences/preference-cookie.server.ts`
- `app/lib/theme/theme.server.ts`
- `app/hooks/use-theme.ts`
- `app/root.tsx` (modified)
- `app/app.css` (modified)

**Full mode (+1 file):**
- All minimal files +
- `app/components/misc/theme-toggle.tsx`

---

$ARGUMENTS
