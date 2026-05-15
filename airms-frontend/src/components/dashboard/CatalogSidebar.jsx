import React, { useState } from 'react';
import { useFetch } from '../../hooks/useFetch';
import { X, Search, Plus, Package, Tag, Loader2, Info } from 'lucide-react';

const CatalogSidebar = ({ isOpen, onClose, onSelectProduct, onNewBlueprint }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const { data: products, loading } = useFetch('/products', {
    params: { 
      limit: 50,
      search: searchTerm 
    },
  });

  const filteredProducts = products || [];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-300" 
        onClick={onClose}
      />
      
      {/* Sliding Panel */}
      <div className="relative w-full max-w-lg bg-white h-full shadow-[0_0_100px_rgba(0,0,0,0.2)] flex flex-col animate-in slide-in-from-right duration-500">
        
        {/* Premium Header */}
        <div className="p-8 border-b-2 border-slate-50 bg-slate-950 text-white relative overflow-hidden">
           <div className="absolute top-0 right-0 p-4 opacity-10">
              <Package size={120} className="rotate-12" />
           </div>
           
           <div className="relative z-10 flex items-center justify-between">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <Search size={22} />
                 </div>
                 <div>
                    <h2 className="text-xl font-black tracking-tighter uppercase italic">Product Registry</h2>
                    <p className="text-[10px] text-slate-400 font-bold tracking-[0.2em] uppercase">Global Asset Blueprints</p>
                 </div>
              </div>
              <button 
                onClick={onClose}
                className="p-3 bg-white/10 text-white/60 rounded-2xl hover:bg-red-500 hover:text-white transition-all active:scale-90"
              >
                <X size={20} />
              </button>
           </div>
        </div>

        {/* Action Bar */}
        <div className="p-6 bg-slate-50 border-b border-slate-100 flex gap-4">
           <div className="relative flex-1 group">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors" />
              <input 
                type="text" 
                placeholder="Search catalog by SKU or Name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-14 bg-white border-2 border-slate-100 rounded-2xl pl-12 pr-4 text-sm font-bold outline-none focus:border-blue-500 transition-all shadow-sm"
              />
           </div>
           <button 
             onClick={onNewBlueprint}
             className="h-14 px-6 bg-slate-950 text-white rounded-2xl flex items-center gap-3 hover:bg-blue-600 transition-all active:scale-95 shadow-xl shadow-slate-200"
             title="Add New Blueprint"
           >
             <Plus size={20} />
             <span className="text-[10px] font-black uppercase tracking-widest hidden sm:block">New Blueprint</span>
           </button>
        </div>

        {/* Catalog List */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
           {loading ? (
             <div className="flex flex-col items-center justify-center h-full space-y-4">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Indexing Infrastructure...</p>
             </div>
           ) : filteredProducts.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-full text-center p-10 space-y-6">
                <div className="w-24 h-24 bg-slate-50 rounded-[40px] flex items-center justify-center border-2 border-dashed border-slate-200">
                   <Package size={40} className="text-slate-200" />
                </div>
                <div>
                   <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">No Blueprints Found</h3>
                   <p className="text-xs text-slate-500 mt-2 font-medium">We couldn't find any assets matching your search criteria.</p>
                </div>
                <button 
                  onClick={onNewBlueprint}
                  className="flex items-center gap-2 text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] hover:text-slate-950 transition-colors"
                >
                  <Plus size={14} /> Create New Registry Entry
                </button>
             </div>
           ) : (
             <div className="grid grid-cols-1 gap-4">
                {filteredProducts.map((p) => (
                   <button 
                     key={p.id}
                     onClick={() => {
                       onSelectProduct(p);
                       onClose();
                     }}
                     className="group text-left p-6 bg-white border border-slate-100 rounded-[30px] hover:border-blue-600 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300 relative overflow-hidden"
                   >
                      <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                         <Info size={16} className="text-blue-600" />
                      </div>
                      
                      <div className="flex items-start gap-4">
                         <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center group-hover:bg-blue-50 transition-colors shrink-0">
                            <Tag size={20} className="text-slate-300 group-hover:text-blue-600 transition-colors" />
                         </div>
                         <div className="space-y-1">
                            <h4 className="text-sm font-black text-slate-900 tracking-tight group-hover:text-blue-600 transition-colors uppercase">{p.name}</h4>
                            <div className="flex items-center gap-2">
                               <span className="text-[10px] font-black text-slate-400 group-hover:text-slate-600 transition-colors uppercase tracking-widest">{p.sku}</span>
                               <span className="w-1 h-1 bg-slate-200 rounded-full" />
                               <span className="text-[10px] font-bold text-slate-400 uppercase italic">{p.category || 'General'}</span>
                            </div>
                         </div>
                      </div>
                   </button>
                ))}
             </div>
           )}
        </div>

        {/* Footer Info */}
        <div className="p-8 bg-slate-50 border-t border-slate-100">
           <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-slate-200/50">
              <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600">
                 <Info size={16} />
              </div>
              <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                 Selecting a blueprint will auto-fill the current intake entry. If an asset is missing, use the <strong>New Blueprint</strong> tool.
              </p>
           </div>
        </div>
      </div>
    </div>
  );
};

export default CatalogSidebar;
