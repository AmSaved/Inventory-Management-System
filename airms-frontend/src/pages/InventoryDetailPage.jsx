import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { 
  ArrowLeft, Package, MapPin, Tag, Activity, 
  History, Calendar, Hash, CheckCircle2,
  Building2, QrCode, AlertCircle
} from 'lucide-react';
import Card, { CardContent } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import QRLabel from '../components/inventory/QRLabel';
import Modal from '../components/common/Modal';

const InventoryDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [qrModalOpen, setQrModalOpen] = useState(false);

  const { data: item, isLoading, error } = useQuery({
    queryKey: ['inventory', id],
    queryFn: async () => {
      const res = await api.get(`/inventory/${id}`);
      return res.data.data;
    }
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-4">
        <AlertCircle size={48} className="text-red-400" />
        <h2 className="text-xl font-bold text-slate-800">Asset Not Found</h2>
        <Button onClick={() => navigate('/inventory')} variant="outline">Return to Ledger</Button>
      </div>
    );
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'available': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'in_use': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'maintenance': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'retired': return 'bg-slate-100 text-slate-700 border-slate-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/inventory')}
                className="w-10 h-10 rounded-xl bg-slate-50 text-slate-500 hover:text-slate-900"
              >
                <ArrowLeft size={18} />
              </Button>
              <div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                  Asset Profile
                  <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border ${getStatusColor(item.status)}`}>
                    {item.status.replace('_', ' ')}
                  </span>
                </h1>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">
                  Registered ID: {item.id}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setQrModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-200 flex items-center gap-2"
              >
                <QrCode size={16} />
                <span className="font-bold tracking-wide">Print ID Label</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Specs & Details */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* Identity Card */}
            <Card className="rounded-[32px] border-none bg-white shadow-2xl shadow-slate-100 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center">
                  <Package size={32} className="text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight">{item.product?.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Tag size={14} className="text-blue-200" />
                    <span className="text-sm font-bold text-blue-100">{item.product?.category}</span>
                  </div>
                </div>
              </div>
              
              <CardContent className="p-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Hash size={12} /> Serial Number
                    </label>
                    <p className="text-base font-bold text-slate-900">{item.serial_number || 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Hash size={12} /> Batch / Lot
                    </label>
                    <p className="text-base font-bold text-slate-900">{item.batch_number || 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Tag size={12} /> Stock Keeping Unit (SKU)
                    </label>
                    <p className="text-base font-bold text-slate-900">{item.product?.sku}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Activity size={12} /> Condition
                    </label>
                    <p className="text-base font-bold text-slate-900 capitalize">{item.condition}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Location & Ownership */}
            <Card className="rounded-[32px] border-none bg-white shadow-2xl shadow-slate-100 overflow-hidden">
              <CardContent className="p-8">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest mb-6 flex items-center gap-2">
                  <MapPin size={16} className="text-emerald-500" /> 
                  Location & Custody
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 bg-slate-50 rounded-3xl p-6 border border-slate-100">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Building2 size={12} /> Assigned Branch
                    </label>
                    <p className="text-sm font-bold text-slate-900">{item.organizationNode?.name}</p>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">{item.organizationNode?.code}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <MapPin size={12} /> Specific Location
                    </label>
                    <p className="text-sm font-bold text-slate-900">{item.location_details || 'Unspecified Location'}</p>
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                      <Package size={12} /> Current Quantity
                    </label>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-3xl font-black text-slate-900">{item.quantity}</span>
                      <span className="text-xs font-bold text-slate-400">units</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Lifecycle Timeline */}
          <div className="lg:col-span-1">
            <Card className="rounded-[32px] border-none bg-white shadow-2xl shadow-slate-100 h-full overflow-hidden flex flex-col">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                  <History size={16} className="text-blue-500" /> 
                  Lifecycle History
                </h3>
              </div>
              
              <CardContent className="p-6 flex-1 overflow-y-auto max-h-[600px]">
                {!item.activity_logs || item.activity_logs.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Activity size={32} className="mx-auto mb-3 opacity-50" />
                    <p className="text-xs font-bold">No history logs found.</p>
                  </div>
                ) : (
                  <div className="relative border-l-2 border-slate-100 ml-3 space-y-8 py-4">
                    {item.activity_logs.map((log, index) => (
                      <div key={log.id} className="relative pl-6">
                        {/* Timeline Node */}
                        <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-white border-2 border-blue-500 shadow-sm" />
                        
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="text-xs font-black text-slate-900 tracking-wide uppercase">
                              {log.action.replace(/_/g, ' ')}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                              <Calendar size={10} />
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </div>
                          
                          <p className="text-xs text-slate-600 font-medium">
                            {log.user ? `${log.user.first_name} ${log.user.last_name}` : 'System'}
                          </p>
                          
                          {log.details && (
                            <div className="mt-2 bg-slate-50 rounded-xl p-3 border border-slate-100 text-[11px] text-slate-600 font-mono">
                              {Object.entries(log.details).map(([key, value]) => (
                                <div key={key} className="flex gap-2">
                                  <span className="text-slate-400 font-bold">{key}:</span>
                                  <span>{typeof value === 'object' ? JSON.stringify(value) : value}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        </div>
      </div>

      <Modal isOpen={qrModalOpen} onClose={() => setQrModalOpen(false)} title="Print Asset ID">
        <QRLabel item={item} onClose={() => setQrModalOpen(false)} />
      </Modal>
    </div>
  );
};

export default InventoryDetailPage;
