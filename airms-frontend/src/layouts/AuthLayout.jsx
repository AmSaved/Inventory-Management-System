import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

const AuthLayout = ({ children, title, subtitle }) => {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Optional decorative element to match the dashboard's Navy feel */}
      <div className="absolute top-0 left-0 right-0 h-2 bg-slate-900" />
      
      <div className="max-w-md w-full space-y-8 relative z-10">
        {/* Logo and Title */}
        <div className="text-center">
          <Link to="/" className="inline-block group">
            <div className="flex justify-center">
              <div className="h-20 w-20 bg-blue-600 rounded-3xl flex items-center justify-center shadow-xl shadow-blue-500/20 rotate-3 group-hover:rotate-0 transition-all duration-500">
                <ShieldCheck className="h-10 w-10 text-white" />
              </div>
            </div>
          </Link>
          <h2 className="mt-8 text-4xl font-black text-gray-900 uppercase italic tracking-tighter">{title}</h2>
          {subtitle && (
            <p className="mt-2 text-[11px] font-black text-blue-600 uppercase tracking-[0.3em] opacity-80">{subtitle}</p>
          )}
        </div>

        {/* Form Card */}
        <div className="bg-white py-10 px-8 shadow-2xl shadow-gray-200/50 rounded-[2.5rem] border border-gray-100 sm:px-12">
          {children}
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-600">
          &copy; {new Date().getFullYear()} AIRMS. All rights reserved.
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;