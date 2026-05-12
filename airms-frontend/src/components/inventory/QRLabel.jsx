import React from 'react';
import QRCode from 'react-qr-code';
import { Package, ShieldCheck } from 'lucide-react';

const QRLabel = ({ item, organizationName = 'AIRMS' }) => {
  if (!item) return null;

  // The value encoded in the QR code. 
  // We use a deep-link URL that pointing to the item detail page.
  const qrValue = `${window.location.origin}/inventory/${item.id}`;

  return (
    <div className="bg-white p-6 border-2 border-slate-200 rounded-3xl w-full max-w-sm mx-auto shadow-sm print:shadow-none print:border-slate-300 print:rounded-none">
      {/* Label Header */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-slate-900 rounded-xl flex items-center justify-center">
            <ShieldCheck className="text-blue-500" size={18} />
          </div>
          <div>
            <h3 className="text-[10px] font-black text-slate-900 uppercase tracking-widest leading-none">{organizationName}</h3>
            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-1">Asset Registry</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-black text-blue-600 uppercase">#{item.id}</div>
        </div>
      </div>

      {/* QR Code Section */}
      <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl mb-6 border border-slate-100 print:bg-white print:border-none">
        <div className="bg-white p-3 rounded-xl shadow-sm border border-slate-100">
          <QRCode
            size={120}
            style={{ height: "auto", maxWidth: "100%", width: "100%" }}
            value={qrValue}
            viewBox={`0 0 256 256`}
          />
        </div>
        <p className="text-[9px] font-bold text-slate-400 mt-4 uppercase tracking-[0.2em]">Scan for Details</p>
      </div>

      {/* Asset Metadata */}
      <div className="space-y-3">
        <div>
          <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Asset Name</label>
          <div className="text-sm font-bold text-slate-900 truncate uppercase italic">{item.product?.name || 'Unknown Asset'}</div>
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">SKU / Model</label>
            <div className="text-[10px] font-bold text-slate-700 uppercase">{item.product?.sku || 'N/A'}</div>
          </div>
          <div className="text-right">
            <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Serial Number</label>
            <div className="text-[10px] font-bold text-slate-700 uppercase">{item.serial_number || 'NO-SERIAL'}</div>
          </div>
        </div>
      </div>

      {/* Print Instructions (Hidden on screen) */}
      <div className="hidden print:block mt-6 pt-4 border-t border-dashed border-slate-200 text-center">
        <p className="text-[7px] text-slate-400 italic">Property of {organizationName} • Do not remove label</p>
      </div>
    </div>
  );
};

export default QRLabel;
