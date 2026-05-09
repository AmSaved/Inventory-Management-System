import React from 'react';
import { Building2, X } from 'lucide-react';

const BranchesModal = ({ branches, onClose, onSelect }) => {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[85vh] scale-in-center">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white/50 backdrop-blur z-10 sticky top-0">
          <div>
             <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
               <span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex justify-center items-center"><Building2 size={16}/></span>
               Organizational Branches
             </h2>
             <p className="text-xs font-semibold text-slate-400 ml-11">Click on any branch to navigate to its specific operational dashboard</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
            <X size={20} />
          </button>
        </div>
        <div className="p-6 overflow-y-auto space-y-4 bg-slate-50/[0.3]">
          {branches.map((branch) => (
            <div 
              key={branch.id} 
              onClick={() => onSelect(branch.id)}
              className="group flex flex-col md:flex-row items-start md:items-center justify-between p-5 bg-white hover:bg-blue-50 border border-slate-100 hover:border-blue-200 rounded-2xl cursor-pointer shadow-sm hover:shadow-md transition-all duration-300"
            >
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-50 group-hover:bg-blue-100/50 flex items-center justify-center transition-colors">
                  <Building2 size={24} className="text-indigo-500" />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-800 group-hover:text-blue-800 transition-colors">{branch.name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                     <span className="text-[10px] font-black uppercase text-blue-500 bg-blue-50 px-2 py-0.5 rounded tracking-wider">{branch.code}</span>
                  </div>
                </div>
              </div>
              <div className="mt-4 md:mt-0 px-4">
                 <div className="text-right">
                   <p className="text-3xl font-black text-slate-800 group-hover:text-blue-600 transition-colors leading-none">{branch.stock_count || 0}</p>
                   <p className="text-[9px] uppercase tracking-widest text-slate-400 font-bold mt-1">Total Assets Held</p>
                 </div>
              </div>
            </div>
          ))}
          {branches.length === 0 && (
             <div className="flex flex-col items-center justify-center py-16 text-slate-400">
               <Building2 size={48} className="mb-4 opacity-20" />
               <p className="font-semibold">No branches available in your scope.</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BranchesModal;
