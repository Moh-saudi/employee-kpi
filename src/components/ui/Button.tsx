import { ReactNode } from 'react';

interface ButtonProps {
  children: ReactNode;
  variant?: 'primary' | 'secondary';
  type?: 'button' | 'submit' | 'reset';
  onClick?: () => void;
  className?: string;
  icon?: ReactNode;
}

export default function Button({ 
  children, 
  variant = 'primary', 
  type = 'button',
  onClick,
  className = '',
  icon
}: ButtonProps) {
  const baseStyles = 'px-4 py-2 rounded-md font-medium transition-colors flex items-center gap-2';
  const variantStyles = {
    primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
    secondary: 'bg-gray-200 text-gray-800 hover:bg-gray-300'
  };

  return (
    <button
      type={type}
      onClick={onClick}
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
    >
      {icon}
      {children}
    </button>
  );
} 