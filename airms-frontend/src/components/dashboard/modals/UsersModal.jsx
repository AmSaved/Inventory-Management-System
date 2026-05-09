import React, { useState, useEffect } from 'react';
import { Users, X, MapPin, Shield, Box, Search, Loader2 } from 'lucide-react';
import api from '../../../services/api';

const UsersModal = ({ onClose }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const response = await api.get('/users?limit=500'); // Fetch up to 500 for the modal view
        if (response.data?.success) {
          setUsers(response.data.data || []);
        }
      } catch (err) {
        console.error('Failed to load users for modal', err);
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(u => 
     (u.first_name + ' ' + u.last_name).toLowerCase().includes(search.toLowerCase()) ||
     (u.employee_id || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-5xl flex flex-col max-h-[85vh] scale-in-center overflow-hidden">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white/50 backdrop-blur z-10 sticky top-0 shrink-0">
          <div>
             <h2 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-3">
               <span className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex justify-center items-center"><Users size={16}/></span>
               Personnel Breakdown
             </h2>
             <p className="text-xs font-semibold text-slate-400 ml-11">Review active users, their roles, branch scope, and active assignments</p>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                   type="text" 
                   placeholder="Search personnel..." 
                   value={search}
                   onChange={e => setSearch(e.target.value)}
                   className="pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:ring-2 ring-emerald-100 focus:border-emerald-300 outline-none w-64 bg-slate-50 transition-all font-medium"
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
             <div className="flex flex-col items-center justify-center h-64 text-emerald-500">
                <Loader2 className="animate-spin mb-4" size={32} />
                <p className="text-sm font-bold text-slate-400 tracking-wider">LOADING PERSONNEL...</p>
             </div>
          ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {filteredUsers.map((user) => (
                 <div key={user.id} className="bg-white border border-slate-100 p-5 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-4 pb-4 border-b border-slate-50">
                       <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-black text-slate-500">
                             {user.first_name[0]}{user.last_name[0]}
                          </div>
                          <div>
                             <h3 className="font-bold text-slate-800">{user.first_name} {user.last_name}</h3>
                             <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest">{user.employee_id || 'System User'}</p>
                          </div>
                       </div>
                    </div>
                    
                    <div className="space-y-3">
                       <div className="flex items-center gap-2 text-sm">
                          <MapPin size={14} className="text-indigo-400" />
                          <span className="font-medium text-slate-600">{user.organizationNode?.name || 'No Branch Assigned'}</span>
                       </div>
                       <div className="flex items-center gap-2 text-sm">
                          <Shield size={14} className="text-rose-400" />
                          <span className="font-medium text-slate-600">{user.role?.name || 'No Role'}</span>
                       </div>
                       <div className="flex items-start gap-2 pt-2 mt-2 border-t border-slate-50">
                          <Box size={14} className="text-amber-500 mt-1 shrink-0" />
                          <div className="flex-1">
                             <span className="text-xs font-bold uppercase tracking-widest text-slate-400 block mb-1">
                                Active Assignments ({user.assignments?.length || 0})
                             </span>
                             {user.assignments && user.assignments.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                   {user.assignments.slice(0, 3).map(a => (
                                      <span key={a.id} className="text-[10px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-semibold border border-amber-100">
                                         {a.product?.name || 'Asset'}
                                      </span>
                                   ))}
                                   {user.assignments.length > 3 && (
                                      <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-bold">
                                         +{user.assignments.length - 3} more
                                      </span>
                                   )}
                                </div>
                             ) : (
                                <span className="text-xs text-slate-400 italic">No assigned equipment</span>
                             )}
                          </div>
                       </div>
                    </div>
                 </div>
               ))}
               {filteredUsers.length === 0 && (
                  <div className="col-span-1 md:col-span-2 text-center py-12 text-slate-400 font-medium">
                     No personnel matching your criteria.
                  </div>
               )}
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UsersModal;
