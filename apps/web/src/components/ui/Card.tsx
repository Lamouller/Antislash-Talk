import React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

const cardVariants = cva(
  'transition-all duration-200',
  {
    variants: {
      variant: {
        default: 'bg-white/20 backdrop-blur-xl border border-gray-300/30 shadow-lg shadow-black/5 rounded-2xl',
        glass: 'bg-gray-100/20 backdrop-blur-xl border border-gray-200/30 shadow-lg shadow-black/5 rounded-2xl',
        solid: 'bg-white border border-gray-200 shadow-lg shadow-black/5 rounded-2xl',
        outline: 'bg-transparent border-2 border-gray-300 rounded-2xl',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

// Card
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof cardVariants>
>(({ className, variant, ...props }, ref) => (
  <div
    ref={ref}
    className={cardVariants({ variant, className })}
    {...props}
  />
));
Card.displayName = 'Card';

// CardHeader
const CardHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={`p-6 ${className || ''}`}
    {...props}
  />
));
CardHeader.displayName = 'CardHeader';

// CardTitle
const CardTitle = React.forwardRef<
  HTMLHeadingElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={`text-lg font-semibold text-black ${className || ''}`}
    {...props}
  />
));
CardTitle.displayName = 'CardTitle';

// CardDescription
const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={`text-sm text-gray-500 ${className || ''}`}
    {...props}
  />
));
CardDescription.displayName = 'CardDescription';

// CardContent
const CardContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={`p-6 pt-0 ${className || ''}`}
    {...props}
  />
));
CardContent.displayName = 'CardContent';

// CardFooter
const CardFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={`p-6 pt-0 flex items-center ${className || ''}`}
    {...props}
  />
));
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter, cardVariants };
