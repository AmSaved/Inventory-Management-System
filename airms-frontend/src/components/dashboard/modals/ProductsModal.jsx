import React, { useState, useEffect, useMemo } from 'react';
import { Layers, X, Package, ChevronDown, ChevronRight, Tag, Loader2, Search } from 'lucide-react';
import api from '../../../services/api';

const ProductsModal = ({ onClose }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Track which categories and subcategories are expanded
  const [expandedCategories, setExpandedCategories] = useState({});
  const [expandedSubCategories, setExpandedSubCategories] = useState({});

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await api.get('/products');
        if (response.data?.success || response.data?.products) {
          setProducts(response.data.products || response.data.data || []);
        }
      } catch (err) {
        console.error('Failed to load products for modal', err);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  // Filter and Group Logic
  const catalogTree = useMemo(() => {
    const filtered = products.filter(p => 
      (p.name || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.sku || '').toLowerCase().includes(search.toLowerCase()) ||
      (p.category || '').toLowerCase().includes(search.toLowerCase())
    );

    const tree = {};
    filtered.forEach(p => {
      const cat = p.category || 'Uncategorized';
      const sub = p.sub_category || 'General';
      
      if (!tree[cat]) tree[cat] = {};
      if (!tree[cat][sub]) tree[cat][sub] = [];
      
      tree[cat][sub].push(p);
    });

    return tree;
  }, [products, search]);

  const toggleCategory = (cat) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  const toggleSubCategory = (cat, sub) => {
    const key = `${cat}-${sub}`;
    setExpandedSubCategories(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-4xl flex flex-col max-h-[85vh] scale-in-center overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/50 backdrop-blur z-10 sticky top-0 shrink-0">
          <div>
             <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
               <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex justify-center items-center"><Layers size={16}/></span>
               Corporate Product Catalog
             </h2>
             <p className="text-xs font-semibold text-slate-400 ml-11">Browse all officially registered asset blueprints and configurations</p>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                   type="text" 
                   placeholder="Search catalog..." 
                   value={search}
                   onChange={e => setSearch(e.target.value)}
                   className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 ring-indigo-100 focus:border-indigo-300 outline-none w-64 bg-slate-50 transition-all font-medium"
                />
             </div>
             <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors">
               <X size={20} />
             </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto bg-slate-50/[0.3] flex-1">
          {loading ? (
             <div className="flex flex-col items-center justify-center h-64 text-indigo-500">
                <Loader2 className="animate-spin mb-4" size={32} />
                <p className="text-sm font-bold text-slate-400 tracking-wider">INDEXING CATALOG...</p>
             </div>
          ) : Object.keys(catalogTree).length === 0 ? (
             <div className="flex flex-col items-center justify-center py-16 text-slate-400">
               <Package size={48} className="mb-4 opacity-20" />
               <p className="font-semibold">No products match your search.</p>
             </div>
          ) : (
             <div className="space-y-4">
               {Object.entries(catalogTree).map(([category, subCategories]) => (
                  <div key={category} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm transition-all duration-300">
                     <button 
                        onClick={() => toggleCategory(category)}
                        className="w-full flex items-center justify-between p-5 bg-gradient-to-r hover:from-indigo-50 hover:to-white transition-colors"
                     >
                        <div className="flex items-center gap-3">
                           {expandedCategories[category] ? <ChevronDown size={20} className="text-indigo-500"/> : <ChevronRight size={20} className="text-slate-400"/>}
                           <span className="font-black text-lg text-slate-800 uppercase tracking-tight">{category}</span>
                        </div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full">
                           {Object.values(subCategories).flat().length} Assets
                        </span>
                     </button>
                     
                     {expandedCategories[category] && (
                        <div className="p-4 pt-0 space-y-3 bg-white">
                           {Object.entries(subCategories).map(([subCategory, items]) => {
                              const subKey = `${category}-${subCategory}`;
                              return (
                                 <div key={subKey} className="ml-8 border border-slate-100 rounded-xl overflow-hidden">
                                    <button 
                                       onClick={() => toggleSubCategory(category, subCategory)}
                                       className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/80 transition-colors"
                                    >
                                       <div className="flex items-center gap-2">
                                          {expandedSubCategories[subKey] ? <ChevronDown size={16} className="text-slate-500"/> : <ChevronRight size={16} className="text-slate-400"/>}
                                          <span className="font-bold text-sm text-slate-700">{subCategory}</span>
                                       </div>
                                       <span className="text-[10px] font-bold text-slate-400">{items.length} Items</span>
                                    </button>
                                    
                                    {expandedSubCategories[subKey] && (
                                       <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 bg-white">
                                          {items.map(item => (
                                             <div key={item.id} className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 hover:border-indigo-100 hover:bg-indigo-50/30 transition-all cursor-default">
                                                <div className="w-8 h-8 rounded border border-slate-100 bg-slate-50 flex items-center justify-center shrink-0">
                                                   <Tag size={12} className="text-indigo-400" />
                                                </div>
                                                <div>
                                                   <p className="font-bold text-sm text-slate-800 leading-tight mb-1">{item.name}</p>
                                                   <div className="flex items-center gap-2">
                                                      <span className="font-mono text-[9px] font-bold text-slate-500 bg-slate-100 px-1 py-0.5 rounded">{item.sku}</span>
                                                      {item.brand && <span className="text-[9px] font-bold uppercase text-slate-400">{item.brand}</span>}
                                                   </div>
                                                </div>
                                             </div>
                                          ))}
                                       </div>
                                    )}
                                 </div>
                              );
                           })}
                        </div>
                     )}
                  </div>
               ))}
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductsModal;
