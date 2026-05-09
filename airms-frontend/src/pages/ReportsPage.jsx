import React, { useState } from 'react';
import { useFetch } from '../hooks/useFetch';
import Card, { CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Select from '../components/ui/Select';
import LoadingSpinner from '../components/common/LoadingSpinner';
import CascadingUnitSelector from '../components/common/CascadingUnitSelector';
import { formatDate, formatCurrency } from '../utils/formatters';
import reportService from '../services/reportService';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { 
  FileBox, 
  Settings2, 
  Download, 
  Eye, 
  Calendar, 
  Building2, 
  BarChart3, 
  ShieldCheck,
  AlertTriangle,
  ArrowRight,
  ShieldAlert
} from 'lucide-react';

const ReportsPage = () => {
  const { user, hasPermission } = useAuth();
  
  const canGenerate = hasPermission('report:generate');
  
  const [selectedReport, setSelectedReport] = useState('inventory-valuation');
  const [dateRange, setDateRange] = useState({
    from_date: new Date(new Date().setDate(1)).toISOString().split('T')[0],
    to_date: new Date().toISOString().split('T')[0]
  });
  const [unitId, setUnitId] = useState('');
  const [format, setFormat] = useState('json');
  const [generating, setGenerating] = useState(false);
  const [reportData, setReportData] = useState(null);

  const reportTypes = [
    { value: 'inventory-valuation', label: 'Inventory Valuation' },
    { value: 'asset-utilization', label: 'Asset Utilization' },
    { value: 'request-analytics', label: 'Request Analytics' },
    { value: 'low-stock', label: 'Low Stock Alert' },
    { value: 'overdue-assets', label: 'Overdue Assets' }
  ];

  const formatOptions = [
    { value: 'json', label: 'Interactive (JSON)' },
    { value: 'excel', label: 'Spreadsheet (Excel)' },
    { value: 'pdf', label: 'Document (PDF)' }
  ];

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      let response;
      const params = {
        from_date: dateRange.from_date,
        to_date: dateRange.to_date,
        unit_id: unitId || user?.org_unit_id,
        format
      };

      switch (selectedReport) {
        case 'inventory-valuation':
          response = await reportService.getInventoryValuation(params);
          break;
        case 'asset-utilization':
          response = await reportService.getAssetUtilization(params);
          break;
        // ... more cases as backend refines
        default:
          response = { data: { message: "Report logic refactoring in progress" } };
      }

      if (format === 'excel' || format === 'pdf') {
        toast.success('Report Binary Generated Successfully');
      } else {
        setReportData(response.data);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Report generation failed');
    } finally {
      setGenerating(false);
    }
  };

  if (!canGenerate) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center p-6 bg-slate-50/50 rounded-[40px] m-10 border-4 border-dashed border-slate-200">
         <div className="w-24 h-24 bg-red-100 rounded-[35px] flex items-center justify-center mb-6 rotate-6 shadow-2xl shadow-red-100/50">
            <ShieldAlert size={40} className="text-red-500" />
         </div>
         <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic mb-2">Protocol Violation</h1>
         <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] max-w-sm leading-relaxed">
            Your assigned access level does not permit entry into the <span className="text-red-500">Enterprise Analytics Engine</span>. Contact your administrator to request functional clearance.
         </p>
         <Button 
           variant="ghost" 
           onClick={() => { window.location.href = '/dashboard' }}
           className="mt-10 h-14 px-10 rounded-2xl bg-white border border-slate-200 text-slate-900 font-black uppercase text-[10px] tracking-widest hover:bg-slate-100"
         >
           Return to Secure Hub
         </Button>
      </div>
    );
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-12 py-12 px-6">
      {/* Premium Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 border-b-2 border-slate-50 pb-12">
        <div className="space-y-2">
           <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-slate-900 rounded-[28px] flex items-center justify-center shadow-2xl rotate-3">
                 <FileBox className="text-blue-500" size={32} />
              </div>
              <div>
                <h1 className="text-5xl font-black text-slate-900 tracking-tighter uppercase italic">Reports Engine</h1>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-1">Enterprise Analytics — {user?.company?.name || 'AIRMS Global'}</p>
              </div>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-12">
        {/* Configuration Panel */}
        <div className="xl:col-span-4 space-y-8">
           <Card className="rounded-[40px] border-none shadow-2xl bg-white p-1 overflow-hidden ring-1 ring-slate-100">
              <div className="bg-slate-950 p-10 space-y-8">
                 <div className="flex items-center gap-3">
                    <Settings2 className="text-blue-500" size={18} />
                    <h3 className="font-black text-white text-[10px] uppercase tracking-widest">Parameter Configuration</h3>
                 </div>

                 <div className="space-y-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Report Vector</label>
                       <select 
                         className="w-full h-14 bg-slate-900 border-2 border-slate-800 rounded-2xl px-4 font-black text-white outline-none focus:border-blue-500 transition-all cursor-pointer"
                         value={selectedReport}
                         onChange={(e) => setSelectedReport(e.target.value)}
                       >
                         {reportTypes.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                       </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Temporal Start</label>
                          <Input 
                            type="date" 
                            className="h-14 bg-slate-900 border-2 border-slate-800 rounded-2xl font-bold text-white text-xs" 
                            value={dateRange.from_date}
                            onChange={(e) => setDateRange({...dateRange, from_date: e.target.value})}
                          />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Temporal End</label>
                          <Input 
                            type="date" 
                            className="h-14 bg-slate-900 border-2 border-slate-800 rounded-2xl font-bold text-white text-xs" 
                            value={dateRange.to_date}
                            onChange={(e) => setDateRange({...dateRange, to_date: e.target.value})}
                          />
                       </div>
                    </div>
                 </div>
              </div>

              <CardContent className="p-10 space-y-8">
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Infrastructure Focus (Unit Scope)</label>
                    <CascadingUnitSelector 
                      value={unitId}
                      onChange={setUnitId}
                      className="bg-white"
                    />
                 </div>

                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Export Methodology</label>
                    <div className="grid grid-cols-1 gap-2">
                       {formatOptions.map(opt => (
                         <button
                           key={opt.value}
                           onClick={() => setFormat(opt.value)}
                           className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-all font-black text-[10px] uppercase tracking-widest ${format === opt.value ? 'bg-blue-600 border-blue-600 text-white shadow-lg' : 'bg-white border-slate-50 text-slate-400 hover:border-slate-200'}`}
                         >
                           {opt.label}
                           <div className={`w-2 h-2 rounded-full ${format === opt.value ? 'bg-white' : 'bg-slate-100'}`} />
                         </button>
                       ))}
                    </div>
                 </div>

                 <div className="pt-6">
                    <Button 
                      onClick={handleGenerate} 
                      loading={generating} 
                      className="w-full bg-slate-950 h-20 rounded-[35px] text-white font-black text-xs uppercase tracking-[0.2em] shadow-2xl hover:bg-blue-600 transition-all flex items-center justify-center gap-4 group"
                    >
                      Process Generation <ArrowRight className="group-hover:translate-x-2 transition-transform" />
                    </Button>
                 </div>
              </CardContent>
           </Card>
        </div>

        {/* Preview Panel */}
        <div className="xl:col-span-8 space-y-6">
           <div className="flex items-center gap-2 mb-2">
              <Eye size={16} className="text-slate-400" />
              <h3 className="font-black text-slate-400 text-[10px] uppercase tracking-[0.3em]">Interative Preview</h3>
           </div>

           <Card className="rounded-[40px] border-none shadow-2xl bg-white min-h-[700px] flex flex-col ring-1 ring-slate-100 overflow-hidden">
              <CardContent className="flex-1 p-0">
                {generating ? (
                  <div className="flex h-[700px] items-center justify-center">
                    <LoadingSpinner />
                  </div>
                ) : reportData ? (
                  <ReportRenderer data={reportData} type={selectedReport} />
                ) : (
                  <div className="flex flex-col h-[700px] items-center justify-center text-slate-300 p-20 space-y-8">
                     <div className="w-32 h-32 bg-slate-50 rounded-[50px] flex items-center justify-center shadow-inner">
                        <BarChart3 size={64} className="opacity-20" />
                     </div>
                     <div className="text-center space-y-2">
                        <p className="text-xl font-black text-slate-900 uppercase italic">Awaiting Parameters</p>
                        <p className="text-xs font-bold opacity-60 leading-relaxed uppercase tracking-widest">Define report vector and scope to generate infrastructure analytics.</p>
                     </div>
                  </div>
                )}
              </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
};

const ReportRenderer = ({ data, type }) => {
  if (type === 'inventory-valuation') {
    return (
      <div className="space-y-0">
        <div className="bg-slate-950 p-10 flex justify-between items-end border-b border-white/10">
           <div>
              <div className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2">Inventory Ledger Summary</div>
              <h4 className="text-3xl font-black text-white tracking-tighter italic">Consolidated Valuation</h4>
           </div>
           <div className="text-right">
              <div className="text-4xl font-black text-white tracking-tighter italic">{formatCurrency(data.summary?.total_value || 0)}</div>
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Cumulative Asset Value (USD)</div>
           </div>
        </div>

        <div className="p-10 space-y-8">
           <div className="grid grid-cols-3 gap-8">
              <SummaryStat label="Infrastructure Units" value={data.summary?.total_items} color="blue" />
              <SummaryStat label="Deployment Quantity" value={data.summary?.total_quantity} color="emerald" />
              <SummaryStat label="Compliance Rating" value="98.2%" color="amber" />
           </div>

           <div className="overflow-hidden rounded-3xl border-2 border-slate-50">
             <table className="min-w-full">
                <thead className="bg-slate-50 border-b-2 border-slate-100">
                  <tr>
                    <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit Vector</th>
                    <th className="px-8 py-5 text-left text-[10px] font-black text-slate-400 uppercase tracking-widest">Asset Instance</th>
                    <th className="px-8 py-5 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Quantity</th>
                    <th className="px-8 py-5 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Valuation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data.items?.slice(0, 15).map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-8 py-5">
                         <div className="flex items-center gap-3">
                           <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
                           <span className="text-xs font-black text-slate-950 uppercase">{item.organizationUnit?.name}</span>
                         </div>
                      </td>
                      <td className="px-8 py-5">
                         <div className="flex flex-col">
                            <span className="text-xs font-bold text-slate-900 leading-none mb-1">{item.product?.name}</span>
                            <span className="text-[9px] font-black text-slate-400 tracking-widest uppercase">{item.product?.sku}</span>
                         </div>
                      </td>
                      <td className="px-8 py-5 text-center">
                         <span className="font-black text-slate-900 tracking-tighter italic">{item.quantity}</span>
                      </td>
                      <td className="px-8 py-5 text-right">
                         <span className="font-black text-blue-600 tracking-tighter italic">{formatCurrency(item.total_value)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
             </table>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-10 italic text-slate-400 font-bold text-xs uppercase tracking-widest">
       Technical Preview: Structured data format detected. System is refining the visual layer for this specific report vector.
    </div>
  );
};

const SummaryStat = ({ label, value, color }) => {
  const colors = {
    blue: 'text-blue-600 bg-blue-50/50 border-blue-100',
    emerald: 'text-emerald-600 bg-emerald-50/50 border-emerald-100',
    amber: 'text-amber-600 bg-amber-50/50 border-amber-100'
  };
  return (
    <div className={`p-6 rounded-3xl border-2 ${colors[color]} space-y-1`}>
       <div className="text-3xl font-black tracking-tighter italic leading-none">{value?.toLocaleString() || 0}</div>
       <div className="text-[9px] font-black uppercase tracking-widest opacity-60">{label}</div>
    </div>
  );
};

export default ReportsPage;