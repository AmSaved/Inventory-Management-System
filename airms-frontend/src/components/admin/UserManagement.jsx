import React, { useState, useMemo } from 'react';
import { useFetch } from '../../hooks/useFetch';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Modal from '../common/Modal';
import Input from '../ui/Input';
import CascadingUnitSelector from '../common/CascadingUnitSelector';
import userService from '../../services/userService';
import toast from 'react-hot-toast';
import LoadingSpinner from '../common/LoadingSpinner';
import { useAuth } from '../../hooks/useAuth';
import { 
  Building2, 
  ShieldCheck, 
  Users, 
  MoreVertical, 
  Edit3, 
  Trash2, 
  Search,
  Fingerprint,
  Activity,
  CheckCircle2,
  XCircle,
  Mail,
  Smartphone,
  ShieldAlert,
  ArrowRight,
  UserPlus,
  MapPin
} from 'lucide-react';

const UserManagement = ({ orgNodeId }) => {
  const { user } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isSuperAdmin = user?.role?.level >= 100;
  
  // Build dynamic fetch URL based on scope
  const userFetchUrl = useMemo(() => {
    let url = '/users';
    const params = new URLSearchParams();
    
    if (orgNodeId) {
      params.append('org_node_id', orgNodeId);
    } else if (isSuperAdmin) {
      params.append('only_mine', 'true');
    }
    
    const queryString = params.toString();
    return queryString ? `${url}?${queryString}` : url;
  }, [orgNodeId, isSuperAdmin]);

  const { data: usersData, loading: usersLoading, refetch: refetchUsers } = useFetch(userFetchUrl);
  const users = usersData?.data || usersData || [];
  const { data: roles } = useFetch('/roles');

  const filteredUsers = useMemo(() => {
    if (!search) return users;
    const term = search.toLowerCase();
    return users.filter(u => 
      u.first_name?.toLowerCase().includes(term) ||
      u.last_name?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      u.employee_id?.toLowerCase().includes(term)
    );
  }, [users, search]);

  const handleOpenModal = (item = null) => {
    setEditingItem(item);
    if (item) {
      setFormData({
        ...item,
        password: '', // Clear password field for new entry
        org_node_id: item.org_node_id || null,
        role_ids: item.roles?.map(r => r.id) || (item.role_id ? [item.role_id] : [])
      });
    } else {
      setFormData({
        is_active: true,
        password: '',
        org_node_id: null,
        role_ids: []
      });
    }
    setModalOpen(true);
  };

  const handleRoleToggle = (roleId) => {
    const id = parseInt(roleId);
    const currentRoles = formData.role_ids || [];
    const isAlreadySelected = currentRoles.includes(id);
    
    let newRoles = isAlreadySelected 
      ? currentRoles.filter(rid => rid !== id) 
      : [...currentRoles, id];

    const selectedRolesObjects = roles?.filter(r => newRoles.includes(r.id)) || [];
    const hasSuperAdmin = selectedRolesObjects.some(r => r.level >= 100);
    
    setFormData({
      ...formData,
      role_ids: newRoles,
      role_id: newRoles[0] || null,
      org_node_id: hasSuperAdmin ? null : formData.org_node_id
    });
  };

  const handleSubmit = async () => {
    const loadingToast = toast.loading('Synchronizing Personnel Registry...');
    setSubmitting(true);
    try {
      if (editingItem) {
        await userService.updateUser(editingItem.id, formData);
        toast.success('Credentials Updated', { id: loadingToast });
      } else {
        await userService.createUser(formData);
        toast.success('Personnel Initialized', { id: loadingToast });
      }
      refetchUsers();
      setModalOpen(false);
    } catch (error) {
      toast.error('Registry Error: Update Aborted', { id: loadingToast });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Terminate this personnel record?')) return;
    try {
      await userService.deleteUser(id);
      refetchUsers();
      toast.success('Registry record expunged');
    } catch (error) {
      toast.error('Termination Failure');
    }
  };

  if (usersLoading) return <LoadingSpinner />;

  const isSuperAdminRole = roles?.filter(r => formData.role_ids?.includes(r.id)).some(r => r.level >= 100);

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000">
      {/* HEADER SECTION */}
      <div className="bg-white/80 backdrop-blur-2xl rounded-[3rem] p-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.06)] border border-white/50 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-10">
        <div className="flex items-center gap-8">
           <div className="w-20 h-20 bg-slate-950 rounded-[30px] flex items-center justify-center shadow-2xl rotate-3 group hover:rotate-0 transition-transform duration-500 shrink-0">
              <Users className="text-blue-400 group-hover:scale-110 transition-transform" size={32} />
           </div>
           <div>
             <div className="text-[11px] font-black text-blue-600 uppercase tracking-[0.4em] mb-2 ml-1 italic">Registry Control</div>
             <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">Personnel Hub</h1>
             <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em] mt-3 ml-1 italic opacity-80">Institutional Access & Security Matrix</p>
           </div>
        </div>
        <Button 
          onClick={() => handleOpenModal()} 
          className="bg-slate-950 text-white h-16 px-10 rounded-3xl font-black uppercase text-xs tracking-widest hover:bg-blue-600 transition-all shadow-2xl shadow-blue-500/20"
        >
          <UserPlus size={18} className="mr-3" /> Initialize New User
        </Button>
      </div>

      {/* SEARCH & FILTER BAR (Placeholder) */}
      <div className="bg-white/40 backdrop-blur-md p-3 rounded-[2.5rem] border border-white/60 shadow-sm flex items-center gap-4 px-6 h-16">
         <Search size={18} className="text-slate-400" />
         <input 
           type="text" 
           placeholder="SEARCH BY ID OR NAME..." 
           className="bg-transparent border-none outline-none font-black text-[10px] uppercase tracking-widest text-slate-900 placeholder:text-slate-300 w-full"
           value={searchTerm}
           onChange={(e) => setSearchTerm(e.target.value)}
           onKeyDown={(e) => {
             if (e.key === 'Enter') {
               setSearch(searchTerm);
             }
           }}
         />
         <div className="flex items-center gap-2">
            <Badge className="bg-slate-900 text-white border-none text-[8px] font-black uppercase px-3 py-1 rounded-full">{filteredUsers?.length || 0} RECORDS</Badge>
         </div>
      </div>

      {/* PERSONNEL INSIGHT GRID */}
      <div className="grid grid-cols-1 gap-6">
        <div className="flex items-center gap-4 px-6">
           <div className="w-2 h-8 bg-blue-600 rounded-full" />
           <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight italic">Registry Entries</h3>
        </div>

        <div className="grid grid-cols-1 gap-4">
           {filteredUsers.map((u) => (
             <div 
               key={u.id} 
               className="bg-white/80 backdrop-blur-xl rounded-[2.5rem] p-8 border border-white/50 shadow-[0_8px_32px_rgba(0,0,0,0.03)] hover:shadow-[0_24px_48px_rgba(0,0,0,0.08)] transition-all duration-500 group flex flex-col xl:flex-row items-center justify-between gap-8 overflow-hidden relative"
             >
                <div className="flex items-center gap-8 w-full xl:w-auto">
                   <div className="relative">
                      <div className="w-20 h-20 bg-slate-50 rounded-[28px] flex items-center justify-center text-slate-900 font-black text-xl shadow-inner border-2 border-white group-hover:border-blue-200 transition-all">
                        {u.first_name[0]}{u.last_name[0]}
                      </div>
                      <div className={`absolute -bottom-1 -right-1 w-6 h-6 border-4 border-white rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-rose-500'} animate-pulse`} />
                   </div>
                   
                   <div className="space-y-1">
                      <h4 className="text-2xl font-black text-slate-900 tracking-tighter italic uppercase group-hover:text-blue-700 transition-colors">
                        {u.first_name} {u.last_name}
                      </h4>
                      <div className="flex flex-wrap gap-2">
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-100/50 px-2 py-1 rounded-md">ID: {u.employee_id}</span>
                         <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">@{u.username}</span>
                      </div>
                   </div>
                </div>

                {/* ROLE MATRIX */}
                <div className="flex flex-wrap gap-2 flex-1 justify-center xl:justify-start">
                   {u.roles?.map(r => (
                     <Badge key={r.id} className="bg-slate-950 text-white border-none text-[8px] font-black uppercase px-3 py-1.5 rounded-xl shadow-lg shadow-slate-200">
                        {r.name?.replace('_', ' ')}
                     </Badge>
                   ))}
                </div>

                {/* NODE CONTEXT */}
                <div className="flex items-center gap-4 min-w-[250px]">
                   <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 shadow-sm shrink-0">
                      <Building2 size={20} />
                   </div>
                   <div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Deployed At</div>
                      <div className="text-sm font-black text-slate-900 italic uppercase">
                         {u.role?.level >= 100 ? 'ROOT GOVERNANCE' : (u.organizationNode?.name || 'CENTRAL UNIT')}
                      </div>
                   </div>
                </div>

                {/* ACTIONS */}
                <div className="flex items-center gap-3">
                   <button onClick={() => handleOpenModal(u)} className="w-14 h-14 flex items-center justify-center bg-slate-50 text-slate-400 rounded-3xl hover:bg-slate-950 hover:text-white transition-all shadow-sm">
                      <Edit3 size={20} />
                   </button>
                   <button onClick={() => handleDelete(u.id)} className="w-14 h-14 flex items-center justify-center bg-rose-50 text-rose-400 rounded-3xl hover:bg-rose-600 hover:text-white transition-all shadow-sm">
                      <Trash2 size={20} />
                   </button>
                </div>
             </div>
           ))}
        </div>
      </div>

      {/* PROVISIONING MODAL */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? "RECONFIGURE CREDENTIALS" : "PROVISION PERSONNEL"}
        onConfirm={handleSubmit}
        confirmText="COMMIT TO REGISTRY"
        cancelText="ABORT"
        maxWidth="max-w-4xl"
      >
        <div className="space-y-10 p-2 overflow-y-auto max-h-[70vh] custom-scrollbar pr-4">
            {/* SECTION 1: IDENTITY */}
            <div className="space-y-6">
               <div className="flex items-center gap-3 px-2">
                  <Fingerprint className="text-blue-600" size={20} />
                  <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.3em]">Identity Matrix</h4>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Input label="Corporate ID" value={formData.employee_id || ''} onChange={e => setFormData({...formData, employee_id: e.target.value})} className="bg-slate-50 border-none rounded-2xl h-14 font-black" placeholder="AIR-0000" />
                  <Input label="System Username" value={formData.username || ''} onChange={e => setFormData({...formData, username: e.target.value})} className="bg-slate-50 border-none rounded-2xl h-14 font-black" placeholder="j.doe" />
                  <Input label="First Name" value={formData.first_name || ''} onChange={e => setFormData({...formData, first_name: e.target.value})} className="bg-slate-50 border-none rounded-2xl h-14 font-black" />
                  <Input label="Last Name" value={formData.last_name || ''} onChange={e => setFormData({...formData, last_name: e.target.value})} className="bg-slate-50 border-none rounded-2xl h-14 font-black" />
                  <Input label="Email" type="email" value={formData.email || ''} onChange={e => setFormData({...formData, email: e.target.value})} className="bg-slate-50 border-none rounded-2xl h-14 font-black" placeholder="j.doe@company.com" />
                  <Input label="Phone Number" value={formData.phone || ''} onChange={e => setFormData({...formData, phone: e.target.value})} className="bg-slate-50 border-none rounded-2xl h-14 font-black" placeholder="+254 700 000 000" />
               </div>
            </div>

            {/* SECTION 2: SECURITY & ROLE */}
            <div className="space-y-6 pt-6 border-t border-slate-100">
               <div className="flex items-center gap-3 px-2">
                  <ShieldAlert className="text-blue-600" size={20} />
                  <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.3em]">Clearance Protocol</h4>
               </div>
               <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {roles?.map(role => (
                    <div 
                      key={role.id}
                      onClick={() => handleRoleToggle(role.id)}
                      className={`flex flex-col items-center justify-center gap-3 p-6 rounded-[2rem] cursor-pointer transition-all border-2 ${
                        formData.role_ids?.includes(role.id) 
                          ? 'bg-slate-950 border-slate-950 text-white shadow-xl shadow-slate-200' 
                          : 'bg-slate-50 border-transparent hover:border-blue-200 text-slate-500'
                      }`}
                    >
                      <ShieldCheck size={20} className={formData.role_ids?.includes(role.id) ? "text-blue-400" : "text-slate-300"} />
                      <span className="text-[9px] font-black uppercase tracking-widest text-center leading-tight">
                        {role.name.replace('_', ' ')}
                      </span>
                    </div>
                  ))}
               </div>
               
               <Input 
                 label={editingItem ? "New Access Key (Leave blank to keep current)" : "Access Key"} 
                 type="password" 
                 value={formData.password || ''} 
                 onChange={e => setFormData({...formData, password: e.target.value})} 
                 className="bg-slate-950 text-white border-none rounded-2xl h-14 font-black placeholder:text-slate-700" 
                 placeholder={editingItem ? "••••••••" : "Minimum 8 characters"} 
               />
            </div>

            {/* SECTION 3: DEPLOYMENT */}
            <div className="space-y-6 pt-6 border-t border-slate-100">
               <div className="flex items-center gap-3 px-2">
                  <MapPin className="text-blue-600" size={20} />
                  <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.3em]">Operational Anchor</h4>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className={`space-y-3 transition-all duration-500 ${isSuperAdminRole ? 'opacity-30 grayscale pointer-events-none' : 'opacity-100'}`}>
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 italic">Node Assignment</label>
                     <CascadingUnitSelector
                        value={formData.org_node_id}
                        onChange={(id) => setFormData({ ...formData, org_node_id: id })}
                        className="bg-slate-50 border-none h-14 rounded-2xl font-black"
                     />
                  </div>

                  <div className="space-y-4">
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 italic">Account Lifecycle</label>
                     <div 
                       onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                       className={`flex items-center gap-4 p-6 rounded-[2.5rem] border-2 transition-all cursor-pointer ${formData.is_active ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-lg shadow-emerald-100' : 'bg-slate-50 border-slate-200 text-slate-400'}`}
                     >
                        {formData.is_active ? <CheckCircle2 size={24} /> : <XCircle size={24} />}
                        <div>
                           <span className="block text-xs font-black uppercase tracking-widest">ACTIVE STATUS</span>
                           <span className="block text-[8px] font-bold uppercase opacity-60">Authorize Institutional Access</span>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
        </div>
      </Modal>
    </div>
  );
};

export default UserManagement;
