import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import organizationService from '../../services/organizationService';
import toast from 'react-hot-toast';
import { Layers, Plus, Trash2, Box, Users, CheckCircle2 } from 'lucide-react';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { useSearchParams } from 'react-router-dom';

const BranchSetupWizard = ({ onComplete }) => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Builder State
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Hierarchy Data (Dynamic array)
  const [hierarchyLevels, setHierarchyLevels] = useState([
    { name: '', code_prefix: '', is_storage_allowed: false, is_department: false }
  ]);

  const handleLevelChange = (index, field, value) => {
    const updated = [...hierarchyLevels];
    updated[index][field] = value;
    setHierarchyLevels(updated);
  };

  const addLevel = () => {
    setHierarchyLevels([...hierarchyLevels, { name: '', code_prefix: '', is_storage_allowed: false, is_department: false }]);
  };

  const removeLevel = (index) => {
    if (hierarchyLevels.length <= 1) {
      return toast.error("You must define at least one hierarchy level.");
    }
    const updated = hierarchyLevels.filter((_, i) => i !== index);
    setHierarchyLevels(updated);
  };

  const deployOrganization = async () => {
    const validLevels = hierarchyLevels.filter(lvl => lvl.name.trim() !== '');
    if (validLevels.length === 0) {
      return toast.error("You must define at least one valid hierarchy label.");
    }

    try {
      setLoading(true);
      toast.loading('Initializing Architecture Layers...', { id: 'branch-deploy' });

      // Create all Types sequentially 
      for (let i = 0; i < validLevels.length; i++) {
        const lvl = validLevels[i];
        
        // Auto-generate code if empty (take first 3 letters)
        const autoCode = lvl.code_prefix || lvl.name.substring(0, 3).toUpperCase();
        
        await organizationService.createType({
          name: lvl.name,
          code_prefix: autoCode,
          is_storage_allowed: lvl.is_storage_allowed || false,
          is_department: lvl.is_department || false,
          description: `Custom Hierarchy Level for ${user?.organization_node?.name || 'Local Branch'}`
        });
      }

      toast.success('Architecture Configured Successfully!', { id: 'branch-deploy' });
      setStep(2); // Success Screen

    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || error.message || 'Failed to initialize architecture', { id: 'branch-deploy' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full">
       <div className="max-w-4xl mx-auto mb-8 text-center space-y-2">
          <h2 className="text-3xl font-black text-slate-900 font-display uppercase tracking-tight">Organization Initializer</h2>
          <p className="text-slate-500 text-sm font-bold">Define the structural vocabulary for your domain before building operations.</p>
       </div>

       <div className="w-full max-w-4xl mx-auto">
          {step === 1 && (
            <div className="animate-in fade-in duration-500 space-y-8">
               <div className="bg-blue-50 border border-blue-100 rounded-3xl p-6 flex flex-col md:flex-row items-center md:items-start gap-4 text-center md:text-left">
                  <Layers className="text-blue-500 shrink-0 mt-1" size={24} />
                  <div>
                     <h4 className="text-blue-900 font-black uppercase tracking-wide text-sm mb-1">Hierarchy Taxonomy</h4>
                     <p className="text-blue-700/80 text-xs font-medium leading-relaxed">
                        You manage <strong>{user?.organization_node?.name || 'this Organization'}</strong>. 
                        Define the names of the hierarchy levels that exist under your control (e.g., Division, Team, Facility).
                     </p>
                  </div>
               </div>

               <div className="space-y-4">
                  {hierarchyLevels.map((lvl, index) => (
                    <Card key={index} className="rounded-3xl border-2 border-slate-100 shadow-sm overflow-hidden bg-white flex flex-col sm:flex-row gap-0 group">
                       
                       {/* Level number indicator */}
                       <div className="bg-slate-50 w-full sm:w-16 flex items-center justify-center py-3 sm:py-0 border-b sm:border-b-0 sm:border-r border-slate-100">
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lvl {index + 1}</span>
                       </div>
                       
                       {/* Input Form */}
                       <div className="p-4 flex-1 flex flex-col xl:flex-row gap-4">
                          <input 
                            className="flex-1 h-12 bg-slate-50 border border-slate-200 rounded-xl px-4 font-black text-slate-800 focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none" 
                            value={lvl.name}
                            onChange={(e) => handleLevelChange(index, 'name', e.target.value)}
                            placeholder="Type hierarchy label (e.g. Branch, Department)"
                          />
                          
                          {/* Options Block */}
                          <div className="flex items-center gap-2">
                             <label className={`h-12 flex items-center gap-2 px-3 border rounded-xl cursor-pointer transition-colors ${lvl.is_storage_allowed ? 'border-emerald-300 bg-emerald-50' : 'border-slate-100 hover:bg-slate-50'}`}>
                                <input 
                                  type="checkbox" 
                                  checked={lvl.is_storage_allowed}
                                  onChange={(e) => handleLevelChange(index, 'is_storage_allowed', e.target.checked)}
                                  className="accent-emerald-600 cursor-pointer"
                                />
                                <Box size={14} className={lvl.is_storage_allowed ? 'text-emerald-600' : 'text-slate-400'} />
                                <span className={`text-[10px] font-black uppercase tracking-widest select-none ${lvl.is_storage_allowed ? 'text-emerald-700' : 'text-slate-400'}`}>Storable</span>
                             </label>
                             <label className={`h-12 flex items-center gap-2 px-3 border rounded-xl cursor-pointer transition-colors ${lvl.is_department ? 'border-indigo-300 bg-indigo-50' : 'border-slate-100 hover:bg-slate-50'}`}>
                                <input 
                                  type="checkbox" 
                                  checked={lvl.is_department}
                                  onChange={(e) => handleLevelChange(index, 'is_department', e.target.checked)}
                                  className="accent-indigo-600 cursor-pointer"
                                />
                                <Users size={14} className={lvl.is_department ? 'text-indigo-600' : 'text-slate-400'} />
                                <span className={`text-[10px] font-black uppercase tracking-widest select-none ${lvl.is_department ? 'text-indigo-700' : 'text-slate-400'}`}>Dept</span>
                             </label>

                             <button 
                               onClick={() => removeLevel(index)}
                               className="h-12 w-12 flex items-center justify-center rounded-xl text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-colors shrink-0"
                             >
                                <Trash2 size={16} />
                             </button>
                          </div>
                       </div>
                    </Card>
                  ))}
               </div>

               <div className="flex justify-center">
                 <button 
                   onClick={addLevel}
                   className="flex items-center gap-2 px-6 py-3 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-full font-black text-[10px] uppercase tracking-widest transition-colors"
                 >
                    <Plus size={16} /> Add Hierarchy Label
                 </button>
               </div>

               <div className="flex justify-center pt-10 border-t border-slate-200">
                  <Button 
                    variant="primary"
                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-500/20 px-16 h-14 rounded-2xl font-black tracking-widest uppercase text-xs flex items-center gap-2" 
                    onClick={deployOrganization}
                    disabled={loading}
                  >
                     {loading ? 'Initializing...' : 'Define Structure Vocabulary'}
                  </Button>
               </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-in zoom-in-95 duration-700 w-full mt-6">
               <Card className="rounded-[3rem] border-0 shadow-xl overflow-hidden bg-white text-center p-14 bg-gradient-to-b from-white to-emerald-50/30">
                  <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce-short shadow-xl shadow-emerald-500/20">
                     <CheckCircle2 size={48} className="text-emerald-600" />
                  </div>
                  
                  <h2 className="text-3xl font-black text-slate-900 mb-4 font-display leading-tight">Vocabulary Defined!</h2>
                  <p className="text-slate-500 text-sm font-medium mb-10 leading-relaxed max-w-sm mx-auto">
                     Your custom sub-unit types have been recorded. You can now begin mapping out your structural grid.
                  </p>
                  
                  <Button 
                    className="bg-slate-900 hover:bg-black text-white px-10 h-14 rounded-2xl font-black tracking-widest uppercase text-[10px] shadow-xl shadow-slate-900/20"
                    onClick={() => {
                        setSearchParams({ tab: 'structure' });
                        if (onComplete) onComplete();
                    }}
                  >
                     Build Organization Hierarchy &#8594;
                  </Button>
               </Card>
            </div>
          )}
       </div>
    </div>
  );
};

export default BranchSetupWizard;
