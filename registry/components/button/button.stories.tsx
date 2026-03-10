import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './button';

// Shared icon used wherever an icon-only button is needed in stories
const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

// ─── Meta ────────────────────────────────────────────────────────────────────

const meta = {
  title: 'Components/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'tertiary', 'utility', 'destructive', 'destructive-outline', 'link'],
      description: 'Visual style variant. primary/secondary/tertiary/utility match Figma Appearance values.',
      table: { defaultValue: { summary: 'primary' } },
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'xl'],
      description: 'Size preset',
      table: { defaultValue: { summary: 'md' } },
    },
    disabled: {
      control: 'boolean',
      description: 'Disable the button',
    },
    loading: {
      control: 'boolean',
      description: 'Show spinner and block interaction',
    },
    iconOnly: {
      control: 'boolean',
      description: 'Collapse to a square (icon-only). Pass an icon as children — text children will look broken.',
    },
    fullWidth: {
      control: 'boolean',
      description: 'Stretch to fill container width',
    },
    children: {
      control: 'text',
      description: 'Button label',
    },
    // hide internal / advanced props from Controls
    asChild: { table: { disable: true } },
    iconBefore: { table: { disable: true } },
    iconAfter: { table: { disable: true } },
  },
  args: {
    children: 'Button',
    variant: 'primary',
    size: 'md',
    disabled: false,
    loading: false,
    iconOnly: false,
    fullWidth: false,
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

// ─── Playground ───────────────────────────────────────────────────────────────
// Every prop is wired to Controls — the main story for experimenting.
// When iconOnly is toggled, children automatically swaps to an icon so the
// button doesn't look broken with text squished into a square.

export const Playground: Story = {
  render: ({ iconOnly, children, ...args }) => (
    <Button iconOnly={iconOnly} aria-label={iconOnly ? 'Add item' : undefined} {...args}>
      {iconOnly ? <PlusIcon /> : children}
    </Button>
  ),
};

// ─── Variants (Figma: Appearance) ─────────────────────────────────────────────

export const Primary: Story = {
  args: { variant: 'primary' },
};

export const Secondary: Story = {
  args: { variant: 'secondary' },
};

export const Tertiary: Story = {
  args: { variant: 'tertiary' },
};

export const Utility: Story = {
  args: { variant: 'utility' },
};

// ─── Code-only variants (not yet in Figma) ────────────────────────────────────

export const Destructive: Story = {
  args: { variant: 'destructive', children: 'Delete' },
};

export const DestructiveOutline: Story = {
  name: 'Destructive Outline',
  args: { variant: 'destructive-outline', children: 'Delete' },
};

export const Link: Story = {
  args: { variant: 'link', children: 'Learn more' },
};

// ─── All Variants ─────────────────────────────────────────────────────────────

export const AllVariants: Story = {
  name: 'All Variants',
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
      <Button variant="primary">Primary</Button>
      <Button variant="secondary">Secondary</Button>
      <Button variant="tertiary">Tertiary</Button>
      <Button variant="utility">Utility</Button>
      <Button variant="destructive">Destructive</Button>
      <Button variant="destructive-outline">Destructive Outline</Button>
      <Button variant="link">Link</Button>
    </div>
  ),
};

// ─── Sizes ────────────────────────────────────────────────────────────────────

export const AllSizes: Story = {
  name: 'All Sizes',
  parameters: { controls: { disable: true } },
  render: () => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
      <Button size="sm">Small</Button>
      <Button size="md">Medium</Button>
      <Button size="lg">Large</Button>
      <Button size="xl">Extra Large</Button>
    </div>
  ),
};

// ─── States ───────────────────────────────────────────────────────────────────

export const Disabled: Story = {
  args: { disabled: true },
};

export const Loading: Story = {
  args: { loading: true },
};

export const IconOnly: Story = {
  name: 'Icon Only',
  render: (args) => (
    <Button {...args} iconOnly aria-label="Add item">
      <PlusIcon />
    </Button>
  ),
};

export const WithIcons: Story = {
  name: 'With Icons',
  parameters: { controls: { disable: true } },
  render: () => {
    const ArrowRight = () => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    );
    const Mail = () => (
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect width="20" height="16" x="2" y="4" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </svg>
    );
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
        <Button iconBefore={<Mail />}>Send email</Button>
        <Button iconAfter={<ArrowRight />}>Continue</Button>
        <Button variant="secondary" iconBefore={<Mail />} iconAfter={<ArrowRight />}>
          With both icons
        </Button>
      </div>
    );
  },
};

export const FullWidth: Story = {
  name: 'Full Width',
  decorators: [
    (Story) => (
      <div style={{ width: '400px' }}>
        <Story />
      </div>
    ),
  ],
  args: { fullWidth: true },
};
