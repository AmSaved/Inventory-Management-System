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
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => navigate('/inventory')}
                className="w-10 h-10 rounded-lg bg-slate-50 text-slate-500 hover:text-slate-900"
              >
                <ArrowLeft size={16} />
              </Button>
              <div>
                <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-3">
                  Asset Profile
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusColor(item.status)}`}>
                    {item.status.replace('_', ' ')}
                  </span>
                </h1>
                <p className="text-xs font-semibold text-slate-400 mt-1">
                  Registered ID: {item.id}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setQrModalOpen(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg shadow-sm flex items-center gap-2"
              >
                <QrCode size={14} />
                <span className="font-bold text-xs">Print ID Label</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          
          {/* Left Column: Specs & Details */}
          <div className="lg:col-span-2 space-y-5">
            
            {/* Identity Card */}
            <Card className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4 flex items-center gap-4">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-lg flex items-center justify-center">
                  <Package size={20} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white tracking-tight">{item.product?.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <Tag size={12} className="text-blue-200" />
                    <span className="text-xs font-semibold text-blue-100">{item.product?.category}</span>
                  </div>
                </div>
              </div>
              
              <CardContent className="p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 flex items-center gap-2">
                      <Hash size={12} /> Serial Number
                    </label>
                    <p className="text-sm font-bold text-slate-900">{item.serial_number || 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 flex items-center gap-2">
                      <Hash size={12} /> Batch / Lot
                    </label>
                    <p className="text-sm font-bold text-slate-900">{item.batch_number || 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 flex items-center gap-2">
                      <Tag size={12} /> Stock Keeping Unit (SKU)
                    </label>
                    <p className="text-sm font-bold text-slate-900">{item.product?.sku}</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 flex items-center gap-2">
                      <Activity size={12} /> Condition
                    </label>
                    <p className="text-sm font-bold text-slate-900 capitalize">{item.condition}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Location & Ownership */}
            <Card className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <CardContent className="p-5">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <MapPin size={14} className="text-emerald-500" /> 
                  Location & Custody
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 rounded-xl p-4 border border-slate-100">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 flex items-center gap-2">
                      <Building2 size={12} /> Assigned Branch
                    </label>
                    <p className="text-sm font-bold text-slate-900">{item.organizationNode?.name}</p>
                    <p className="text-[10px] font-semibold text-slate-400 uppercase">{item.organizationNode?.code}</p>
                  </div>
                  
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-400 flex items-center gap-2">
                      <MapPin size={12} /> Specific Location
                    </label>
                    <p className="text-sm font-bold text-slate-900">{item.location_details || 'Unspecified Location'}</p>
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-400 flex items-center gap-2">
                      <Package size={12} /> Current Quantity
                    </label>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-xl font-bold text-slate-900">{item.quantity}</span>
                      <span className="text-xs font-semibold text-slate-400">units</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column: Lifecycle Timeline */}
          <div className="lg:col-span-1">
            <Card className="rounded-xl border border-slate-200 bg-white shadow-sm h-full overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                  <History size={14} className="text-blue-500" /> 
                  Lifecycle History
                </h3>
              </div>
              
              <CardContent className="p-4 flex-1 overflow-y-auto max-h-[600px]">
                {!item.activity_logs || item.activity_logs.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Activity size={24} className="mx-auto mb-3 opacity-50" />
                    <p className="text-xs font-bold">No history logs found.</p>
                  </div>
                ) : (
                  <div className="relative border-l-2 border-slate-100 ml-3 space-y-6 py-2">
                    {item.activity_logs.map((log, index) => (
                      <div key={log.id} className="relative pl-6">
                        {/* Timeline Node */}
                        <div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full bg-white border-2 border-blue-500 shadow-sm" />
                        
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <span className="text-xs font-bold text-slate-900 tracking-wide uppercase">
                              {log.action.replace(/_/g, ' ')}
                            </span>
                            <span className="text-[9px] font-semibold text-slate-400 flex items-center gap-1">
                              <Calendar size={10} />
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </div>
                          
                          <p className="text-xs text-slate-500 font-medium">
                            {log.user ? `${log.user.first_name} ${log.user.last_name}` : 'System'}
                          </p>
                          
                          {log.details && (
                            <div className="mt-2 bg-slate-50 rounded-lg p-2.5 border border-slate-100 text-xs text-slate-600 font-mono">
                              {Object.entries(log.details).map(([key, value]) => (
                                <div key={key} className="flex gap-2">
                                  <span className="text-slate-400 font-semibold">{key}:</span>
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
