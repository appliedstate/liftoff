import React from 'react';
import type { Meta, StoryObj } from '@storybook/react-webpack5';

// Typography Showcase Component
const TypographyShowcase = () => {
  return (
    <div className="space-y-12 p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center mb-16">
        <h1 className="text-display-2xl mb-4">Typography System</h1>
        <p className="text-body-lg text-gray-600 max-w-2xl mx-auto">
          Inter font family with systematic scale and spacing, inspired by Linear's typography approach.
        </p>

        {/* Font Debug Info */}
        <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg max-w-lg mx-auto">
          <div className="text-sm font-semibold text-blue-800 mb-4">🔍 Font Loading Debug:</div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-blue-700">Inter (Current Font):</span>
              <span className="font-sans text-sm bg-white px-2 py-1 rounded border">Sphinx of black quartz</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-blue-700">System UI (Fallback):</span>
              <span style={{fontFamily: 'system-ui'}} className="text-sm bg-white px-2 py-1 rounded border">Sphinx of black quartz</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-blue-700">Sans-serif (Default):</span>
              <span style={{fontFamily: 'sans-serif'}} className="text-sm bg-white px-2 py-1 rounded border">Sphinx of black quartz</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-blue-200">
            <div className="text-xs text-blue-600">
              💡 If Inter is loading correctly, the first line should look different from the fallback fonts.
            </div>
          </div>
        </div>
      </div>

      {/* Font Family */}
      <div className="bg-white rounded-xl p-8 border border-gray-200 shadow-soft">
        <h2 className="text-display-md mb-8">Font Family</h2>
        <div className="space-y-6">
          <div>
            <h3 className="text-heading-lg mb-4">Inter</h3>
            <p className="text-body-md text-gray-600 mb-6">
              A highly readable, geometric typeface designed for user interfaces and digital displays.
            </p>
            <div className="bg-gray-50 p-6 rounded-lg">
              <p className="text-body-lg leading-relaxed">
                "The quick brown fox jumps over the lazy dog" is a pangram that contains every letter of the alphabet.
                Used to demonstrate font samples, it ensures that every glyph is visible and properly spaced.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Font Weights */}
      <div className="bg-white rounded-xl p-8 border border-gray-200 shadow-soft">
        <h2 className="text-display-md mb-8">Font Weights</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div>
              <div className="text-caption text-gray-500 mb-2">Light (300)</div>
              <div className="font-light text-2xl">The quick brown fox jumps over the lazy dog</div>
            </div>
            <div>
              <div className="text-caption text-gray-500 mb-2">Regular (400)</div>
              <div className="font-normal text-2xl">The quick brown fox jumps over the lazy dog</div>
            </div>
            <div>
              <div className="text-caption text-gray-500 mb-2">Medium (500)</div>
              <div className="font-medium text-2xl">The quick brown fox jumps over the lazy dog</div>
            </div>
          </div>
          <div className="space-y-6">
            <div>
              <div className="text-caption text-gray-500 mb-2">Semi-bold (600)</div>
              <div className="font-semibold text-2xl">The quick brown fox jumps over the lazy dog</div>
            </div>
            <div>
              <div className="text-caption text-gray-500 mb-2">Bold (700)</div>
              <div className="font-bold text-2xl">The quick brown fox jumps over the lazy dog</div>
            </div>
            <div>
              <div className="text-caption text-gray-500 mb-2">Extra Bold (800)</div>
              <div className="font-extrabold text-2xl">The quick brown fox jumps over the lazy dog</div>
            </div>
          </div>
        </div>

        {/* Usage Guidelines */}
        <div className="mt-8 p-6 bg-primary-50 rounded-lg border border-primary-200">
          <h4 className="text-heading-sm font-semibold text-primary-900 mb-3">Usage Guidelines</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-body-sm">
            <div>
              <strong className="text-primary-800">Light (300):</strong> Use for large display text and subtle elements
            </div>
            <div>
              <strong className="text-primary-800">Regular (400):</strong> Default weight for body text and most UI elements
            </div>
            <div>
              <strong className="text-primary-800">Medium (500):</strong> For emphasis and secondary headings
            </div>
            <div>
              <strong className="text-primary-800">Semi-bold (600):</strong> Primary headings and important UI elements
            </div>
            <div>
              <strong className="text-primary-800">Bold (700):</strong> Strong emphasis and primary actions
            </div>
          </div>
        </div>
      </div>

      {/* Typography Scale */}
      <div className="bg-white rounded-xl p-8 border border-gray-200 shadow-soft">
        <h2 className="text-display-md mb-8">Typography Scale</h2>

        {/* Display Sizes */}
        <div className="space-y-8 mb-12">
          <h3 className="text-heading-lg mb-6">Display Text</h3>
          <div className="space-y-6">
            <div className="border-b border-gray-100 pb-6">
              <div className="flex items-baseline justify-between mb-2">
                <div className="text-caption text-gray-500">Display 2XL</div>
                <div className="text-caption text-gray-400">4.5rem / 72px</div>
              </div>
              <div className="text-display-2xl">Almost before we knew it, we had left the ground.</div>
            </div>

            <div className="border-b border-gray-100 pb-6">
              <div className="flex items-baseline justify-between mb-2">
                <div className="text-caption text-gray-500">Display XL</div>
                <div className="text-caption text-gray-400">3.75rem / 60px</div>
              </div>
              <div className="text-display-xl">Almost before we knew it, we had left the ground.</div>
            </div>

            <div className="border-b border-gray-100 pb-6">
              <div className="flex items-baseline justify-between mb-2">
                <div className="text-caption text-gray-500">Display LG</div>
                <div className="text-caption text-gray-400">3rem / 48px</div>
              </div>
              <div className="text-display-lg">Almost before we knew it, we had left the ground.</div>
            </div>

            <div className="border-b border-gray-100 pb-6">
              <div className="flex items-baseline justify-between mb-2">
                <div className="text-caption text-gray-500">Display MD</div>
                <div className="text-caption text-gray-400">2.25rem / 36px</div>
              </div>
              <div className="text-display-md">Almost before we knew it, we had left the ground.</div>
            </div>

            <div className="pb-6">
              <div className="flex items-baseline justify-between mb-2">
                <div className="text-caption text-gray-500">Display SM</div>
                <div className="text-caption text-gray-400">1.875rem / 30px</div>
              </div>
              <div className="text-display-sm">Almost before we knew it, we had left the ground.</div>
            </div>
          </div>
        </div>

        {/* Heading Sizes */}
        <div className="space-y-8 mb-12">
          <h3 className="text-heading-lg mb-6">Headings</h3>
          <div className="space-y-6">
            <div className="border-b border-gray-100 pb-4">
              <div className="flex items-baseline justify-between mb-2">
                <div className="text-caption text-gray-500">Heading LG</div>
                <div className="text-caption text-gray-400">1.25rem / 20px</div>
              </div>
              <div className="text-heading-lg">Almost before we knew it, we had left the ground.</div>
            </div>

            <div className="border-b border-gray-100 pb-4">
              <div className="flex items-baseline justify-between mb-2">
                <div className="text-caption text-gray-500">Heading MD</div>
                <div className="text-caption text-gray-400">1.125rem / 18px</div>
              </div>
              <div className="text-heading-md">Almost before we knew it, we had left the ground.</div>
            </div>

            <div className="pb-4">
              <div className="flex items-baseline justify-between mb-2">
                <div className="text-caption text-gray-500">Heading SM</div>
                <div className="text-caption text-gray-400">1rem / 16px</div>
              </div>
              <div className="text-heading-sm">Almost before we knew it, we had left the ground.</div>
            </div>
          </div>
        </div>

        {/* Body Text */}
        <div className="space-y-8">
          <h3 className="text-heading-lg mb-6">Body Text</h3>
          <div className="space-y-6">
            <div className="border-b border-gray-100 pb-4">
              <div className="flex items-baseline justify-between mb-2">
                <div className="text-caption text-gray-500">Body LG</div>
                <div className="text-caption text-gray-400">1.125rem / 18px</div>
              </div>
              <div className="text-body-lg max-w-2xl">
                Almost before we knew it, we had left the ground. The sky was a deep, unchanging blue, and the sun beat down with an intensity that made the air shimmer.
              </div>
            </div>

            <div className="border-b border-gray-100 pb-4">
              <div className="flex items-baseline justify-between mb-2">
                <div className="text-caption text-gray-500">Body MD</div>
                <div className="text-caption text-gray-400">1rem / 16px</div>
              </div>
              <div className="text-body-md max-w-2xl">
                Almost before we knew it, we had left the ground. The sky was a deep, unchanging blue, and the sun beat down with an intensity that made the air shimmer.
              </div>
            </div>

            <div className="border-b border-gray-100 pb-4">
              <div className="flex items-baseline justify-between mb-2">
                <div className="text-caption text-gray-500">Body SM</div>
                <div className="text-caption text-gray-400">0.875rem / 14px</div>
              </div>
              <div className="text-body-sm max-w-2xl">
                Almost before we knew it, we had left the ground. The sky was a deep, unchanging blue, and the sun beat down with an intensity that made the air shimmer.
              </div>
            </div>

            <div className="pb-4">
              <div className="flex items-baseline justify-between mb-2">
                <div className="text-caption text-gray-500">Caption</div>
                <div className="text-caption text-gray-400">0.75rem / 12px</div>
              </div>
              <div className="text-caption max-w-2xl">
                Almost before we knew it, we had left the ground. The sky was a deep, unchanging blue, and the sun beat down with an intensity that made the air shimmer.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Real-world Examples */}
      <div className="bg-white rounded-xl p-8 border border-gray-200 shadow-soft">
        <h2 className="text-display-md mb-8">Real-world Examples</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Article Example */}
          <div className="space-y-4">
            <h3 className="text-heading-sm font-semibold text-gray-700">Article Layout</h3>
            <div className="border border-gray-200 rounded-lg p-6 space-y-4">
              <h1 className="text-display-lg">The Future of Design Systems</h1>
              <p className="text-body-md text-gray-600">
                Design systems have evolved from simple style guides to comprehensive frameworks that power entire product ecosystems.
              </p>
              <div className="space-y-2">
                <h2 className="text-heading-lg">Core Principles</h2>
                <p className="text-body-md">
                  At their foundation, design systems emphasize consistency, scalability, and maintainability across teams and products.
                </p>
                <h3 className="text-heading-md">Systematic Approach</h3>
                <p className="text-body-sm">
                  Every component follows predictable patterns, ensuring that new features integrate seamlessly with existing designs.
                </p>
              </div>
            </div>
          </div>

          {/* Dashboard Example */}
          <div className="space-y-4">
            <h3 className="text-heading-sm font-semibold text-gray-700">Dashboard Layout</h3>
            <div className="border border-gray-200 rounded-lg p-6 space-y-6">
              <div>
                <h1 className="text-display-md mb-2">Analytics Dashboard</h1>
                <p className="text-body-sm text-gray-600">Monitor your key metrics and performance indicators</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-primary-50 p-4 rounded-lg">
                  <div className="text-heading-sm font-semibold text-primary-900">Total Users</div>
                  <div className="text-display-sm font-bold text-primary-600">12,847</div>
                  <div className="text-caption text-primary-700">+12.5% from last month</div>
                </div>

                <div className="bg-success-50 p-4 rounded-lg">
                  <div className="text-heading-sm font-semibold text-success-900">Revenue</div>
                  <div className="text-display-sm font-bold text-success-600">$45,231</div>
                  <div className="text-caption text-success-700">+8.2% from last month</div>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <h2 className="text-heading-md">Recent Activity</h2>
                <button className="text-body-sm text-primary-600 hover:text-primary-700">View all</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Code Examples */}
      <div className="bg-gray-50 rounded-xl p-8">
        <h2 className="text-display-md mb-8">Implementation</h2>

        <div className="space-y-6">
          <div>
            <h3 className="text-heading-md mb-4">CSS Classes</h3>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <pre className="text-sm overflow-x-auto">
{`/* Display Text */
<h1 className="text-display-2xl">Hero Title</h1>
<h2 className="text-display-xl">Section Title</h2>

/* Headings */
<h3 className="text-heading-lg">Large Heading</h3>
<h4 className="text-heading-md">Medium Heading</h4>
<h5 className="text-heading-sm">Small Heading</h5>

/* Body Text */
<p className="text-body-lg">Large body text</p>
<p className="text-body-md">Regular body text</p>
<p className="text-body-sm">Small body text</p>

/* Font Weights */
<p className="font-light">Light weight</p>
<p className="font-normal">Normal weight</p>
<p className="font-medium">Medium weight</p>
<p className="font-semibold">Semi-bold weight</p>
<p className="font-bold">Bold weight</p>`}
              </pre>
            </div>
          </div>

          <div>
            <h3 className="text-heading-md mb-4">Tailwind Classes</h3>
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <pre className="text-sm overflow-x-auto">
{`/* Font Family */
<p className="font-sans">Inter (default)</p>
<code className="font-mono">JetBrains Mono</code>

/* Font Size Scale */
<p className="text-xs">Extra small (12px)</p>
<p className="text-sm">Small (14px)</p>
<p className="text-base">Base (16px)</p>
<p className="text-lg">Large (18px)</p>
<p className="text-xl">Extra large (20px)</p>
<p className="text-2xl">2X large (24px)</p>
<p className="text-3xl">3X large (30px)</p>
<p className="text-4xl">4X large (36px)</p>
<p className="text-5xl">5X large (48px)</p>
<p className="text-6xl">6X large (60px)</p>`}
              </pre>
            </div>
          </div>
        </div>
      </div>

      {/* Accessibility Notes */}
      <div className="bg-warning-50 rounded-xl p-8 border border-warning-200">
        <h2 className="text-display-md mb-6 text-warning-900">Accessibility Considerations</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <h3 className="text-heading-sm font-semibold text-warning-800 mb-3">Contrast Ratios</h3>
            <ul className="space-y-2 text-body-sm text-warning-700">
              <li>• Display text: Minimum 4.5:1 contrast ratio</li>
              <li>• Body text: Minimum 4.5:1 contrast ratio</li>
              <li>• Large text (18pt+): Minimum 3:1 contrast ratio</li>
              <li>• All text meets WCAG AA standards</li>
            </ul>
          </div>

          <div>
            <h3 className="text-heading-sm font-semibold text-warning-800 mb-3">Best Practices</h3>
            <ul className="space-y-2 text-body-sm text-warning-700">
              <li>• Use semantic heading hierarchy (h1-h6)</li>
              <li>• Maintain consistent line heights</li>
              <li>• Ensure adequate spacing between elements</li>
              <li>• Test readability across different devices</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

const meta = {
  title: 'Design System/Typography',
  component: TypographyShowcase,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: 'Comprehensive typography showcase demonstrating Inter font family, weights, sizes, and usage guidelines for the Linear-inspired design system.'
      }
    }
  },
  tags: ['autodocs'],
} satisfies Meta<typeof TypographyShowcase>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Overview: Story = {
  render: () => <TypographyShowcase />,
};

// Individual Typography Components for Reference
export const FontWeights: Story = {
  render: () => (
    <div className="p-8 space-y-8 max-w-4xl mx-auto">
      <h1 className="text-display-md mb-8">Font Weights</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="text-caption text-gray-500 mb-2">Light (300)</div>
            <div className="font-light text-3xl">Sphinx of black quartz, judge my vow</div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="text-caption text-gray-500 mb-2">Regular (400)</div>
            <div className="font-normal text-3xl">Sphinx of black quartz, judge my vow</div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="text-caption text-gray-500 mb-2">Medium (500)</div>
            <div className="font-medium text-3xl">Sphinx of black quartz, judge my vow</div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="text-caption text-gray-500 mb-2">Semi-bold (600)</div>
            <div className="font-semibold text-3xl">Sphinx of black quartz, judge my vow</div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="text-caption text-gray-500 mb-2">Bold (700)</div>
            <div className="font-bold text-3xl">Sphinx of black quartz, judge my vow</div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="text-caption text-gray-500 mb-2">Extra Bold (800)</div>
            <div className="font-extrabold text-3xl">Sphinx of black quartz, judge my vow</div>
          </div>
        </div>
      </div>
    </div>
  ),
};

export const TextSizes: Story = {
  render: () => (
    <div className="p-8 space-y-8 max-w-4xl mx-auto">
      <h1 className="text-display-md mb-8">Typography Scale</h1>

      <div className="space-y-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-baseline justify-between mb-2">
            <div className="text-caption text-gray-500">Display 2XL</div>
            <div className="text-caption text-gray-400">4.5rem / 72px</div>
          </div>
          <div className="text-display-2xl">The five boxing wizards jump quickly</div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-baseline justify-between mb-2">
            <div className="text-caption text-gray-500">Display XL</div>
            <div className="text-caption text-gray-400">3.75rem / 60px</div>
          </div>
          <div className="text-display-xl">The five boxing wizards jump quickly</div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-baseline justify-between mb-2">
            <div className="text-caption text-gray-500">Display LG</div>
            <div className="text-caption text-gray-400">3rem / 48px</div>
          </div>
          <div className="text-display-lg">The five boxing wizards jump quickly</div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-baseline justify-between mb-2">
            <div className="text-caption text-gray-500">Display MD</div>
            <div className="text-caption text-gray-400">2.25rem / 36px</div>
          </div>
          <div className="text-display-md">The five boxing wizards jump quickly</div>
        </div>

        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="flex items-baseline justify-between mb-2">
            <div className="text-caption text-gray-500">Display SM</div>
            <div className="text-caption text-gray-400">1.875rem / 30px</div>
          </div>
          <div className="text-display-sm">The five boxing wizards jump quickly</div>
        </div>
      </div>
    </div>
  ),
};
