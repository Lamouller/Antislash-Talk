import React from 'react';

const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={`bg-white dark:bg-gray-800 shadow-md rounded-lg p-6 ${className}`}
    {...props}
  />
));
Card.displayName = 'Card';

export { Card };