import React from 'react';

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    variant?: 'default' | 'strong';
  }
>(({ className = '', variant = 'default', ...props }, ref) => {
  const baseClass = variant === 'strong' ? 'glass-card-strong' : 'glass-card';

  return (
    <div
      ref={ref}
      className={`${baseClass} ${className}`}
      {...props}
    />
  );
});
Card.displayName = 'Card';

export { Card };
