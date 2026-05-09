import React, { useState, useMemo } from 'react';
import { useFetch } from '../../hooks/useFetch';
import Button from '../ui/Button';
import Table, { TableHead, TableHeader, TableBody, TableRow, TableCell } from '../ui/Table';
import Modal from '../common/Modal';
import Input from '../ui/Input';
import Select from '../ui/Select';
import permissionService from '../../services/permissionService';
import toast from 'react-hot-toast';
import LoadingSpinner from '../common/LoadingSpinner';
import { ShieldAlert, Plus, Search, Filter, ShieldCheck, Trash2, Edit3 } from 'lucide-react';

const PermissionManagement = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({ name: '', resource: '', action: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterResource, setFilterResource] = useState('all');

  const { data: permissions, loading, refetch } = useFetch('/permissions');

  const resources = useMemo(() => {
    if (!permissions) return [];
    return ['all', ...new Set(permissions.map(p => p.resource))];
  }, [permissions]);

  const filteredPermissions = useMemo(() => {
    if (!permissions) return [];
    return permissions.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           p.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterResource === 'all' || p.resource === filterResource;
      return matchesSearch && matchesFilter;
    });
  }, [permissions, searchTerm, filterResource]);

  const handleOpenModal = (item = null) => {
    if (item) {
      setEditingItem(item);
      setFormData({ ...item });
    } else {
      setEditingItem(null);
      setFormData({ name: '', resource: '', action: '', description: '' });
    }
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.resource || !formData.action) {
      return toast.error('Name, Resource, and Action are required');
    }

    setSubmitting(true);
    try {
      if (editingItem) {
        await permissionService.updatePermission(editingItem.id, formData);
        toast.success('Permission updated successfully');
      } else {
        await permissionService.createPermission(formData);
        toast.success('Permission created successfully');
      }
      refetch();
      setModalOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this permission? This may break existing roles.')) return;
    try {
      await permissionService.deletePermission(id);
      toast.success('Permission removed');
      refetch();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-slate-900 p-8 rounded-[40px] shadow-2xl border-b-4 border-slate-800 gap-6">
        <div className="flex items-center gap-5">
           <div className="w-16 h-16 bg-blue-600 rounded-[28px] flex items-center justify-center shadow-lg shadow-blue-500/20 rotate-3">
              <ShieldAlert className="text-white" size={28} />
           </div>
           <div className="space-y-1">
             <h2 className="text-3xl font-black text-white tracking-tighter uppercase italic">Access Protocols</h2>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">System Function Registry</p>
           </div>
        </div>
        <Button 
          onClick={() => handleOpenModal()} 
          className="flex items-center space-x-3 bg-blue-600 hover:bg-blue-500 text-white px-10 h-16 rounded-[28px] font-black uppercase text-xs tracking-widest shadow-xl shadow-blue-500/20 transition-all active:scale-95"
        >
          <Plus size={18} strokeWidth={3} />
          <span>New Protocol</span>
        </Button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-[30px] border border-slate-100 shadow-sm">
        <div className="flex-1 relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={18} />
          <input 
            type="text" 
            placeholder="Search function strings or descriptions..." 
            className="w-full pl-12 pr-4 py-4 bg-slate-50 border-none rounded-2xl text-sm font-bold text-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 px-4 bg-slate-50 rounded-2xl border border-slate-100">
           <Filter size={16} className="text-slate-400" />
           <select 
             className="bg-transparent border-none py-4 text-xs font-black uppercase tracking-widest text-slate-600 outline-none cursor-pointer"
             value={filterResource}
             onChange={(e) => setFilterResource(e.target.value)}
           >
             {resources.map(res => (
               <option key={res} value={res}>{res === 'all' ? 'All Resources' : res.replace('_', ' ')}</option>
             ))}
           </select>
        </div>
      </div>

      {/* Permissions Table */}
      <div className="bg-white rounded-[40px] shadow-xl border border-slate-100 overflow-hidden">
        <Table>
          <TableHead>
            <TableRow className="bg-slate-50/50">
              <TableHeader className="pl-8">Protocol String</TableHeader>
              <TableHeader>Resource Group</TableHeader>
              <TableHeader>Definition / Action</TableHeader>
              <TableHeader className="text-right pr-8">Commands</TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredPermissions.map((perm) => (
              <TableRow key={perm.id} className="hover:bg-slate-50/30 transition-colors group">
                <TableCell className="pl-8">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                      <ShieldCheck size={16} />
                    </div>
                    <code className="text-xs font-black text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-100 leading-none">
                      {perm.name}
                    </code>
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 px-3 py-1 rounded-full border border-slate-100">
                    {perm.resource}
                  </span>
                </TableCell>
                <TableCell>
                   <div className="max-w-xs">
                      <div className="text-sm font-bold text-slate-700 capitalize">{perm.action.replace('-', ' ')}</div>
                      <div className="text-[10px] text-slate-400 truncate font-medium">{perm.description || 'No detailed definition available'}</div>
                   </div>
                </TableCell>
                <TableCell className="text-right pr-8">
                  <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleOpenModal(perm)}
                      className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(perm.id)}
                      className="p-3 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        
        {filteredPermissions.length === 0 && (
          <div className="p-20 text-center space-y-4">
             <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                <Search size={32} className="text-slate-200" />
             </div>
             <p className="text-sm font-bold text-slate-400 italic">No matching protection protocols found.</p>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingItem ? 'Refine Protocol' : 'Initialize New Protocol'}
        onConfirm={handleSubmit}
        confirmText={submitting ? 'Processing...' : (editingItem ? 'Update Protocol' : 'Deploy Protocol')}
      >
        <div className="space-y-6">
          <div className="bg-blue-50 p-6 rounded-3xl border border-blue-100 mb-6">
             <p className="text-[10px] text-blue-700 font-black uppercase tracking-widest leading-relaxed">
               Warning: System functions are core architectural anchors. Modifying or deleting these may restrict access for users who depend on these specific keys.
             </p>
          </div>

          <div className="grid grid-cols-2 gap-6">
            <Input
              label="Function Identifier (Name)"
              placeholder="e.g. item:request"
              value={formData.name || ''}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <Input
              label="Resource Group"
              placeholder="e.g. items"
              value={formData.resource || ''}
              onChange={(e) => setFormData({ ...formData, resource: e.target.value })}
              required
            />
          </div>
          
          <div className="grid grid-cols-2 gap-6">
             <Input
                label="Action Key"
                placeholder="e.g. request"
                value={formData.action || ''}
                onChange={(e) => setFormData({ ...formData, action: e.target.value })}
                required
              />
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest pl-1">Inheritance Level</label>
                 <div className="h-12 bg-slate-50 rounded-2xl border border-slate-100 flex items-center px-4 text-xs font-bold text-slate-400">
                    Automatic - Global Registry
                 </div>
              </div>
          </div>

          <Input
            label="Conceptual Definition / Description"
            placeholder="Explain what system capability this protocol provides..."
            value={formData.description || ''}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            multiline
            rows={3}
          />
        </div>
      </Modal>
    </div>
  );
};

export default PermissionManagement;
