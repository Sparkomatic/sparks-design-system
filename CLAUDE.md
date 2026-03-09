# Sparks Design System — Claude Context

A CLI-distributed React component library for the Sparks Design System. Components are copied into consumer projects (shadcn-style) rather than installed as an npm package. Styling is entirely CSS custom properties — no Tailwind, no CSS-in-JS. Radix UI handles accessibility primitives.

## How to run

Requires Node via NVM. Always prefix node/npm commands with `source ~/.nvm/nvm.sh &&`.

**Build the CLI:**
```bash
source ~/.nvm/nvm.sh && npm run build:cli
```

**Run CLI commands directly (dev):**
```bash
source ~/.nvm/nvm.sh && node packages/cli/dist/index.js list
source ~/.nvm/nvm.sh && node packages/cli/dist/index.js add button
```

**Install CLI workspace deps:**
```bash
source ~/.nvm/nvm.sh && npm install --workspace=packages/cli
```

## Project structure

```
sparks-design-system/
  package.json                  ← npm workspaces root
  registry/
    registry.json               ← component manifest (source of truth)
    tokens/
      global.css                ← primitive tokens (never used in components directly)
      semantic.css              ← intent aliases (--color-brand, --color-text, etc.)
    components/
      button/
        button.tsx              ← React component source (gets copied to consumer)
        button.css              ← component-level CSS custom properties
  packages/
    cli/
      package.json              ← @sparks-ds/cli, "type": "module" (ESM)
      tsconfig.json             ← NodeNext module resolution
      src/
        index.ts                ← commander entry; commands: init / list / add
        commands/               ← add.ts, list.ts, init.ts
        lib/
          registry.ts           ← loads registry.json, reads component source files
          installer.ts          ← copies files, installs npm deps, writes tokens.css
          config.ts             ← reads/writes sparks-ds.json in consumer project
          logger.ts             ← chalk logging (info/success/warn/error/step/dim)
```

## Key technical notes

### ESM + fs-extra import
The CLI package uses `"type": "module"`. `fs-extra` is CommonJS. Always import it as a **default import**, not a namespace import:
```ts
import fs from 'fs-extra';       // correct
import * as fs from 'fs-extra';  // WRONG — readJson, pathExists etc. are undefined
```

### TypeScript imports need .js extensions
With `"module": "NodeNext"`, TypeScript requires `.js` extensions in all import paths even though source files are `.ts`. This is correct and intentional:
```ts
import { logger } from './logger.js';   // correct
import { logger } from './logger';      // WRONG in NodeNext
```

### Registry path resolution
The CLI resolves the registry relative to `__dirname` of the compiled file.
Compiled output is at `packages/cli/dist/lib/registry.js`, so `__dirname` = `dist/lib/`.
The registry root is at `../../../../registry` (4 levels up to reach repo root, then into `registry/`).
Do NOT change this path without accounting for the compiled output location.

### Component file structure in registry
Each component in the registry has:
- `registry/components/<name>/<name>.tsx` — the React source
- `registry/components/<name>/<name>.css` — CSS custom properties only

The CSS file must define all visual properties as custom properties within `.sds-<name> { }`.
Variants and sizes are applied via `data-*` attribute selectors (not class names).

### Three-layer token system
1. **Global** (`tokens/global.css`) — raw primitives: `--color-blue-600`, `--space-4`
2. **Semantic** (`tokens/semantic.css`) — intent aliases: `--color-brand`, `--color-text`
3. **Component** (e.g. `button.css`) — per-component knobs: `--button-bg`, `--button-height`

Components MUST only reference semantic tokens (layer 2), never global tokens (layer 1) directly. This ensures rethemeing works by overriding only the semantic layer.

### Adding a new component — checklist
1. Create `registry/components/<name>/<name>.tsx` — use Radix primitive as the base
2. Create `registry/components/<name>/<name>.css` — all visual props as CSS vars, scoped to `.sds-<name>`
3. Add entry to `registry/registry.json` — include `files`, `dependencies`, `tokens`
4. Test: run `sparks-ds add <name>` in a fresh temp directory
5. Update README.md component table

### Variant + size pattern
Variants and sizes are driven by `data-*` attributes on the root element, not class names:
```tsx
<button
  data-variant={variant !== 'default' ? variant : undefined}
  data-size={size !== 'md' ? size : undefined}
>
```
```css
.sds-button[data-variant="outline"] { --button-bg: transparent; }
.sds-button[data-size="sm"]         { --button-height: 2rem; }
```
This keeps the component API clean and avoids BEM class juggling.

### Radix Slot / asChild pattern
All interactive components should accept `asChild` and use Radix `Slot`:
```tsx
import { Slot } from '@radix-ui/react-slot';
const Comp = asChild ? Slot : 'button';
return <Comp ...>{children}</Comp>;
```
This allows consumers to use routing links (`<a>`, Next.js `<Link>`, etc.) while keeping all component styles and props.

### sparks-ds.json config
Consumers store preferences in `sparks-ds.json` at their project root:
```json
{ "componentsDir": "src/components/ui", "tokensFile": "src/styles/tokens.css" }
```
If missing, `getConfig()` returns the defaults — `init` is optional, not required before `add`.

### Package manager detection
`installer.ts` detects the consumer's package manager from lock files:
- `bun.lockb` → bun
- `pnpm-lock.yaml` → pnpm
- `yarn.lock` → yarn
- fallback → npm

### CSS class namespace
All component root classes are prefixed `sds-` (Sparks Design System):
`sds-button`, `sds-input`, `sds-badge`, etc.
Do not drop this prefix — consumers may have their own `.button` classes.

## Relationship with the Figma plugin

`claude-figma-components-plugin` is a separate repo that lets you build and manage Figma components via Claude. It is part of the same Sparks Design System family but lives independently. The two repos share no code — the Figma plugin outputs visual components in Figma; this repo outputs React components for production apps.

## What does NOT exist yet (as of v0.0.1)

- Published npm package (CLI only runs from local dev currently)
- Storybook / component docs site
- More components beyond Button
- Dark mode token set (scaffold is in semantic.css, commented out)
- GitHub raw URL fetching (CLI reads local registry only)
- CI / automated tests
