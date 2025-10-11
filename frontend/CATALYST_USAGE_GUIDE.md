# 🚀 Catalyst UI Components Usage Guide

## Overview

Your Catalyst UI kit is now properly integrated with TypeScript support! This guide shows you how to use all 25+ components in your application.

## ✅ What's Working

- ✅ **TypeScript Declarations**: All JSX components now have proper TypeScript support
- ✅ **Storybook Integration**: Components are available in Storybook with live demos
- ✅ **Full Component Library**: 25+ production-ready components
- ✅ **Accessibility**: Built with Headless UI for comprehensive accessibility
- ✅ **Modern Design**: Professional appearance with 20+ color variants

## 🎯 Quick Start

### 1. Import Components

```tsx
// Import any Catalyst component with full TypeScript support
import { Button, TouchTarget } from '../components/Catalyst/button';
import { Input, InputGroup } from '../components/Catalyst/input';
import { Card, CardHeader, CardTitle } from '../components/Catalyst/card';
```

### 2. Use in Your Components

```tsx
function MyComponent() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>My Title</CardTitle>
      </CardHeader>
      <Button color="blue">Click me</Button>
    </Card>
  );
}
```

## 📚 Component Categories

### 🎨 **Buttons (20+ Variants)**
```tsx
// Solid colors
<Button color="blue">Primary</Button>
<Button color="green">Success</Button>
<Button color="red">Danger</Button>

// Styles
<Button>Solid</Button>
<Button outline>Outline</Button>
<Button plain>Plain</Button>

// With icons
<Button>
  <svg className="w-4 h-4" data-slot="icon">...</svg>
  Download
</Button>
```

### 📝 **Form Components**
```tsx
// Input with icon
<InputGroup>
  <svg className="w-5 h-5" data-slot="icon">...</svg>
  <Input type="search" placeholder="Search..." />
</InputGroup>

// Select dropdown
<SelectField>
  <Select placeholder="Choose option">
    <option>Option 1</option>
    <option>Option 2</option>
  </Select>
</SelectField>

// Checkbox
<CheckboxField>
  <Checkbox />
  <span>Agree to terms</span>
</CheckboxField>

// Textarea
<TextareaField>
  <Textarea rows={4} placeholder="Message..." />
</TextareaField>
```

### 📊 **Data Display**
```tsx
// Badges
<Badge color="blue">Primary</Badge>
<Badge color="green">Success</Badge>

// Cards
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>Content</CardContent>
  <CardFooter><Button>Action</Button></CardFooter>
</Card>

// Tables
<Table>
  <TableHead>
    <TableRow>
      <TableHeader>Name</TableHeader>
      <TableHeader>Email</TableHeader>
    </TableRow>
  </TableHead>
  <TableBody>
    <TableRow>
      <TableCell>John Doe</TableCell>
      <TableCell>john@example.com</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

### 🎛️ **Interactive Components**
```tsx
// Dialog/Modal
<Dialog>
  <DialogPanel>
    <DialogTitle>Confirm Action</DialogTitle>
    <DialogDescription>Are you sure?</DialogDescription>
    <div className="flex gap-3">
      <Button plain>Cancel</Button>
      <Button color="red">Delete</Button>
    </div>
  </DialogPanel>
</Dialog>

// Dropdown
<Dropdown>
  <DropdownButton>Options</DropdownButton>
  <DropdownMenu>
    <DropdownItem>Edit</DropdownItem>
    <DropdownItem>Delete</DropdownItem>
  </DropdownMenu>
</Dropdown>
```

## 🎨 Customization

### CSS Custom Properties
Catalyst components use CSS custom properties for theming:

```css
:root {
  --color-primary: 59 130 246;    /* Blue-500 */
  --color-surface: 255 255 255;   /* White */
  --shadow-soft: 0 2px 15px -3px rgba(0, 0, 0, 0.07);
}
```

### Color Variants
Available colors for most components:
- `dark/zinc`, `dark/white`, `light`, `dark`
- `zinc`, `blue`, `green`, `red`, `orange`, `amber`, `yellow`
- `lime`, `emerald`, `teal`, `sky`, `indigo`, `violet`, `purple`
- `fuchsia`, `pink`, `rose`

## 🏗️ Layout Components

### Application Layout
```tsx
import { ApplicationLayout } from '../components/Catalyst/application-layout';

<ApplicationLayout>
  {/* Your app content */}
</ApplicationLayout>
```

### Sidebar Layout
```tsx
import { SidebarLayout, Sidebar } from '../components/Catalyst/sidebar-layout';

<SidebarLayout>
  <Sidebar>
    {/* Navigation */}
  </Sidebar>
  <main>
    {/* Main content */}
  </main>
</SidebarLayout>
```

### Auth Layout
```tsx
import { AuthLayout } from '../components/Catalyst/auth-layout';

<AuthLayout>
  <div className="mx-auto max-w-md">
    {/* Login/Register form */}
  </div>
</AuthLayout>
```

## 🔧 Advanced Features

### Touch Targets
All interactive elements include proper touch targets:

```tsx
<Button>
  <TouchTarget>Mobile-friendly button</TouchTarget>
</Button>
```

### Icon Slots
Components support icon slots with `data-slot="icon"`:

```tsx
<InputGroup>
  <svg className="w-5 h-5" data-slot="icon">...</svg>
  <Input type="search" />
</InputGroup>
```

### Accessibility
- ✅ **Keyboard Navigation**: Full keyboard support
- ✅ **Screen Reader**: ARIA labels and roles
- ✅ **Focus Management**: Visible focus indicators
- ✅ **Touch Targets**: Minimum 44px for mobile

## 📖 Storybook Documentation

Visit your Storybook at `http://localhost:6006` to see:

- **Catalyst UI/Showcase**: Complete component overview
- **Catalyst UI/Button Variants**: All button styles
- **Catalyst UI/Form Components**: Form examples
- **Catalyst UI/Data Display**: Tables and badges

## 🚀 Production Usage

### Import Strategy
```tsx
// Individual imports (recommended)
import { Button } from '../components/Catalyst/button';
import { Input } from '../components/Catalyst/input';

// Or namespace imports
import * as Catalyst from '../components/Catalyst';
// Then use: <Catalyst.Button>
```

### TypeScript Support
All components have full TypeScript support:

```tsx
interface MyProps {
  onSubmit: (data: FormData) => void;
}

function MyForm({ onSubmit }: MyProps) {
  return (
    <form onSubmit={onSubmit}>
      <Input type="email" required />
      <Button type="submit" color="blue">Submit</Button>
    </form>
  );
}
```

## 🎯 Best Practices

### 1. Use Semantic HTML
```tsx
// ✅ Good
<Card>
  <CardHeader>
    <CardTitle>Product Title</CardTitle>
  </CardHeader>
</Card>

// ❌ Avoid
<div className="card">
  <div className="card-header">
    <h3>Product Title</h3>
  </div>
</div>
```

### 2. Leverage Variants
```tsx
// ✅ Use semantic colors
<Button color="green">Save Changes</Button>
<Button color="red">Delete Item</Button>

// ❌ Avoid generic colors
<Button className="bg-green-500">Save Changes</Button>
```

### 3. Icon Integration
```tsx
// ✅ Use data-slot for icons
<Button>
  <svg data-slot="icon" className="w-4 h-4">...</svg>
  Download
</Button>

// ❌ Avoid custom icon classes
<Button>
  <svg className="w-4 h-4 mr-2">...</svg>
  Download
</Button>
```

## 🔧 Troubleshooting

### TypeScript Errors
If you get TypeScript errors:
1. Check that `src/types/catalyst.d.ts` is included in `tsconfig.json`
2. Restart your TypeScript server
3. Clear node_modules and reinstall if needed

### Styling Issues
If components don't look right:
1. Ensure Tailwind CSS is properly configured
2. Check that CSS custom properties are defined
3. Verify the component is wrapped in proper containers

### Import Errors
If imports fail:
1. Check file paths are correct
2. Ensure components are exported properly
3. Verify TypeScript declarations match actual exports

## 📚 Resources

- **Storybook**: `http://localhost:6006`
- **Component Source**: `/src/components/Catalyst/`
- **TypeScript Declarations**: `/src/types/catalyst.d.ts`
- **Tailwind Config**: `/tailwind.config.ts`

## 🎉 You're All Set!

Your Catalyst UI components are now fully integrated and ready to use! They provide:

- ✅ **Professional Design**: Modern, polished appearance
- ✅ **Full Accessibility**: WCAG compliant with keyboard navigation
- ✅ **TypeScript Support**: Complete type safety
- ✅ **Responsive Design**: Mobile-first approach
- ✅ **Extensive Variants**: 20+ colors and styles per component
- ✅ **Production Ready**: Built with Headless UI and Tailwind CSS

Start using them in your application and enjoy the professional component library! 🚀
