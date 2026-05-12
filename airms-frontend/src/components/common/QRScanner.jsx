import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X, Camera, ShieldCheck, Search } from 'lucide-react';

const QRScanner = ({ onScanSuccess, onScanError, onClose }) => {
  const [isScanning, setIsScanning] = useState(true);

  useEffect(() => {
    // Initialize the scanner
    const scanner = new Html5QrcodeScanner("reader", {
      fps: 10,
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0
    });

    scanner.render((decodedText) => {
      // On Success
      setIsScanning(false);
      scanner.clear();
      if (onScanSuccess) onScanSuccess(decodedText);
    }, (error) => {
      // On Error (usually just "QR not found" while searching)
      if (onScanError) onScanError(error);
    });

    // Cleanup on unmount
    return () => {
      scanner.clear().catch(err => console.error("Scanner cleanup error", err));
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-xl p-4 md:p-8">
      <div className="w-full max-w-2xl bg-white rounded-[40px] overflow-hidden shadow-2xl relative">
        
        {/* Header */}
        <div className="p-8 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <Camera size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black text-slate-900 uppercase italic tracking-tighter">Asset Scanner</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Real-time QR Telemetry</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all"
          >
            <X size={24} />
          </button>
        </div>

        {/* Scanner Body */}
        <div className="p-8">
          <div className="relative aspect-square w-full max-w-md mx-auto bg-slate-950 rounded-[3rem] overflow-hidden border-4 border-slate-900 shadow-inner">
             {/* The Scanner Viewport */}
             <div id="reader" className="w-full h-full"></div>
             
             {/* Overlay Scanned UI */}
             {!isScanning && (
               <div className="absolute inset-0 bg-blue-600/90 flex flex-col items-center justify-center text-white space-y-4 animate-in fade-in zoom-in duration-300">
                 <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center">
                    <ShieldCheck size={40} />
                 </div>
                 <h4 className="text-xl font-black uppercase italic tracking-tighter">Item Identified</h4>
               </div>
             )}
          </div>

          <div className="mt-10 text-center space-y-4">
             <div className="flex items-center justify-center gap-2 text-slate-400">
                <Search size={16} />
                <span className="text-xs font-bold uppercase tracking-widest">Scanning for AIRMS Label...</span>
             </div>
             <p className="text-xs text-slate-500 max-w-sm mx-auto">
               Position the QR code within the central frame to instantly access asset details and command protocols.
             </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-8 bg-slate-50 text-center">
           <div className="inline-flex items-center gap-3 px-6 py-3 bg-white rounded-2xl border border-slate-200 text-xs font-bold text-slate-600">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Lens Active • Optical Link Established
           </div>
        </div>
      </div>
    </div>
  );
};

export default QRScanner;
