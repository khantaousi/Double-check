import React, { useState } from 'react';
import Barcode from 'react-barcode';
import html2pdf from 'html2pdf.js';
import { DataRow, SiteSettings } from '../types';

interface PrintSlipsProps {
  data: DataRow[];
  settings: SiteSettings;
  onBack: () => void;
}

export function PrintSlips({ data, settings, onBack }: PrintSlipsProps) {
  const [selectedStore, setSelectedStore] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareFile, setShareFile] = useState<File | null>(null);

  const stores = Array.from(new Set(data.map(d => d.StoreName).filter(Boolean)));
  
  const handlePrint = () => {
    window.focus();
    setTimeout(() => {
      window.print();
    }, 100);
  };

  const generatePdfBlob = async (): Promise<Blob | null> => {
    const element = document.getElementById('slips-container');
    if (!element) return null;

    // Fix for html2canvas blank page issue
    const originalScrollY = window.scrollY;
    window.scrollTo(0, 0);

    const opt = {
      margin:       [10, 5, 10, 5] as [number, number, number, number],
      filename:     `print-slips-${new Date().getTime()}.pdf`,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, letterRendering: true, windowWidth: document.documentElement.offsetWidth, scrollY: 0 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
      pagebreak:    { mode: ['css', 'legacy'] }
    };

    try {
      return await html2pdf().set(opt).from(element).output('blob');
    } catch(e) {
      console.error(e);
      return null;
    } finally {
      window.scrollTo(0, originalScrollY);
    }
  };

  const handleDownload = async () => {
    setIsGenerating(true);
    const blob = await generatePdfBlob();
    if (blob) {
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `print-slips-${new Date().getTime()}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
    setIsGenerating(false);
  };


  const currentData = selectedStore ? data.filter(d => d.StoreName === selectedStore) : data;
  
  const chunks = [];
  for (let i = 0; i < currentData.length; i += 6) {
    chunks.push(currentData.slice(i, i + 6));
  }

  const formatPhone = (phone: string | number | undefined) => {
    if (!phone) return 'N/A';
    return String(phone).padStart(11, '0');
  };

  const toProperCase = (str: string | undefined) => {
    if (!str) return 'N/A';
    return str.replace(
      /\w\S*/g,
      (txt) => txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
  };

  return (
    <div className="bg-slate-100 min-h-screen z-[200] relative print:bg-white pb-20">
      <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[100] gap-3 flex print:hidden shadow-xl bg-white p-2 rounded-xl border border-slate-200">
        <div className="flex items-center gap-2 pr-3 border-r border-slate-200">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest pl-1">Store:</label>
          <select 
            value={selectedStore} 
            onChange={e => setSelectedStore(e.target.value)}
            className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Stores ({data.length})</option>
          {stores.map(s => (
            <option key={s} value={s}>{s} ({data.filter(d => d.StoreName === s).length})</option>
          ))}
        </select>
      </div>
      <button 
        onClick={onBack}
        className="px-3 py-1.5 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-200 uppercase tracking-widest transition-colors"
      >
        Cancel
      </button>
      <button 
        onClick={handlePrint}
        className="px-3 py-1.5 bg-slate-800 text-white text-xs font-bold rounded-lg uppercase tracking-widest transition-colors shadow-sm hover:bg-slate-700"
      >
        Print
      </button>
      <button 
        onClick={async () => {
          if (shareFile) {
            try {
              await navigator.share({
                files: [shareFile],
                title: 'Print Slips PDF'
              });
            } catch (e) {
              console.error(e);
            }
            setShareFile(null);
            return;
          }

          setIsGenerating(true);
          const blob = await generatePdfBlob();
          if (blob) {
            const filename = `print-slips-${new Date().getTime()}.pdf`;
            const file = new File([blob], filename, { type: 'application/pdf' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              setShareFile(file);
            } else {
              alert("Direct sharing to Drive is not supported on this device/browser. Downloading instead.");
              const url = URL.createObjectURL(blob);
              const link = document.createElement('a');
              link.href = url;
              link.download = filename;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
            }
          }
          setIsGenerating(false);
        }}
        disabled={isGenerating}
        className={`px-3 py-1.5 ${shareFile ? 'bg-amber-500 hover:bg-amber-600 animate-pulse' : 'bg-emerald-600 hover:bg-emerald-700'} text-white text-xs font-bold rounded-lg uppercase tracking-widest transition-colors shadow-sm ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {isGenerating ? 'Preparing...' : shareFile ? 'Tap to Submit to Drive' : 'Share / Drive'}
      </button>
      <button 
        onClick={handleDownload}
        disabled={isGenerating}
          className={`px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg uppercase tracking-widest transition-colors shadow-sm hover:bg-blue-700 ${isGenerating ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isGenerating ? 'Wait...' : 'Download PDF'}
        </button>
      </div>

      <div id="slips-container" style={{ backgroundColor: '#ffffff' }} className="mx-auto print:py-0">
        {chunks.map((pageSlips, pageIndex) => (
          <div key={pageIndex} className="a4-page grid grid-cols-2 gap-[5mm] p-[10mm]">
            {pageSlips.map((row) => (
              <div key={row.id} style={{ backgroundColor: '#ffffff', borderColor: '#9ca3af' }} className="slip-card border border-dashed p-3 flex flex-col justify-between break-inside-avoid overflow-hidden">
                
                <div style={{ borderColor: '#000000' }} className="flex justify-between items-start w-full border-b pb-1 mb-1">
                  {/* Left Logo / Company */}
                  <div className="flex flex-col items-start w-1/3">
                    {settings.logoUrl ? (
                      <img src={settings.logoUrl} alt="Logo" className="max-h-8 object-contain mb-0.5" />
                    ) : null}
                    <div style={{ color: '#000000' }} className="text-[9px] font-black w-full uppercase tracking-tight">
                      {settings.companyName || 'Company Name'}
                    </div>
                  </div>

                  {/* Center Store */}
                  <div className="flex flex-col items-center justify-center w-1/3 text-center">
                    <span style={{ color: '#6b7280' }} className="text-[8px] italic">Delivery via:</span>
                    <span style={{ color: '#000000' }} className="text-[10px] font-black leading-tight uppercase tracking-tight">{row.StoreName || 'N/A'}</span>
                  </div>

                  {/* Right Barcode */}
                  <div className="flex flex-col items-end w-1/3">
                    <span style={{ color: '#6b7280' }} className="text-[7px] font-bold uppercase tracking-widest">{new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}</span>
                    <div className="mt-0.5 transform scale-75 origin-right translate-x-2">
                      <Barcode 
                        value={row.MerchantOrderId || row.id.substring(0, 8)} 
                        width={1} 
                        height={20} 
                        displayValue={true} 
                        fontSize={10} 
                        margin={0} 
                        background="transparent" 
                        lineColor="#000000"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 flex-1">
                  {/* Bill To */}
                  <div style={{ color: '#000000' }} className="flex flex-col text-[9px] leading-tight">
                    <span style={{ color: '#6b7280' }} className="font-bold uppercase tracking-widest text-[7px] mb-0.5">Bill To:</span>
                    <span className="font-black text-[11px]">{toProperCase(row.RecipientName)}</span>
                    <span className="font-bold">{formatPhone(row.RecipientPhone)}</span>
                    <span className="font-medium mt-0.5">{row.RecipientAddress || 'N/A'}</span>
                    <span className="font-bold">{row.RecipientCity || ''}, {row.RecipientZone || ''}</span>
                  </div>

                  {/* Item Table */}
                  <div style={{ borderColor: '#d1d5db' }} className="border mt-1">
                    <div style={{ backgroundColor: '#f3f4f6', color: '#000000', borderColor: '#d1d5db' }} className="font-bold text-[8px] border-b uppercase tracking-widest px-1.5 py-0.5">
                      Items
                    </div>
                    {(() => {
                      const itemsStr = row.ItemDesc || '';
                      if (!itemsStr) {
                         return (
                           <div style={{ color: '#000000' }} className="text-[8px] font-medium px-1.5 py-0.5">N/A</div>
                         );
                      }
                      const lines = itemsStr.split(',').filter(Boolean);
                      return lines.map((line, i) => (
                        <div key={i} style={{ color: '#000000', borderColor: '#f3f4f6' }} className="text-[9px] font-medium px-1.5 py-0.5 border-b last:border-b-0 break-words">
                          • {line.trim()}
                        </div>
                      ));
                    })()}
                  </div>

                  {/* Invoice Info */}
                  <div style={{ color: '#000000' }} className="flex flex-col text-[8px] gap-0.5 mt-auto">
                    <div className="flex gap-2">
                      <span style={{ color: '#6b7280' }} className="font-bold uppercase tracking-widest min-w-[50px]">Invoice:</span>
                      <span className="font-bold">{row.InvoiceNo || 'N/A'}</span>
                    </div>
                    <div className="flex gap-2">
                      <span style={{ color: '#6b7280' }} className="font-bold uppercase tracking-widest min-w-[50px]">Store:</span>
                      <span className="font-bold">{row.StoreName || 'N/A'}</span>
                    </div>
                    <div style={{ backgroundColor: '#000000', color: '#ffffff' }} className="flex items-center gap-2 p-1 mt-1 self-start rounded-sm">
                      <span className="font-bold uppercase tracking-widest min-w-[50px]">Due BDT:</span>
                      <span className="font-black text-[12px]">{(Number(row.AmountToCollect) || 0).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
                
              </div>
            ))}
          </div>
        ))}
      </div>
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 0; }
          .a4-page { page-break-after: always; }
        }
        .a4-page {
          width: 210mm;
          min-height: 297mm;
          background: white;
          margin-bottom: 5mm;
          box-shadow: 0 0 5px rgba(0,0,0,0.1);
        }
        .slip-card {
           border: 1px dashed #ccc !important;
           height: 88mm;
           display: flex;
           flex-direction: column;
        }
      `}</style>
    </div>
  );
}
