# Sparks Design System — Development Log

Architecture decisions, trade-offs, and history. Written chronologically so future contributors (human or AI) understand *why* things are the way they are.

---

## 2026-03-09 — v0.0.1 initial setup

### Why shadcn-style distribution?

The standard npm package approach (`import { Button } from '@sparks-ds/react'`) means consumers can't easily modify components. Design systems drift from their implementations in real products — teams end up wrapping components in layers, fighting APIs they can't change, or just writing their own from scratch.

The shadcn model — copy source files into the consumer's project — trades convenience for ownership. The consumer gets full control. When the design system evolves, they can selectively pull in updates rather than taking breaking changes wholesale.

This matches the Sparks Design System philosophy: the system provides a strong, well-reasoned starting point, not a constraint.

### Why no Tailwind?

Tailwind was considered and rejected for the following reasons:

1. **CSS specificity conflicts.** Utility classes at the same specificity fight each other. Overriding `bg-blue-600` from a parent requires adding another utility at the same level, and the order depends on Tailwind's generated stylesheet — not on the cascade you see in your code.

2. **Tight coupling.** Tailwind requires consumers to either use Tailwind themselves, or eject and lose all the styles. A design system should be frameworkagnostic.

3. **Design tokens don't compose.** Tailwind's `theme()` and `@apply` work within Tailwind's mental model. They don't express a two- or three-layer token system naturally.

4. **Runtime customisation is awkward.** Changing `padding-x` per-instance requires adding/removing classes. Changing a CSS variable is a one-liner.

CSS custom properties give us everything Tailwind was providing (design tokens, systematic values) without the constraints.

### Why CSS custom properties for component styling?

The design token approach used here has three layers:

```
Global tokens    →  Semantic tokens    →  Component tokens
--color-blue-600 →  --color-brand      →  --button-bg
--space-4        →  (direct ref)       →  --button-padding-x
--radius-md      →  (direct ref)       →  --button-radius
```

**Rethemeing works at any level:**
- Override semantic tokens at `:root` → the whole system changes brand colour
- Override component tokens at `.sds-button` → all buttons change
- Override component tokens on a parent selector → scoped change (e.g. marketing hero)
- Override component tokens via `style=` → per-instance change

This is impossible to achieve cleanly with utility classes.

**The constraint:** components must only reference semantic tokens, never global tokens. `--button-bg: var(--color-brand)` is correct. `--button-bg: var(--color-blue-600)` is wrong — it bypasses the semantic layer and breaks rethemeing.

### Why Radix UI for accessibility?

Writing accessible interactive components from scratch is a significant undertaking:
- Focus management, keyboard navigation, ARIA roles, screen reader announcements
- Each component type (select, dialog, tooltip, tabs…) has its own specification

Radix provides these primitives unstyled. We add the CSS layer on top. This is the same choice shadcn made, and it's the right one — Radix is well-maintained, well-documented, and widely deployed.

Current Radix dependencies:
- `@radix-ui/react-slot` — used by every component for the `asChild` pattern

As more components are added, other Radix packages will be added per-component.

### Why `data-*` attributes for variants/sizes?

Two alternatives were considered:

**Option A: BEM classes** (`.sds-button--outline`, `.sds-button--sm`)
- Pro: works without custom CSS selectors
- Con: messy class string construction in TSX; class list order affects nothing but it's confusing

**Option B: data attributes** (`data-variant="outline"`, `data-size="sm"`)
- Pro: clean TSX props → data mapping; readable in devtools; the CSS selector directly expresses intent
- Con: none in practice

`data-*` won. The pattern is: only set the attribute when it's non-default (omit `data-variant` when `variant === 'default'`, omit `data-size` when `size === 'md'`). This keeps the DOM clean and makes default styling the path of least resistance.

### CLI: why ESM?

The CLI is `"type": "module"` for two reasons:

1. The npm ecosystem is moving to ESM. New packages (chalk v5, ora v8) are ESM-only.
2. Starting ESM now avoids a painful CJS-to-ESM migration later.

**Known gotcha:** `fs-extra` is CommonJS. With ESM, it must be imported as a default import:
```ts
import fs from 'fs-extra';  // default import — works
import * as fs from 'fs-extra';  // namespace import — readJson etc. are undefined at runtime
```

This is not a TypeScript error; it only fails at runtime. See `registry.ts`, `config.ts`, `installer.ts`.

### CLI: registry path resolution

The compiled CLI entry is at `packages/cli/dist/index.js`. Helper files are at `packages/cli/dist/lib/*.js`.

When `registry.ts` is compiled, `__dirname` resolves to `packages/cli/dist/lib/`. The registry root is the repo's `registry/` directory, so the relative path from `dist/lib/` is `../../../../registry` (4 levels up).

If the CLI is ever published to npm and installed globally, this local-path approach breaks. At that point, the registry loader should be updated to fetch file content from GitHub raw URLs:
```
https://raw.githubusercontent.com/sparks/sparks-design-system/main/registry/components/button/button.tsx
```

This is the same pattern shadcn uses for its hosted registry.

---

## Component roadmap

Roughly prioritised by frequency-of-need in real product work:

| Component | Radix dep | Notes |
|---|---|---|
| `button` | `@radix-ui/react-slot` | ✅ done |
| `input` | — | Text input, number, password. Error/hint states. |
| `label` | `@radix-ui/react-label` | Accessible label that pairs with form inputs. |
| `textarea` | — | Auto-resize variant. |
| `select` | `@radix-ui/react-select` | Styled dropdown replacing native `<select>`. |
| `checkbox` | `@radix-ui/react-checkbox` | Indeterminate state. |
| `radio-group` | `@radix-ui/react-radio-group` | — |
| `switch` | `@radix-ui/react-switch` | Toggle / boolean. |
| `badge` | — | Status chips, tags. |
| `tooltip` | `@radix-ui/react-tooltip` | — |
| `dialog` | `@radix-ui/react-dialog` | Modal. |
| `popover` | `@radix-ui/react-popover` | Floating panel. |
| `dropdown-menu` | `@radix-ui/react-dropdown-menu` | Contextual actions. |
| `tabs` | `@radix-ui/react-tabs` | — |
| `avatar` | `@radix-ui/react-avatar` | Image with fallback initials. |
| `spinner` | — | Standalone loading indicator. |
| `card` | — | Surface container. |
| `separator` | `@radix-ui/react-separator` | HR/divider with semantic role. |
| `alert` | — | Info/success/warning/error banners. |
| `toast` | `@radix-ui/react-toast` | Ephemeral notifications. |

---

## Future work

### Remote registry
When published to npm, the CLI should fetch component files from GitHub raw URLs rather than the local filesystem. This requires:
- A `registryBaseUrl` config field (or a hardcoded constant pointing to the published repo)
- HTTP fetch replacing `fs.readFile` in `registry.ts`
- Caching (optional but nice — avoid re-fetching on repeat runs)

### Versioning
Components could be versioned independently. `registry.json` could track a `version` per component and the CLI could warn when a consumer's copy is behind the registry version.

### Storybook / docs site
Each component needs a documentation page with:
- Interactive variant/size/state demo
- Token table (what CSS variables are available)
- Copy-paste usage example

### Testing
- Unit tests for the CLI (copy logic, package manager detection)
- Visual regression tests for components (Chromatic or similar)

### Dark mode
The semantic token scaffold for dark mode is already in `tokens/semantic.css` (commented out). When ready, uncomment and fill in the values, then document the `[data-theme="dark"]` setup.
