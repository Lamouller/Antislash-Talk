import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:opacity-50 disabled:pointer-events-none backdrop-blur-glass',
  {
    variants: {
      variant: {
        primary: 'bg-white/90 text-black border border-white hover:bg-white hover:shadow-glass-lg hover:-translate-y-0.5',
        secondary: 'bg-white/5 text-white/90 border border-white/10 hover:bg-white/8 hover:border-white/15 hover:-translate-y-0.5',
        outline: 'border border-white/10 text-white/90 hover:bg-white/5 hover:border-white/15',
        danger: 'bg-red-500/90 text-white border border-red-500 hover:bg-red-500 hover:shadow-glass-lg',
        ghost: 'text-white/90 hover:bg-white/5 hover:text-white',
      },
      size: {
        small: 'h-9 px-3 text-xs',
        medium: 'h-10 py-2 px-4',
        large: 'h-11 px-8 text-base',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'medium',
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
            <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-current mr-2" />
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
