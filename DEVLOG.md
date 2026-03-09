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

## 2026-03-09 — Design–code parity strategy

### Why a committed Figma manifest rather than Figma MCP

Two approaches were considered for giving Claude (and human contributors) awareness of the Figma file:

**Figma MCP** — a live connection to the Figma file during a Claude session. Requires the MCP server to be configured in every environment. Good for real-time queries ("what does this component look like right now") but session-dependent, not persistent, and adds a setup requirement to every working environment.

**Committed manifest** — a `design/figma-manifest.json` generated by a sync script and committed to the repo. Available in any Claude session without any live connection or MCP setup. Versioned alongside code, so you can see how the design evolved. Works offline.

The manifest won. It fits the project's principle of keeping everything contextual and committed. MCP can be layered on top for interactive design sessions if needed — it's complementary, not competing.

### Design direction

**Design leads. Code follows.** Token names, component variant names, spacing values, and layer naming conventions all originate in Figma. The sync script pulls from Figma; nothing pushes to it from this repo. (The companion `claude-figma-components-plugin` handles the Figma authoring side.)

This is deliberate: a design system that is code-led tends to drift from its visual intent. Keeping Figma as the authority forces design decisions to be made visually first.

### The sync script

`scripts/sync-figma.ts` — built and wired to `npm run sync-figma`.

Fetches in parallel:
1. `GET /v1/files/:key?depth=1` — file name and last-modified timestamp
2. `GET /v1/files/:key/variables/local` — all local variables and collections (requires paid Figma plan)
3. `GET /v1/files/:key/components` — individual published components and their parent set IDs
4. `GET /v1/files/:key/component_sets` — the component set metadata (separate endpoint — not part of /components)
5. `GET /v1/files/:key/styles` — all published text, colour, and effect styles

Transforms and writes `design/figma-manifest.json`. The manifest is a **read-only snapshot** — it is never written back to Figma. Commit it after each sync run.

Variable aliases (e.g. semantic → global token references) are preserved as `{ "aliasOf": "--css-var-name" }` so the token layer relationships are visible in the manifest.

Variant properties are inferred by parsing component names — Figma names variants as `"Variant=Default, Size=MD"` — and grouping them by component set.

### Figma file key

`FIGMA_FILE_KEY=OzEZwWy8CQFot6GcTVeg8f`

File: **Sparks Design System 2026**
URL: `https://www.figma.com/design/OzEZwWy8CQFot6GcTVeg8f/Sparks-Design-System-2026`

The file key is not sensitive (it's in the URL). It is hardcoded as the default in `scripts/sync-figma.ts`. The `FIGMA_API_TOKEN` must be set in `~/.zshrc` and is never committed.

---

## 2026-03-09 — Figma sync: first run and findings

### PAT scopes

Getting the correct Figma Personal Access Token scopes took some iteration. The working combination is:
- `file_content:read` — grants access to file metadata, components, and styles
- `library_content:read` — grants access to published component sets

**`file_variables:read` is not available on free Figma plans.** It requires a Professional or Enterprise subscription. Attempting to use it produces a 403 "Invalid scope" error. The sync script handles this gracefully — it logs a warning and continues, leaving `variables: []` in the manifest.

### component_sets is a separate endpoint

The Figma REST API docs imply components and their sets are retrieved together, but in practice `/v1/files/:key/components` returns only the individual component nodes. The component set metadata (name, description, key) lives at a separate endpoint: `/v1/files/:key/component_sets`.

Initial implementation tried to destructure `component_sets` from the `/components` response — this produced a runtime "component_sets is not iterable" crash. Fixed by splitting into two separate fetch calls in the `Promise.all`.

### Grouping components by set: node ID vs published key

The Figma API links a component to its parent set via `component.componentSetId`, which is the **node ID** (e.g. `"105:76"`). The component sets endpoint returns each set with a `key` field — the **published key**, a different identifier.

The sync script currently groups components using `bySetId[set.key]`, which means the lookup never finds a match. As a result, the Button component set appears in the manifest with `componentCount: 0`, while the individual variants appear as standalone entries.

The individual variant entries are still present and their names show the correct Figma property conventions. This is sufficient for design-code parity purposes. Fixing the grouping properly would require using node IDs throughout (the component sets endpoint doesn't expose node IDs directly — would need to cross-reference with the full file tree). Deferred for now.

### Naming conventions from the first sync

The manifest entries reveal how Figma names Button properties. Code must match these:

| Figma property | Values | Code equivalent |
|---|---|---|
| `Appearance` | `Primary`, `Secondary`, `Tertiary`, `Utility` | `data-appearance` attribute |
| `State` | `Default`, `Hover`, `Disabled` | CSS `[data-state]` or pseudo-classes |

Note: Figma uses `Appearance` not `Variant`. If implementing a coded `appearance` prop on the Button component, align with this exactly.

### npm run sync-figma recursion issue

Running `npm run sync-figma` can loop in some shell environments. The npm script sources `~/.zshrc` to pick up the API token, but if `~/.zshrc` itself modifies `PATH` or aliases `npm` in a way that triggers another `npm run`, it recurses. Invoke the script directly to be safe:

```bash
source ~/.nvm/nvm.sh && npx tsx scripts/sync-figma.ts
```

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
