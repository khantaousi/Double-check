import React from 'react';
import { AlertTriangle, Download, BarChart3, ShieldCheck, Tag, User, Phone, ClipboardList } from 'lucide-react';
import { DataRow } from '../types';
import { generateStyledExcel } from '../lib/excel';

interface DataTableProps {
  data: DataRow[];
  onUpdatePrice: (id: string, price: number) => void;
}

export const DataTable: React.FC<DataTableProps> = ({ data, onUpdatePrice }) => {
  if (data.length === 0) return null;

  const mismatchCount = data.filter(r => r.isMismatch || r.isDuplicate || r.isInvalid).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <BarChart3 size={14} className="text-blue-500" />
            Validation Results
          </h3>
          <p className="text-[11px] text-slate-500 font-medium mt-1">
            {data.length} records • {mismatchCount} actions required • <span className="text-blue-600">Click prices to edit</span>
          </p>
        </div>
        
        <button 
          onClick={() => generateStyledExcel(data)}
          className="flex items-center gap-2 bg-blue-600 text-white px-5 py-2.5 rounded-lg text-xs font-bold shadow-lg shadow-blue-500/20 dark:shadow-blue-900/40 hover:bg-blue-700 transition-all active:scale-[0.98]"
        >
          <Download size={14} />
          Export Report
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm shadow-slate-100 dark:shadow-none transition-colors duration-300">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1000px]">
            <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
            <tr className="text-slate-400 dark:text-slate-500 text-[10px] font-black uppercase tracking-[0.15em]">
                <th className="p-4 pl-6">
                  <div className="flex items-center gap-2">
                    <User size={12} className="opacity-50" />
                    Customer
                  </div>
                </th>
                <th className="p-4">
                  <div className="flex items-center gap-2">
                    <ClipboardList size={12} className="opacity-50" />
                    Item Details
                  </div>
                </th>
                <th className="p-4 text-center">Base Price</th>
                <th className="p-4 text-center">Collected</th>
                <th className="p-4 text-center">Expected</th>
                <th className="p-4 text-right pr-8">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 italic font-mono text-[11px]">
              {data.map((row) => (
                <tr 
                  key={row.id} 
                  className={`
                    transition-colors group
                    ${(row.isMismatch || row.isDuplicate || row.isInvalid) 
                      ? 'bg-red-50/70 dark:bg-red-900/20 hover:bg-red-100/70 dark:hover:bg-red-900/30' 
                      : row.isPermitted 
                        ? 'bg-purple-50/50 dark:bg-purple-900/15 hover:bg-purple-100/50 dark:hover:bg-purple-900/25 border-l-2 border-l-purple-500'
                        : 'bg-emerald-50/30 dark:bg-emerald-900/10 hover:bg-emerald-50/60 dark:hover:bg-emerald-900/20'
                    }
                  `}
                >
                  <td className="p-4 pl-6">
                    <div className="flex flex-col min-w-[140px]">
                      <span className={`text-[12px] font-black font-sans not-italic ${(row.isMismatch || row.isInvalid) ? 'text-red-900 dark:text-red-400' : 'text-slate-800 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors'}`}>
                        {row.RecipientName}
                      </span>
                      <div className="flex items-center gap-1.5 mt-0.5 opacity-60">
                         <Phone size={10} className="text-slate-400" />
                         <span className="text-slate-500 dark:text-slate-500 font-mono text-[10px]">{row.RecipientPhone}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col max-w-[280px] gap-1">
                      <div className="flex items-center gap-2">
                         <span className="text-slate-400 dark:text-slate-600 font-mono text-[9px] font-bold tracking-tighter uppercase">ID: {row.MerchantOrderId}</span>
                         {row.isDuplicate && (
                             <span className="bg-blue-500/10 text-blue-500 text-[7px] font-black px-1 rounded uppercase tracking-widest border border-blue-500/20">Duplicate</span>
                         )}
                      </div>
                      <span className="text-slate-600 dark:text-slate-300 font-sans italic text-[11px] whitespace-normal break-words leading-tight line-clamp-2" title={row.ItemDesc}>{row.ItemDesc}</span>
                      {row.SpecialInstruction && (
                        <div className={`mt-1.5 text-[9px] whitespace-normal break-words leading-tight px-2 py-1.5 rounded-lg border transition-all duration-300 ${row.isPermitted ? 'bg-purple-500/5 dark:bg-purple-500/10 border-purple-500/20 text-purple-700 dark:text-purple-300 shadow-sm shadow-purple-500/5' : 'bg-slate-50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800 text-slate-500'}`}>
                          <div className="flex items-start gap-2">
                            <span className="font-black uppercase text-[7px] opacity-40 mt-0.5 tracking-wider shrink-0">INSTX:</span>
                            <span>{row.SpecialInstruction}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-1 group/input bg-slate-50/50 dark:bg-slate-800/30 py-1.5 px-2 rounded-lg border border-transparent hover:border-blue-500/30 transition-all">
                      <span className="text-slate-300 dark:text-slate-600 font-mono text-[9px] mt-0.5">৳</span>
                      <input 
                        type="number"
                        value={row.extractedBasePrice}
                        onChange={(e) => onUpdatePrice(row.id, Number(e.target.value))}
                        className={`w-14 bg-transparent border-none focus:outline-none text-center font-black text-xs font-mono not-italic ${row.extractedBasePrice === 0 ? 'text-red-500' : 'text-blue-600 dark:text-blue-400'}`}
                      />
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex flex-col">
                        <span className={`font-black text-[12px] font-mono not-italic ${(row.isMismatch || row.isInvalid) ? 'text-red-500' : 'text-slate-700 dark:text-slate-300'}`}>
                          ৳{row.AmountToCollect.toLocaleString()}
                        </span>
                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none mt-0.5 opacity-50">Collected</span>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex flex-col">
                        <div className="flex items-center justify-center gap-1">
                           <span className="text-blue-600 dark:text-blue-400 font-black text-[12px] font-mono not-italic">
                             ৳{row.calculatedTotal?.toLocaleString()}
                           </span>
                           {row.isWholesale && <Tag size={8} className="text-indigo-500 shrink-0" />}
                        </div>
                        <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest leading-none mt-0.5 opacity-50">Calculated</span>
                    </div>
                  </td>
                  <td className="p-4 text-right pr-8">
                    <div className="flex flex-col items-end gap-1.5">
                      {row.isInvalid ? (
                        <div className="flex flex-col items-end">
                            <span className="inline-flex items-center gap-1.5 bg-orange-600 text-white px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider shadow-[0_4px_12px_rgba(234,88,12,0.25)]">
                              <AlertTriangle size={10} /> Invalid
                            </span>
                        </div>
                      ) : row.isMismatch ? (
                        <div className="flex flex-col items-end">
                            <span className="inline-flex items-center gap-1.5 bg-red-600 text-white px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider shadow-[0_4px_12px_rgba(220,38,38,0.25)]">
                              <AlertTriangle size={10} /> Mismatch
                            </span>
                        </div>
                      ) : row.isPermitted ? (
                        <span className="inline-flex items-center gap-1.5 bg-purple-600 text-white px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider shadow-[0_4px_12px_rgba(147,51,234,0.25)]">
                          <ShieldCheck size={11} /> Leader Permit
                        </span>
                      ) : row.isDuplicate ? (
                        <span className="inline-flex items-center gap-1.5 bg-blue-600 text-white px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-wider shadow-[0_4px_12px_rgba(37,99,235,0.25)]">
                          Duplicate ID
                        </span>
                      ) : (
                        <div className="flex flex-col items-end">
                          <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-black text-[10px] uppercase tracking-widest scale-up-center">
                            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" /> Match
                          </span>
                          {row.isWholesale && (
                            <span className="text-[7px] font-black uppercase tracking-[0.15em] text-indigo-500 dark:text-indigo-400 leading-none mt-0.5 bg-indigo-500/5 px-1 rounded">Wholesale</span>
                          )}
                        </div>
                      )}
                      
                      {row.notes && row.notes.length > 0 && (
                        <div className="flex flex-col items-end gap-0.5 mt-1">
                          {row.notes.map((note, nIdx) => (
                            <span key={nIdx} className="text-[8px] text-slate-400 dark:text-slate-500 font-mono font-bold uppercase tracking-tighter opacity-60 leading-none bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded border border-slate-200 dark:border-slate-700">{note}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
