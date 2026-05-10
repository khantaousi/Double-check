import React, { useState, useRef } from 'react';
import { Plus, Trash2, Tag, Edit3, Check, Upload, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { ProductPrice } from '../types';
import * as XLSX from 'xlsx';

interface ProductLibraryProps {
  products: ProductPrice[];
  canWrite?: boolean;
  onAdd: (name: string, price: number, wholesalePrice?: number, wholesaleThreshold?: number) => void;
  onBulkAdd?: (productsToAdd: any[]) => void;
  onDelete: (id: string) => void;
  onDeleteMultiple?: (ids: string[]) => void;
  onUpdate: (id: string, name: string, price: number, wholesalePrice?: number, wholesaleThreshold?: number) => void;
}

export const ProductLibrary: React.FC<ProductLibraryProps> = ({ products, canWrite, onAdd, onBulkAdd, onDelete, onDeleteMultiple, onUpdate }) => {
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newWSPrice, setNewWSPrice] = useState('');
  const [newWSThreshold, setNewWSThreshold] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editWSPrice, setEditWSPrice] = useState('');
  const [editWSThreshold, setEditWSThreshold] = useState('');
  
  const [searchTerm, setSearchTerm] = useState('');

  const toggleSelect = (id: string) => {
    const next = new Set(selectedProducts);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedProducts(next);
  };

  const clearSelection = () => setSelectedProducts(new Set());

  const handleBulkDelete = () => {
    if (onDeleteMultiple && selectedProducts.size > 0) {
      onDeleteMultiple(Array.from(selectedProducts));
      clearSelection();
    }
  };

  const handleAdd = () => {
    if (!newName || !newPrice) return;
    onAdd(
      newName, 
      Number(newPrice), 
      newWSPrice ? Number(newWSPrice) : undefined, 
      newWSThreshold ? Number(newWSThreshold) : undefined
    );
    setNewName('');
    setNewPrice('');
    setNewWSPrice('');
    setNewWSThreshold('');
  };

  const startEdit = (p: ProductPrice) => {
    setEditingId(p.id);
    setEditName(p.name);
    setEditPrice(String(p.price));
    setEditWSPrice(p.wholesalePrice ? String(p.wholesalePrice) : '');
    setEditWSThreshold(p.wholesaleThreshold ? String(p.wholesaleThreshold) : '');
  };

  const saveEdit = () => {
    if (editingId) {
      onUpdate(
        editingId, 
        editName, 
        Number(editPrice),
        editWSPrice ? Number(editWSPrice) : undefined,
        editWSThreshold ? Number(editWSThreshold) : undefined
      );
      setEditingId(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !onBulkAdd) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        onBulkAdd(data);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setShowBulkUpload(false);
      } catch (err) {
        alert("Failed to parse file. Ensure it's a valid Excel or CSV.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const filteredProducts = products.filter(p => {
    const s = searchTerm.toLowerCase();
    return (
      p.name.toLowerCase().includes(s) ||
      (p.wholesalePrice !== undefined && String(p.wholesalePrice).includes(s)) ||
      (p.wholesaleThreshold !== undefined && String(p.wholesaleThreshold).includes(s))
    );
  });

  return (
    <div className="space-y-4">
{canWrite && (
        <div className="flex items-center justify-between mb-2">
            <h3 className="text-[10px] font-bold uppercase text-slate-400 tracking-widest flex items-center gap-2">
                <Tag size={12} />
                Product Price Library
            </h3>
            <div className="relative flex items-center gap-3">
                {selectedProducts.size > 0 && (
                    <button
                    onClick={handleBulkDelete}
                    className="px-3 py-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors shadow-sm"
                    >
                    Delete ({selectedProducts.size})
                    </button>
                )}
                <div className="relative group">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                    <Plus size={14} className="rotate-45" />
                  </span>
                  <input 
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search items, prices, or qty..."
                      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] py-2.5 pl-10 pr-4 rounded-xl focus:ring-2 focus:ring-blue-500/20 w-44 md:w-64 placeholder:text-slate-300 font-black shadow-sm transition-all focus:border-blue-500/50"
                  />
                </div>
                <button 
                    onClick={() => setShowBulkUpload(!showBulkUpload)}
                    className={`p-2.5 rounded-xl transition-all shadow-sm ${showBulkUpload ? 'bg-blue-600 text-white' : 'bg-white text-slate-500 hover:text-blue-600 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-blue-500/50'}`}
                    title="Bulk Upload"
                >
                    <Upload size={16} />
                </button>
            </div>
        </div>
      )}
      {!canWrite && (
        <div className="flex items-center justify-between mb-2">
            <h3 className="text-[10px] font-bold uppercase text-slate-400 tracking-widest flex items-center gap-2">
                <Tag size={12} />
                Product Price Library (Read Only)
            </h3>
            <div className="relative group">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors">
                <Plus size={14} className="rotate-45" />
              </span>
              <input 
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search items, prices, or qty..."
                  className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-[11px] py-2.5 pl-10 pr-4 rounded-xl focus:ring-2 focus:ring-blue-500/20 w-44 md:w-64 placeholder:text-slate-300 font-black shadow-sm transition-all focus:border-blue-500/50"
              />
            </div>
        </div>
      )}

      {showBulkUpload && (
        <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 p-4 rounded-2xl mb-4 text-left">
          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-2 flex items-center gap-2">
            <FileText size={16} className="text-blue-500" />
            Bulk Upload via CSV/XLSX
          </p>
          <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mb-4 space-y-1">
            <p>Your file must include the following column headers (exact spelling):</p>
            <div className="flex flex-wrap gap-2 mt-2">
              <span className="bg-white dark:bg-slate-800 px-2 py-1 rounded font-mono border border-slate-200 dark:border-slate-700">name</span>
              <span className="bg-white dark:bg-slate-800 px-2 py-1 rounded font-mono border border-slate-200 dark:border-slate-700">price</span>
              <span className="bg-slate-100 dark:bg-slate-800/50 px-2 py-1 rounded font-mono border border-slate-200 dark:border-slate-700 opacity-80 decoration-dotted">wholesalePrice (optional)</span>
              <span className="bg-slate-100 dark:bg-slate-800/50 px-2 py-1 rounded font-mono border border-slate-200 dark:border-slate-700 opacity-80 decoration-dotted">wholesaleThreshold (optional)</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input 
              type="file"
              ref={fileInputRef}
              accept=".csv, .xlsx, .xls"
              className="hidden"
              onChange={handleFileUpload}
            />
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-colors shadow-lg shadow-blue-500/20 active:scale-95"
            >
              Select File
            </button>
            <a 
              href="/product_template.csv" 
              download
              className="bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-colors"
            >
              Download Template
            </a>
          </div>
        </div>
      )}

      <div className="space-y-4">
      {canWrite && (
        <div className="space-y-4">
        <div className="flex flex-col gap-3 p-4 bg-slate-50/50 dark:bg-slate-800/30 rounded-2xl border border-slate-200/50 dark:border-slate-800 shadow-sm">
          <div className="flex gap-2">
            <div className="flex-1 relative group">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="New Product Name"
                className="w-full bg-white dark:bg-slate-900 text-[11px] font-black text-slate-700 dark:text-slate-200 py-2.5 px-3 rounded-xl border border-slate-100 dark:border-slate-800 shadow-inner focus:ring-2 focus:ring-blue-500/10 placeholder:text-slate-300 transition-all outline-none"
              />
              <div className="absolute left-3 -top-2 bg-slate-50 dark:bg-[#1a1a2e] px-1 text-[7px] font-black uppercase text-slate-400 tracking-widest opacity-0 group-focus-within:opacity-100 transition-opacity">Product Label</div>
            </div>
            <div className="w-24 relative group">
              <input
                type="number"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="Retail"
                className="w-full bg-white dark:bg-slate-900 text-[11px] font-black text-emerald-600 dark:text-emerald-400 py-2.5 px-3 rounded-xl border border-slate-100 dark:border-slate-800 shadow-inner focus:ring-2 focus:ring-emerald-500/10 placeholder:text-slate-300 text-right transition-all outline-none"
              />
              <div className="absolute right-3 -top-2 bg-slate-50 dark:bg-[#1a1a2e] px-1 text-[7px] font-black uppercase text-emerald-400 tracking-widest opacity-0 group-focus-within:opacity-100 transition-opacity">Retail Price</div>
            </div>
            <button 
              onClick={handleAdd}
              className="px-4 bg-blue-600 text-white hover:bg-blue-700 rounded-xl transition-all shadow-lg shadow-blue-500/20 active:scale-95 flex items-center justify-center border border-blue-500/20"
            >
              <Plus size={18} />
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="flex items-center gap-3 bg-white dark:bg-slate-900 pt-1 pb-1 px-3 rounded-xl border border-slate-100 dark:border-slate-800 shadow-inner">
               <div className="flex flex-col">
                  <span className="text-[7px] font-black text-slate-400 uppercase tracking-tighter leading-none">Wholesale</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-indigo-500 opacity-50">৳</span>
                    <input
                      type="number"
                      value={newWSPrice}
                      onChange={(e) => setNewWSPrice(e.target.value)}
                      placeholder="0"
                      className="w-full bg-transparent text-[11px] font-black text-indigo-600 dark:text-indigo-400 focus:outline-none placeholder:text-slate-200"
                    />
                  </div>
               </div>
            </div>
            <div className="flex items-center gap-3 bg-white dark:bg-slate-900 pt-1 pb-1 px-3 rounded-xl border border-slate-100 dark:border-slate-800 shadow-inner">
               <div className="flex flex-col">
                  <span className="text-[7px] font-black text-slate-400 uppercase tracking-tighter leading-none">Min Qty</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] text-indigo-500 opacity-50">#</span>
                    <input
                      type="number"
                      value={newWSThreshold}
                      onChange={(e) => setNewWSThreshold(e.target.value)}
                      placeholder="1"
                      className="w-full bg-transparent text-[11px] font-black text-indigo-600 dark:text-indigo-400 focus:outline-none placeholder:text-slate-200"
                    />
                  </div>
               </div>
            </div>
          </div>
        </div>
        </div>
      )}

        <div className="max-h-80 overflow-y-auto space-y-2.5 pr-2 custom-scrollbar">
          {filteredProducts.map((p) => (
            <div key={p.id} className={`flex flex-col p-4 bg-white dark:bg-slate-900 rounded-2xl border ${selectedProducts.has(p.id) ? 'border-red-300 dark:border-red-800' : 'border-slate-100 dark:border-slate-800'} shadow-sm hover:shadow-md hover:border-slate-200 dark:hover:border-slate-700 group transition-all duration-300 relative overflow-hidden`}>
              <div className={`absolute top-0 left-0 w-1 h-full ${selectedProducts.has(p.id) ? 'bg-red-500' : 'bg-slate-200 dark:bg-slate-800'} group-hover:bg-blue-500 transition-colors`} />
              {editingId === p.id ? (
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 bg-blue-50 dark:bg-blue-900/20 text-[11px] font-black text-slate-700 dark:text-slate-200 focus:outline-none px-3 py-2 rounded-xl border border-blue-100 dark:border-blue-900/50"
                    />
                    <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-900/20 px-3 rounded-xl border border-emerald-100 dark:border-emerald-900/50">
                       <span className="text-[8px] font-black text-emerald-500 uppercase">Retail</span>
                       <input
                        type="number"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        className="w-14 bg-transparent text-[11px] font-black text-emerald-700 dark:text-emerald-400 focus:outline-none text-right"
                      />
                    </div>
                    <button onClick={saveEdit} className="p-2 bg-green-500 text-white rounded-xl shadow-lg shadow-green-500/20 active:scale-90"><Check size={18}/></button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pl-1">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                      <span className="text-[7px] font-black text-indigo-400 uppercase tracking-tighter">Wholesale</span>
                      <input
                        type="number"
                        value={editWSPrice}
                        onChange={(e) => setEditWSPrice(e.target.value)}
                        placeholder="0"
                        className="w-full bg-transparent text-[10px] font-black text-indigo-600 dark:text-indigo-400 focus:outline-none"
                      />
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl border border-indigo-100 dark:border-indigo-900/50">
                      <span className="text-[7px] font-black text-indigo-400 uppercase tracking-tighter">Min Qty</span>
                      <input
                        type="number"
                        value={editWSThreshold}
                        onChange={(e) => setEditWSThreshold(e.target.value)}
                        placeholder="0"
                        className="w-full bg-transparent text-[10px] font-black text-indigo-600 dark:text-indigo-400 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedProducts.has(p.id)}
                        onChange={() => toggleSelect(p.id)}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex flex-col">
                         <span className="text-[12px] text-slate-800 dark:text-slate-100 font-black whitespace-normal break-words pr-2 leading-tight uppercase tracking-tight">{p.name}</span>
                         <span className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mt-0.5">Product SKU: #{p.id.slice(0, 6)}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="text-[14px] font-mono font-black text-slate-900 dark:text-slate-100 leading-none">৳{p.price}</div>
                        <div className="text-[7px] font-black text-emerald-500 uppercase tracking-widest leading-none mt-1">Retail Unit</div>
                      </div>
                      {canWrite && <div className="flex items-center opacity-0 group-hover:opacity-100 transition-all gap-1">
                        <button 
                          onClick={() => startEdit(p)}
                          className="text-slate-400 dark:text-slate-600 hover:text-blue-600 dark:hover:text-blue-400 p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                        >
                          <Edit3 size={15} />
                        </button>
                        <button 
                          onClick={() => onDelete(p.id)}
                          className="text-slate-400 dark:text-slate-600 hover:text-red-500 p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>}
                    </div>
                  </div>
                  {p.wholesalePrice && p.wholesaleThreshold && (
                    <div className="flex items-center gap-3 mt-1 py-1.5 px-3 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl w-fit border border-indigo-100/50 dark:border-indigo-900/30">
                      <div className="flex items-center gap-2">
                        <Tag size={11} className="text-indigo-500" />
                        <span className="text-[11px] font-mono font-black text-indigo-600 dark:text-indigo-400">৳{p.wholesalePrice}</span>
                      </div>
                      <div className="w-[1px] h-3 bg-indigo-200 dark:bg-indigo-800" />
                      <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest">At {p.wholesaleThreshold}+ Units</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
          {products.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 opacity-40">
               <Tag size={32} className="mb-2" />
               <p className="text-[10px] text-slate-400 italic text-center">No products defined in library</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
