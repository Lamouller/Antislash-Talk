import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-black text-white shadow-lg shadow-black/10 hover:bg-gray-800 active:scale-[0.98]',
        primary: 'bg-black text-white shadow-lg shadow-black/10 hover:bg-gray-800 active:scale-[0.98]',
        destructive: 'bg-red-600 text-white shadow-sm hover:bg-red-700 active:scale-[0.98]',
        danger: 'bg-red-600 text-white shadow-sm hover:bg-red-700 active:scale-[0.98]',
        outline: 'border-2 border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:border-gray-300 active:scale-[0.98]',
        secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:scale-[0.98]',
        ghost: 'text-gray-600 hover:bg-gray-100 hover:text-black',
        glass: 'bg-white/20 backdrop-blur-md border border-gray-300/30 text-gray-700 shadow-sm hover:bg-white/40 active:scale-[0.98]',
      },
      size: {
        default: 'h-11 px-6 rounded-xl text-sm',
        sm: 'h-9 px-4 rounded-lg text-sm',
        small: 'h-9 px-4 rounded-lg text-sm',
        md: 'h-11 px-6 rounded-xl text-sm',
        medium: 'h-11 px-6 rounded-xl text-sm',
        lg: 'h-12 px-8 rounded-xl text-base',
        large: 'h-12 px-8 rounded-xl text-base',
        icon: 'h-10 w-10 rounded-xl',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  loadingText?: string;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant,
      size,
      isLoading,
      leftIcon,
      rightIcon,
      loadingText,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <button
        className={buttonVariants({ variant, size, className })}
        disabled={isLoading}
        ref={ref}
        {...props}
      >
        {isLoading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-current" />
            {loadingText || 'Loading...'}
          </>
        ) : (
          <>
            {leftIcon}
            {children}
            {rightIcon}
          </>
        )}
      </button>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
