import React from 'react';

const Table = ({ children, className = '', overflowVisible = false }) => {
  return (
    <div className={`bg-white rounded-xl border border-slate-100 shadow-sm ${overflowVisible ? '' : 'overflow-x-auto'}`}>
      <table className={`w-full text-left divide-y divide-slate-100 ${className}`}>
        {children}
      </table>
    </div>
  );
};

export const TableHead = ({ children, className = '' }) => {
  return (
    <thead className={`bg-green-600 text-white ${className}`}>
      <tr>{children}</tr>
    </thead>
  );
};

export const TableHeader = ({ children, className = '' }) => {
  return (
    <th
      scope="col"
      className={`p-4 text-sm font-bold ${className}`}
    >
      {children}
    </th>
  );
};

export const TableBody = ({ children }) => {
  return <tbody className="bg-white divide-y divide-slate-100">{children}</tbody>;
};

export const TableRow = ({ children, className = '', onClick }) => {
  return (
    <tr
      className={`hover:bg-slate-50/50 transition-colors ${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </tr>
  );
};

export const TableCell = ({ children, className = '' }) => {
  return (
    <td className={`p-4 text-sm text-slate-600 ${className}`}>
      {children}
    </td>
  );
};

export default Table;