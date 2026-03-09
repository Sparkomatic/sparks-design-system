import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import './button.css';

// ─── Types ──────────────────────────────────────────────────────────────────

export type ButtonVariant =
  | 'default'
  | 'outline'
  | 'ghost'
  | 'destructive'
  | 'destructive-outline'
  | 'link';

export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * Visual style variant.
   * @default 'default'
   */
  variant?: ButtonVariant;

  /**
   * Size preset. Controls height, padding, font size, and border radius
   * via component-level CSS custom properties — override those variables
   * in your own CSS if you need sizes outside this scale.
   * @default 'md'
   */
  size?: ButtonSize;

  /**
   * Render children into a child element instead of a <button>.
   * Uses Radix Slot — useful for routing links, e.g.:
   *   <Button asChild><a href="/dashboard">Go</a></Button>
   */
  asChild?: boolean;

  /**
   * Shows a spinner and prevents interaction while true.
   * The button remains in the DOM at full size (no layout shift).
   */
  loading?: boolean;

  /**
   * Collapse horizontal padding so the button is square.
   * Use for icon-only buttons — combine with an aria-label.
   */
  iconOnly?: boolean;

  /**
   * Stretch to fill the width of its container.
   */
  fullWidth?: boolean;

  /**
   * Icon rendered before the label text.
   * Hidden while loading.
   */
  iconBefore?: React.ReactNode;

  /**
   * Icon rendered after the label text.
   * Hidden while loading.
   */
  iconAfter?: React.ReactNode;
}

// ─── Component ──────────────────────────────────────────────────────────────

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'default',
      size = 'md',
      asChild = false,
      loading = false,
      iconOnly = false,
      fullWidth = false,
      iconBefore,
      iconAfter,
      className,
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const Comp = asChild ? Slot : 'button';

    const isDisabled = disabled || loading;

    return (
      <Comp
        ref={ref}
        className={['sds-button', className].filter(Boolean).join(' ')}
        // data-* attributes drive CSS variant/size/state selectors in button.css
        data-variant={variant !== 'default' ? variant : undefined}
        data-size={size !== 'md' ? size : undefined}
        data-loading={loading || undefined}
        data-icon-only={iconOnly || undefined}
        data-full-width={fullWidth || undefined}
        disabled={isDisabled}
        aria-disabled={isDisabled}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Spinner />}
        {!loading && iconBefore}
        {children}
        {!loading && iconAfter}
      </Comp>
    );
  }
);

Button.displayName = 'Button';

// ─── Loading spinner ─────────────────────────────────────────────────────────
// Inline SVG so the component has no extra dependencies.
// Size is controlled by the --button-icon-size token.

const Spinner: React.FC = () => (
  <svg
    aria-hidden="true"
    focusable="false"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    style={{ animation: 'sds-button-spin 0.75s linear infinite' }}
  >
    <style>{`
      @keyframes sds-button-spin {
        from { transform: rotate(0deg); }
        to   { transform: rotate(360deg); }
      }
    `}</style>
    <circle
      cx="12"
      cy="12"
      r="9"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeDasharray="56.549"  /* 2π × 9 */
      strokeDashoffset="42.412" /* 75% hidden */
      strokeLinecap="round"
    />
  </svg>
);

// ─── Exports ─────────────────────────────────────────────────────────────────

export { Button };
export default Button;
