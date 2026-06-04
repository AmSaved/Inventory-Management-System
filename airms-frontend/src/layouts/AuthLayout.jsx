import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import loginIllustration from '../assets/images/login-illustration.png';

const AuthLayout = ({ children, title, subtitle }) => {
  return (
    <div className="min-h-screen bg-slate-50 flex lg:grid lg:grid-cols-12 overflow-hidden font-sans">
      <style>{`
        @keyframes gradientFlow {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
          100% { transform: translateY(0px); }
        }
        .animate-gradient-flow {
          background: linear-gradient(-45deg, #050e14, #044b36, #1d4ed8, #0e7490, #0c1a30);
          background-size: 400% 400%;
          animation: gradientFlow 15s ease infinite;
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
      `}</style>
      
      {/* LEFT SIDE: Beautiful Illustration & Smooth Animated Color Flow */}
      <div className="hidden lg:flex lg:col-span-6 animate-gradient-flow relative flex-col items-center justify-center p-16 text-white overflow-hidden">
        {/* Abstract Glowing Orbs */}
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-emerald-500/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-blue-500/5 blur-[100px] pointer-events-none" />

        {/* Center Illustration Area */}
        <div className="flex flex-col items-center justify-center my-auto relative z-10 max-w-xl mx-auto text-center animate-float">
          <div className="relative group">
            {/* Soft decorative shadow under the image */}
            <div className="absolute -inset-8 bg-gradient-to-tr from-emerald-500/10 to-blue-500/10 rounded-full opacity-35 blur-3xl" />
            <img 
              src={loginIllustration} 
              alt="Inventory Management" 
              className="relative max-h-[420px] w-auto object-contain drop-shadow-[0_35px_35px_rgba(0,0,0,0.25)]"
            />
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Interactive Login Panel */}
      <div className="w-full lg:col-span-6 flex flex-col justify-between p-6 sm:p-10 min-h-screen bg-gradient-to-br from-blue-50/30 via-white to-indigo-50/20 relative overflow-hidden">
        {/* Soft Decorative Blue/Indigo Glows for Premium Matching */}
        <div className="absolute -top-12 -right-12 w-64 h-64 bg-blue-400/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-64 h-64 bg-indigo-400/10 rounded-full blur-[80px] pointer-events-none" />

        {/* Mobile Header (Hidden on Desktop) */}
        <div className="flex lg:hidden items-center gap-2 mb-8 relative z-10">
          <div className="h-8 w-8 bg-gradient-to-br from-emerald-500 to-blue-600 rounded-lg flex items-center justify-center shadow-md">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold tracking-tight text-slate-900">IMS</span>
        </div>

        <div className="my-auto max-w-lg w-full mx-auto bg-white/90 backdrop-blur-md p-10 sm:p-12 rounded-2xl border border-blue-100/60 shadow-[0_20px_50px_rgba(37,99,235,0.04)] space-y-6 transition-all duration-300 hover:shadow-[0_30px_60px_rgba(37,99,235,0.08)] hover:border-blue-200/60 relative z-10">
          {/* Beautiful Top Icon for Dignity & Premium Feel */}
          <div className="flex justify-center">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <ShieldCheck className="text-white" size={24} />
            </div>
          </div>

          {/* Header Title */}
          <div className="text-center">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h2>
            {subtitle && (
              <p className="text-xs text-slate-500 mt-1.5">{subtitle}</p>
            )}
          </div>

          {/* Form Card content */}
          <div className="space-y-4 pt-2">
            {children}
          </div>
        </div>

        {/* Footer info */}
        <div className="text-center text-xs text-slate-400 mt-8 pt-6 border-t border-slate-100/60 relative z-10">
          &copy; {new Date().getFullYear()} IMS Portal. All rights reserved.
        </div>
      </div>
      
    </div>
  );
};

export default AuthLayout;