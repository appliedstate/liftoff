// TypeScript declarations for Catalyst UI JSX components
declare module '../components/Catalyst/button' {
  import React from 'react';

  export interface ButtonProps {
    color?: 'dark/zinc' | 'dark/white' | 'light' | 'dark' | 'zinc' | 'indigo' | 'cyan' | 'red' | 'orange' | 'amber' | 'yellow' | 'lime' | 'green' | 'emerald' | 'teal' | 'sky' | 'blue' | 'violet' | 'purple' | 'fuchsia' | 'pink' | 'rose';
    outline?: boolean;
    plain?: boolean;
    className?: string;
    children?: React.ReactNode;
    href?: string;
    disabled?: boolean;
    size?: 'sm' | 'md' | 'lg';
    [key: string]: any;
  }

  export const Button: React.ComponentType<ButtonProps>;
  export const TouchTarget: React.ComponentType<{ children?: React.ReactNode }>;
}

declare module '../components/Catalyst/input' {
  import React from 'react';

  export interface InputProps {
    type?: 'email' | 'number' | 'password' | 'search' | 'tel' | 'text' | 'url' | 'date' | 'datetime-local' | 'month' | 'time' | 'week';
    className?: string;
    placeholder?: string;
    disabled?: boolean;
    [key: string]: any;
  }

  export const Input: React.ComponentType<InputProps>;
  export const InputGroup: React.ComponentType<React.ComponentPropsWithoutRef<'span'>>;
}

declare module '../components/Catalyst/badge' {
  import React from 'react';

  export interface BadgeProps {
    color?: 'zinc' | 'red' | 'orange' | 'amber' | 'yellow' | 'lime' | 'green' | 'emerald' | 'teal' | 'sky' | 'blue' | 'indigo' | 'violet' | 'purple' | 'fuchsia' | 'pink' | 'rose';
    className?: string;
    children?: React.ReactNode;
  }

  export const Badge: React.ComponentType<BadgeProps>;
  export const BadgeButton: React.ComponentType<BadgeProps & { href?: string }>;
}

declare module '../components/Catalyst/link' {
  import React from 'react';

  export interface LinkProps {
    href?: string; // Made optional for React Router integration
    to?: string;   // React Router 'to' prop
    className?: string;
    children: React.ReactNode;
    [key: string]: any;
  }

  export const Link: React.ComponentType<LinkProps>;
}

declare module '../components/Catalyst/card' {
  import React from 'react';

  export interface CardProps {
    className?: string;
    children: React.ReactNode;
    [key: string]: any;
  }

  export const Card: React.ComponentType<CardProps>;
  export const CardHeader: React.ComponentType<CardProps>;
  export const CardTitle: React.ComponentType<CardProps>;
  export const CardDescription: React.ComponentType<CardProps>;
  export const CardContent: React.ComponentType<CardProps>;
  export const CardFooter: React.ComponentType<CardProps>;
}

declare module '../components/Catalyst/dialog' {
  import React from 'react';

  export interface DialogProps {
    className?: string;
    children: React.ReactNode;
    [key: string]: any;
  }

  export const Dialog: React.ComponentType<DialogProps>;
  export const DialogPanel: React.ComponentType<DialogProps>;
  export const DialogTitle: React.ComponentType<DialogProps>;
  export const DialogDescription: React.ComponentType<DialogProps>;
  export const DialogActions: React.ComponentType<DialogProps>;
}

declare module '../components/Catalyst/dropdown' {
  import React from 'react';

  export interface DropdownProps {
    className?: string;
    children: React.ReactNode;
    [key: string]: any;
  }

  export const Dropdown: React.ComponentType<DropdownProps>;
  export const DropdownButton: React.ComponentType<DropdownProps>;
  export const DropdownMenu: React.ComponentType<DropdownProps>;
  export const DropdownItem: React.ComponentType<DropdownProps>;
}

declare module '../components/Catalyst/sidebar-layout' {
  import React from 'react';

  export interface SidebarLayoutProps {
    className?: string;
    children: React.ReactNode;
    [key: string]: any;
  }

  export const SidebarLayout: React.ComponentType<SidebarLayoutProps>;
  export const Sidebar: React.ComponentType<SidebarLayoutProps>;
  export const SidebarHeader: React.ComponentType<SidebarLayoutProps>;
  export const SidebarBody: React.ComponentType<SidebarLayoutProps>;
  export const SidebarFooter: React.ComponentType<SidebarLayoutProps>;
}

declare module '../components/Catalyst/navbar' {
  import React from 'react';

  export interface NavbarProps {
    className?: string;
    children: React.ReactNode;
    [key: string]: any;
  }

  export const Navbar: React.ComponentType<NavbarProps>;
  export const NavbarItem: React.ComponentType<NavbarProps>;
  export const NavbarSection: React.ComponentType<NavbarProps>;
  export const NavbarDivider: React.ComponentType<NavbarProps>;
}

declare module '../components/Catalyst/table' {
  import React from 'react';

  export interface TableProps {
    className?: string;
    children?: React.ReactNode;
    [key: string]: any;
  }

  export const Table: React.ComponentType<TableProps>;
  export const TableHead: React.ComponentType<TableProps>;
  export const TableBody: React.ComponentType<TableProps>;
  export const TableRow: React.ComponentType<TableProps>;
  export const TableHeader: React.ComponentType<TableProps>;
  export const TableCell: React.ComponentType<TableProps>;
}

// Form components
declare module '../components/Catalyst/fieldset' {
  import React from 'react';

  export interface FieldsetProps {
    className?: string;
    children: React.ReactNode;
    [key: string]: any;
  }

  export const Fieldset: React.ComponentType<FieldsetProps>;
  export const Field: React.ComponentType<FieldsetProps>;
  export const FieldGroup: React.ComponentType<FieldsetProps>;
  export const FieldsetLegend: React.ComponentType<FieldsetProps>;
}

declare module '../components/Catalyst/checkbox' {
  import React from 'react';

  export interface CheckboxProps {
    className?: string;
    children?: React.ReactNode;
    checked?: boolean;
    disabled?: boolean;
    [key: string]: any;
  }

  export const Checkbox: React.ComponentType<CheckboxProps>;
  export const CheckboxField: React.ComponentType<CheckboxProps>;
  export const CheckboxGroup: React.ComponentType<CheckboxProps>;
}

declare module '../components/Catalyst/radio' {
  import React from 'react';

  export interface RadioProps {
    className?: string;
    children?: React.ReactNode;
    checked?: boolean;
    disabled?: boolean;
    [key: string]: any;
  }

  export const Radio: React.ComponentType<RadioProps>;
  export const RadioField: React.ComponentType<RadioProps>;
  export const RadioGroup: React.ComponentType<RadioProps>;
}

declare module '../components/Catalyst/select' {
  import React from 'react';

  export interface SelectProps {
    className?: string;
    children: React.ReactNode;
    [key: string]: any;
  }

  export const Select: React.ComponentType<SelectProps>;
  export const SelectField: React.ComponentType<SelectProps>;
}

declare module '../components/Catalyst/textarea' {
  import React from 'react';

  export interface TextareaProps {
    className?: string;
    rows?: number;
    placeholder?: string;
    disabled?: boolean;
    [key: string]: any;
  }

  export const Textarea: React.ComponentType<TextareaProps>;
  export const TextareaField: React.ComponentType<TextareaProps>;
}

// Feedback components
declare module '../components/Catalyst/alert' {
  import React from 'react';

  export interface AlertProps {
    className?: string;
    children: React.ReactNode;
    type?: 'info' | 'success' | 'warning' | 'error';
    [key: string]: any;
  }

  export const Alert: React.ComponentType<AlertProps>;
}

declare module '../components/Catalyst/avatar' {
  import React from 'react';

  export interface AvatarProps {
    className?: string;
    src?: string;
    alt?: string;
    initials?: string;
    [key: string]: any;
  }

  export const Avatar: React.ComponentType<AvatarProps>;
}

declare module '../components/Catalyst/description-list' {
  import React from 'react';

  export interface DescriptionListProps {
    className?: string;
    children: React.ReactNode;
    [key: string]: any;
  }

  export const DescriptionList: React.ComponentType<DescriptionListProps>;
  export const DescriptionTerm: React.ComponentType<DescriptionListProps>;
  export const DescriptionDetails: React.ComponentType<DescriptionListProps>;
}

// Layout components
declare module '../components/Catalyst/divider' {
  import React from 'react';

  export interface DividerProps {
    className?: string;
    [key: string]: any;
  }

  export const Divider: React.ComponentType<DividerProps>;
}

declare module '../components/Catalyst/heading' {
  import React from 'react';

  export interface HeadingProps {
    className?: string;
    children: React.ReactNode;
    level?: 1 | 2 | 3 | 4 | 5 | 6;
    [key: string]: any;
  }

  export const Heading: React.ComponentType<HeadingProps>;
}

declare module '../components/Catalyst/text' {
  import React from 'react';

  export interface TextProps {
    className?: string;
    children: React.ReactNode;
    [key: string]: any;
  }

  export const Text: React.ComponentType<TextProps>;
}

// Navigation components
declare module '../components/Catalyst/pagination' {
  import React from 'react';

  export interface PaginationProps {
    className?: string;
    children?: React.ReactNode;
    [key: string]: any;
  }

  export const Pagination: React.ComponentType<PaginationProps>;
  export const PaginationList: React.ComponentType<PaginationProps>;
  export const PaginationItem: React.ComponentType<PaginationProps>;
  export const PaginationGap: React.ComponentType<PaginationProps>;
  export const PaginationPrevious: React.ComponentType<PaginationProps>;
  export const PaginationNext: React.ComponentType<PaginationProps>;
}

// Utility components
declare module '../components/Catalyst/combobox' {
  import React from 'react';

  export interface ComboboxProps {
    className?: string;
    children: React.ReactNode;
    [key: string]: any;
  }

  export const Combobox: React.ComponentType<ComboboxProps>;
  export const ComboboxField: React.ComponentType<ComboboxProps>;
  export const ComboboxOption: React.ComponentType<ComboboxProps>;
}

declare module '../components/Catalyst/listbox' {
  import React from 'react';

  export interface ListboxProps {
    className?: string;
    children: React.ReactNode;
    [key: string]: any;
  }

  export const Listbox: React.ComponentType<ListboxProps>;
  export const ListboxField: React.ComponentType<ListboxProps>;
  export const ListboxOption: React.ComponentType<ListboxProps>;
}

declare module '../components/Catalyst/stacked-layout' {
  import React from 'react';

  export interface StackedLayoutProps {
    className?: string;
    children: React.ReactNode;
    [key: string]: any;
  }

  export const StackedLayout: React.ComponentType<StackedLayoutProps>;
}

declare module '../components/Catalyst/application-layout' {
  import React from 'react';

  export interface ApplicationLayoutProps {
    className?: string;
    children: React.ReactNode;
    [key: string]: any;
  }

  export const ApplicationLayout: React.ComponentType<ApplicationLayoutProps>;
}

declare module '../components/Catalyst/auth-layout' {
  import React from 'react';

  export interface AuthLayoutProps {
    className?: string;
    children: React.ReactNode;
    [key: string]: any;
  }

  export const AuthLayout: React.ComponentType<AuthLayoutProps>;
}

declare module '../components/Catalyst/switch' {
  import React from 'react';

  export interface SwitchProps {
    className?: string;
    checked?: boolean;
    disabled?: boolean;
    [key: string]: any;
  }

  export const Switch: React.ComponentType<SwitchProps>;
  export const SwitchField: React.ComponentType<SwitchProps>;
}
