import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

const Input = React.forwardRef(
  (
    {
      label,
      type = 'text',
      error,
      icon,
      className = '',
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';
    const inputType = isPassword ? (showPassword ? 'text' : 'password') : type;

    return (
      <div className="mb-4 group">
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-600 transition-colors duration-200">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            type={inputType}
            className={`
              w-full px-4 py-2.5 border rounded-xl text-slate-700 placeholder-slate-400 bg-white
              transition-all duration-200 ease-in-out
              focus:outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10
              ${error ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : 'border-slate-200 hover:border-slate-300'}
              ${icon ? 'pl-11' : ''}
              ${isPassword ? 'pr-11' : ''}
              ${className}
            `}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          )}
        </div>
        {error && (
          <p className="mt-1 text-sm text-red-600">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;