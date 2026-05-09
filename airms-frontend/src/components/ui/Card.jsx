import React from 'react';

const Card = ({ children, className = '', padding = true }) => {
  return (
    <div className={`bg-white rounded-lg shadow-md ${padding ? 'p-6' : ''} ${className}`}>
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className = '' }) => {
  return (
    <div className={`border-b border-gray-200 pb-4 mb-4 ${className}`}>
      {children}
    </div>
  );
};

export const CardTitle = ({ children, className = '' }) => {
  return (
    <h3 className={`text-lg font-semibold text-gray-900 ${className}`}>
      {children}
    </h3>
  );
};

export const CardContent = ({ children, className = '' }) => {
  return <div className={className}>{children}</div>;
};

export const CardFooter = ({ children, className = '' }) => {
  return (
    <div className={`border-t border-gray-200 pt-4 mt-4 ${className}`}>
      {children}
    </div>
  );
};

export default Card;