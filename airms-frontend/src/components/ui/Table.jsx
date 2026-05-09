import React from 'react';

const Table = ({ children, className = '', overflowVisible = false }) => {
  return (
    <div className={overflowVisible ? '' : 'overflow-x-auto'}>
      <table className={`min-w-full divide-y divide-gray-200 ${className}`}>
        {children}
      </table>
    </div>
  );
};

export const TableHead = ({ children, className = '' }) => {
  return (
    <thead className={`bg-gray-50 ${className}`}>
      <tr>{children}</tr>
    </thead>
  );
};

export const TableHeader = ({ children, className = '' }) => {
  return (
    <th
      scope="col"
      className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${className}`}
    >
      {children}
    </th>
  );
};

export const TableBody = ({ children }) => {
  return <tbody className="bg-white divide-y divide-gray-200">{children}</tbody>;
};

export const TableRow = ({ children, className = '', onClick }) => {
  return (
    <tr
      className={`hover:bg-gray-50 ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </tr>
  );
};

export const TableCell = ({ children, className = '' }) => {
  return (
    <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 ${className}`}>
      {children}
    </td>
  );
};

export default Table;