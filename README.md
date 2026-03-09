# Sparks Design System

*Personal design system library, starter kit, and matching code component library — currently in early development. Intended for independent commercial sale.*

A Figma-based design system and commercial starter kit comprising Figma UI components with a matching coded component library. The code library is CLI-distributed (like [shadcn/ui](https://ui.shadcn.com/)) — consumers copy component source into their project rather than installing an npm package. You own the code. No black boxes.

All styling is CSS custom properties with no Tailwind dependency — restyle any component completely by overriding variables, with no specificity battles or framework coupling. Accessibility is handled by [Radix UI](https://www.radix-ui.com/) primitives.

---

## Part of a larger system

This repo is the **code component library** arm of the Sparks Design System. The full system includes:

| Part | Repo / tool | Status |
|---|---|---|
| Figma UI library | Figma (separate file) | — |
| Figma component builder | `claude-figma-components-plugin` | ✓ |
| Code component library (this repo) | `sparks-design-system` | ✓ |
| Documentation site | TBD | — |
| Governance & contribution model | TBD | — |

---

## How it works

```
sparks-design-system/
  packages/
    cli/                  ← @sparks-ds/cli — the CLI tool
  registry/
    registry.json         ← component manifest
    tokens/
      global.css          ← primitive design tokens
      semantic.css        ← intent-based aliases
    components/
      button/
        button.tsx        ← source file that gets copied
        button.css        ← component-level CSS custom properties
```

The **registry** is the source of truth. When a consumer runs `sparks-ds add button`, the CLI reads the registry and copies the component source files into their project. It also installs any required npm dependencies (e.g. `@radix-ui/react-slot`) and creates a `tokens.css` file if one doesn't exist.

---

## Using the CLI in your project

### 1. Add a component

```bash
npx @sparks-ds/cli add button
```

> During development, run directly from this repo — see [Development](#development).

The CLI will:
1. Copy component source files into `src/components/ui/<name>/` (configurable)
2. Install npm dependencies (e.g. `@radix-ui/react-slot`)
3. Create `src/styles/tokens.css` with the full token stack if it doesn't exist

### 2. Import the tokens once

In your app entry point (`main.tsx`, `_app.tsx`, etc.):

```ts
import './styles/tokens.css';
```

This file contains the global and semantic tokens — import it once and all components will work.

### 3. Use the component

```tsx
import { Button } from './components/ui/button/button';

<Button variant="outline" size="lg" iconBefore={<PlusIcon />}>
  Create project
</Button>
```

### 4. Restyle with tokens

Override CSS custom properties anywhere in your own CSS:

```css
/* Globally — restyle all buttons */
.sds-button {
  --button-radius: var(--radius-full);
  --button-font-weight: 700;
}

/* Scoped — restyle buttons only inside a specific section */
.marketing-hero .sds-button {
  --button-bg: var(--color-brand);
  --button-height: 3.5rem;
  --button-padding-x: 2rem;
}
```

Or per-instance via `style`:

```tsx
<Button style={{ '--button-radius': '0' } as React.CSSProperties}>
  Square button
</Button>
```

---

## Token system

Three layers, each building on the one above:

### Layer 1 — Global tokens (`tokens/global.css`)
Raw primitive values. Never use these in component code directly.

```css
--color-blue-600: #2563eb;
--space-4: 1rem;
--radius-md: 0.375rem;
```

### Layer 2 — Semantic tokens (`tokens/semantic.css`)
Intent-based aliases. Override these at `:root` to retheme the whole system.

```css
--color-brand:       var(--color-blue-600);
--color-brand-hover: var(--color-blue-700);
--color-text:        var(--color-gray-900);
```

### Layer 3 — Component tokens (e.g. `button.css`)
Per-component knobs. Override these to restyle a single component type.

```css
--button-bg:        var(--color-brand);
--button-height:    2.5rem;
--button-padding-x: var(--space-4);
--button-radius:    var(--radius-md);
--button-font-size: var(--font-size-sm);
```

---

## Available components

| Component | Description |
|---|---|
| `button` | Variants: default, outline, ghost, destructive, link. Sizes: sm/md/lg/xl. Loading, iconOnly, fullWidth, asChild. |

More components coming. See [DEVLOG.md](./DEVLOG.md) for what's planned.

---

## CLI commands

```bash
sparks-ds init           # create sparks-ds.json config in your project
sparks-ds list           # list all available components
sparks-ds add <name>     # copy a component into your project
```

Configuration lives in `sparks-ds.json` at your project root:

```json
{
  "componentsDir": "src/components/ui",
  "tokensFile": "src/styles/tokens.css"
}
```

---

## Development

### Prerequisites

Node via NVM. Prefix all commands with `source ~/.nvm/nvm.sh &&`.

### Build the CLI

```bash
source ~/.nvm/nvm.sh && npm run build:cli
```

### Run CLI commands during development

```bash
source ~/.nvm/nvm.sh && node packages/cli/dist/index.js list
source ~/.nvm/nvm.sh && node packages/cli/dist/index.js add button
```

### Adding a new component to the registry

1. Create `registry/components/<name>/<name>.tsx` — React component using Radix primitives
2. Create `registry/components/<name>/<name>.css` — All visual properties as CSS custom properties
3. Add an entry to `registry/registry.json` with `files`, `dependencies`, and `tokens`
4. Test with `sparks-ds add <name>` in a fresh directory

See [DEVLOG.md](./DEVLOG.md) for the component authoring guidelines.

### Keeping design and code in sync

**Design leads.** Changes originate in Figma and flow into code — not the other way around.

`scripts/sync-figma.ts` pulls from the Figma REST API and writes a committed snapshot to `design/figma-manifest.json`. This gives Claude and any human contributor full awareness of the Figma file's current state — token names, component variants, layer conventions — without needing Figma open.

**Workflow when the Figma file changes:**
1. Make changes in Figma
2. Run the sync script: `source ~/.nvm/nvm.sh && npx tsx scripts/sync-figma.ts`
3. Commit the updated `design/figma-manifest.json`
4. Claude reads the manifest and updates `global.css`, `semantic.css`, or component files to match

**What the manifest contains:**
- Component names and variant property names (e.g. `Appearance`: Primary / Secondary / Tertiary / Utility)
- Text and colour styles in use
- Variable collections and values (requires Figma Professional/Enterprise plan)

The sync script requires a Figma Personal Access Token (`FIGMA_API_TOKEN`) in `~/.zshrc`. See [DEVLOG.md](./DEVLOG.md) for PAT scope requirements and other sync details.

---

## Project structure

```
sparks-design-system/
  package.json                  ← npm workspaces root
  CLAUDE.md                     ← AI assistant context
  DEVLOG.md                     ← architecture decisions & history
  README.md                     ← this file

  packages/
    cli/
      package.json              ← @sparks-ds/cli, "type": "module"
      tsconfig.json             ← NodeNext module resolution
      src/
        index.ts                ← commander entry point
        commands/
          init.ts
          list.ts
          add.ts
        lib/
          registry.ts           ← loads registry.json, reads component files
          installer.ts          ← copies files, installs deps, writes tokens.css
          config.ts             ← reads/writes sparks-ds.json
          logger.ts             ← chalk-based logging helpers

  registry/
    registry.json               ← component manifest
    tokens/
      global.css
      semantic.css
    components/
      button/
        button.tsx
        button.css

  design/
    figma-manifest.json         ← committed Figma snapshot (generated by sync script)

  scripts/
    sync-figma.ts               ← Figma REST API → figma-manifest.json
```
