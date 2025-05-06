declare module '@/components/layout/Header' {
  import { FC } from 'react';
  export const Header: FC;
}

declare module '@/components/ui/Input' {
  import { FC, InputHTMLAttributes } from 'react';
  interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
  }
  export const Input: FC<InputProps>;
}

declare module '@/components/ui/Select' {
  import { FC, SelectHTMLAttributes } from 'react';
  interface SelectOption {
    value: string;
    label: string;
  }
  interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    error?: string;
    options: SelectOption[];
  }
  export const Select: FC<SelectProps>;
} 