import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import organizationService from '../services/organizationService';
import toast from 'react-hot-toast';
import { Building2, Layers, CheckCircle2, AlertCircle, Plus, Trash2, Box, Users } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';

const SetupWizardPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Builder State
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  
  // Organization Data
  const [rootNodeName, setRootNodeName] = useState('');
  const [rootNodeCode, setRootNodeCode] = useState('');
  
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
      return toast.error("You must have at least one hierarchy level.");
    }
    const updated = hierarchyLevels.filter((_, i) => i !== index);
    setHierarchyLevels(updated);
  };

  const deployOrganization = async () => {
    if (!rootNodeName.trim()) {
      return toast.error("Please provide the Organization Name.");
    }
    
    const validLevels = hierarchyLevels.filter(lvl => lvl.name.trim() !== '');
    if (validLevels.length === 0) {
      return toast.error("You must define at least one valid hierarchy label.");
    }

    try {
      setLoading(true);
      toast.loading('Creating Hierarchy Types...', { id: 'deploy' });

      // 1. Create all Types sequentially 
      const createdTypes = [];
      for (let i = 0; i < validLevels.length; i++) {
        const lvl = validLevels[i];
        
        // Auto-generate code if empty (take first 3 letters)
        const autoCode = lvl.code_prefix || lvl.name.substring(0, 3);
        
        const res = await organizationService.createType({
          name: lvl.name,
          code_prefix: autoCode,
          is_storage_allowed: lvl.is_storage_allowed || false,
          is_department: lvl.is_department || false,
          description: `Custom Level ${i + 1} for ${rootNodeName}`
        });
        createdTypes.push(res);
      }

      if (createdTypes.length === 0) {
        throw new Error("Failed to process hierarchy labels.");
      }

      // 2. We use the very first type created as the org_type_id for the Root node.
      toast.loading(`Initializing ${rootNodeName}...`, { id: 'deploy' });
      
      const rootPayload = {
        name: rootNodeName,
        code: rootNodeCode || rootNodeName.substring(0, 3),
        org_type_id: createdTypes[0].id,
        parent_id: null,
        can_store_inventory: createdTypes[0].is_storage_allowed || false
      };
      
      await organizationService.createNode(rootPayload);

      toast.success('Organization Built Successfully!', { id: 'deploy' });
      setStep(3); // Success Screen

    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || error.message || 'Failed to deploy architecture', { id: 'deploy' });
    } finally {
      setLoading(false);
    }
  };

  const resetBuilder = () => {
    setRootNodeName('');
    setRootNodeCode('');
    setHierarchyLevels([{ name: '', code_prefix: '', is_storage_allowed: false, is_department: false }]);
    setStep(1);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col pt-12">
       {/* Wizard Progress Header */}
       <div className="max-w-4xl w-full mx-auto px-6 mb-12">
          <div className="text-center mb-8">
             <h1 className="text-3xl font-black text-slate-900 font-display uppercase tracking-tight">Organization Builder</h1>
             <p className="text-slate-500 text-sm font-bold mt-2">Unlimited dynamic hierarchy creation engine.</p>
          </div>
          
          <div className="flex items-center justify-between relative max-w-2xl mx-auto">
             <div className="absolute left-0 right-0 h-1 bg-slate-200 top-1/2 -translate-y-1/2 z-0 rounded-full" />
             <div className="absolute left-0 h-1 bg-blue-500 top-1/2 -translate-y-1/2 z-0 transition-all duration-500" style={{ width: step === 1 ? '5%' : step === 2 ? '50%' : '100%' }} />
             
             <div className={`relative z-10 flex flex-col items-center ${step >= 1 ? 'text-blue-600' : 'text-slate-400'}`}>
                <div className={`w-10 h-10 rounded-full border-4 flex items-center justify-center bg-white font-black text-sm transition-colors duration-500 ${step >= 1 ? 'border-blue-500 text-blue-500 shadow-lg shadow-blue-100' : 'border-slate-200'}`}>1</div>
                <span className="text-[10px] font-black uppercase tracking-widest mt-2 absolute -bottom-6 w-max">Organization Details</span>
             </div>
             
             <div className={`relative z-10 flex flex-col items-center ${step >= 2 ? 'text-blue-600' : 'text-slate-400'}`}>
                <div className={`w-10 h-10 rounded-full border-4 flex items-center justify-center bg-white font-black text-sm transition-colors duration-500 ${step >= 2 ? 'border-blue-500 text-blue-500 shadow-lg shadow-blue-100' : 'border-slate-200'}`}>2</div>
                <span className="text-[10px] font-black uppercase tracking-widest mt-2 absolute -bottom-6 w-max">Hierarchy Labels</span>
             </div>
             
             <div className={`relative z-10 flex flex-col items-center ${step >= 3 ? 'text-blue-600' : 'text-slate-400'}`}>
                <div className={`w-10 h-10 rounded-full border-4 flex items-center justify-center bg-white font-black text-sm transition-colors duration-500 ${step >= 3 ? 'border-blue-500 text-blue-500 shadow-lg shadow-blue-100' : 'border-slate-200'}`}>3</div>
                <span className="text-[10px] font-black uppercase tracking-widest mt-2 absolute -bottom-6 w-max">Deployed</span>
             </div>
          </div>
       </div>

       {/* Step Content */}
       <div className="flex-1 w-full max-w-3xl mx-auto px-6 pb-20">
          
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto">
               <Card className="rounded-[2.5rem] border-0 shadow-2xl overflow-hidden bg-white text-center p-12 relative">
                  <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-blue-500 to-indigo-600"></div>
                  <div className="w-24 h-24 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-8">
                     <Building2 size={40} className="text-blue-600" />
                  </div>
                  
                  <h2 className="text-3xl font-black text-slate-900 mb-2 font-display">Create an Organization</h2>
                  <p className="text-slate-500 text-sm font-medium mb-10">Define the top-level entity or root network that will hold the upcoming hierarchy.</p>
                  
                  <div className="space-y-6 text-left">
                     <div className="relative group">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest absolute -top-2.5 left-4 bg-white px-2 z-10">Organization Name</label>
                        <input 
                          className="w-full h-16 border-2 border-slate-200 rounded-2xl px-6 text-lg font-black text-slate-800 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none" 
                          value={rootNodeName}
                          onChange={(e) => setRootNodeName(e.target.value)}
                          placeholder="e.g. My Amazing Tech Corp"
                        />
                     </div>
                     <div className="relative group">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest absolute -top-2.5 left-4 bg-white px-2 z-10">Organization Code (Optional)</label>
                        <input 
                          className="w-full h-14 border-2 border-slate-200 rounded-2xl px-6 font-bold text-slate-800 uppercase focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none" 
                          value={rootNodeCode}
                          onChange={(e) => setRootNodeCode(e.target.value)}
                          placeholder="e.g. MTC"
                        />
                     </div>
                  </div>

                  <div className="mt-12">
                     <Button 
                       className="bg-slate-900 hover:bg-black text-white shadow-xl shadow-slate-900/20 px-10 h-14 rounded-2xl font-black tracking-widest uppercase text-xs w-full"
                       onClick={() => {
                         if(!rootNodeName.trim()) return toast.error("Organization name is required");
                         setStep(2);
                       }}
                     >
                        Next: Define Hierarchy Layers &#8594;
                     </Button>
                  </div>
               </Card>
            </div>
          )}

          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-right-8 duration-500 space-y-8">
               <div className="bg-blue-50 border border-blue-100 rounded-3xl p-6 flex flex-col md:flex-row items-center md:items-start gap-4 text-center md:text-left">
                  <Layers className="text-blue-500 shrink-0 mt-1" size={24} />
                  <div>
                     <h4 className="text-blue-900 font-black uppercase tracking-wide text-sm mb-1">Hierarchy Writable Labels</h4>
                     <p className="text-blue-700/80 text-xs font-medium leading-relaxed">
                        The top level structure will be <strong>{rootNodeName}</strong>. 
                        Now, write the names of the hierarchy levels that exist under it. You can add as many levels as you need. (Top to bottom flow).
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
                    <Plus size={16} /> Add Hierarchy Level
                 </button>
               </div>

               <div className="flex flex-col-reverse sm:flex-row justify-between items-center gap-4 pt-10 border-t border-slate-200">
                  <Button variant="outline" className="text-slate-500 hover:bg-white border-2 px-8 h-14 rounded-2xl font-black w-full sm:w-auto" onClick={() => setStep(1)}>
                     &#8592; Back
                  </Button>
                  <Button 
                    variant="primary"
                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-xl shadow-blue-500/20 px-10 h-14 rounded-2xl font-black tracking-widest uppercase text-xs w-full sm:w-auto flex items-center gap-2" 
                    onClick={deployOrganization}
                    disabled={loading}
                  >
                     {loading ? 'Creating Organization...' : 'Create Organization & Hierarchy'}
                  </Button>
               </div>
            </div>
          )}

          {step === 3 && (
            <div className="animate-in zoom-in-95 duration-700 max-w-lg mx-auto mt-12">
               <Card className="rounded-[3rem] border-0 shadow-2xl overflow-hidden bg-white text-center p-14 bg-gradient-to-b from-white to-emerald-50/30">
                  <div className="w-24 h-24 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-8 animate-bounce-short shadow-xl shadow-emerald-500/20">
                     <CheckCircle2 size={48} className="text-emerald-600" />
                  </div>
                  
                  <h2 className="text-3xl font-black text-slate-900 mb-4 font-display leading-tight">Organization<br/>Online!</h2>
                  <p className="text-slate-500 text-sm font-medium mb-10 leading-relaxed">
                     <strong>{rootNodeName}</strong> and its internal hierarchy system have been deployed to your active directory. 
                  </p>
                  
                  <div className="space-y-4">
                     <Button 
                       className="bg-slate-900 hover:bg-black text-white px-10 h-14 rounded-2xl font-black tracking-widest uppercase text-[10px] w-full"
                       onClick={resetBuilder}
                     >
                        <Plus size={14} className="mr-2" /> Add Another Organization
                     </Button>
                     <Button 
                       variant="outline"
                       className="border-2 text-slate-700 px-10 h-14 rounded-2xl font-black tracking-widest uppercase text-[10px] w-full"
                       onClick={() => navigate('/dashboard?tab=structure')}
                     >
                        View Directory Grid
                     </Button>
                  </div>
               </Card>
            </div>
          )}

       </div>
    </div>
  );
};

export default SetupWizardPage;
