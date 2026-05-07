import React from 'react';
import { Package, Download, Search, Database, Store, Layers } from 'lucide-react';
import { DataRow } from '../types';
import { motion, AnimatePresence } from 'motion/react';

interface ProductStats {
  name: string;
  count: number;
}

export interface StoreStats {
  storeName: string;
  totalStoreItems: number;
  parcels: number;
  items: ProductStats[];
}

interface ProductTrackerProps {
  data: DataRow[];
}

export function ProductTracker({ data }: ProductTrackerProps) {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [viewMode, setViewMode] = React.useState<'overall' | 'store'>('store');
  const [selectedStore, setSelectedStore] = React.useState<string | null>(null);

  const { overallStats, storeStats, totalItems } = React.useMemo(() => {
    const overall: Record<string, number> = {};
    const storeMap: Record<string, Record<string, number>> = {};
    const storeParcelCount: Record<string, number> = {};
    let total = 0;
    
    data.forEach(item => {
      const rawName = item.ItemDesc || item.ItemType || 'Unknown Product';
      const store = item.StoreName || 'Unknown Store';
      const rowQty = Number(item.ItemQuantity) || 1;
      
      storeParcelCount[store] = (storeParcelCount[store] || 0) + 1;
      
      const subItems = rawName.split(',').map(s => s.trim()).filter(Boolean);
      
      if (subItems.length === 0) {
        subItems.push('Unknown Product');
      }

      subItems.forEach(subItem => {
        let name = subItem;
        let subQty = 1;

        // Try to match leading number for quantity, e.g., "2 Nose Strips" -> qty: 2, name: "Nose Strips"
        const match = subItem.match(/^(\d+)\s+(.+)$/);
        if (match) {
          subQty = parseInt(match[1], 10);
          name = match[2];
        }

        const finalQty = subQty * rowQty;

        overall[name] = (overall[name] || 0) + finalQty;
        
        if (!storeMap[store]) storeMap[store] = {};
        storeMap[store][name] = (storeMap[store][name] || 0) + finalQty;
        
        total += finalQty;
      });
    });
    
    const sortedOverall = Object.entries(overall)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const storeList = Object.entries(storeMap).map(([storeName, items]) => {
      const sortedItems = Object.entries(items)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);
      const totalStoreItems = sortedItems.reduce((acc, curr) => acc + curr.count, 0);
      const parcels = storeParcelCount[storeName] || 0;
      return { storeName, totalStoreItems, parcels, items: sortedItems };
    }).sort((a, b) => b.totalStoreItems - a.totalStoreItems);

    return { 
      overallStats: sortedOverall,
      storeStats: storeList,
      totalItems: total
    };
  }, [data]);

  const filteredOverallStats = overallStats.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredStoreStats = storeStats.filter(store => 
    (!selectedStore || store.storeName === selectedStore) &&
    (store.storeName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    store.items.some(item => item.name.toLowerCase().includes(searchTerm.toLowerCase())))
  ).map(store => ({
    ...store,
    items: store.items.filter(item => 
      searchTerm === '' || 
      item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      store.storeName.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }));

  const downloadCSV = () => {
    if (overallStats.length === 0) return;
    
    let csvContent = "";
    if (viewMode === 'overall') {
      const headers = ['Product Name', 'Total Count'];
      const rows = overallStats.map(stat => [
        `"${stat.name.replace(/"/g, '""')}"`,
        stat.count
      ]);
      csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    } else {
      const headers = ['Store Name', 'Product Name', 'Count'];
      const rows: string[] = [];
      storeStats.forEach(store => {
        store.items.forEach(item => {
          rows.push(`"${store.storeName.replace(/"/g, '""')}","${item.name.replace(/"/g, '""')}",${item.count}`);
        });
      });
      csvContent = [headers.join(','), ...rows].join('\n');
    }
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `product_tracking_${viewMode}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <Package size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Product Inventory Tracker</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight mt-0.5">Real-time product counting and analytics</p>
          </div>
        </div>
        
        <div className="flex flex-col sm:flex-row flex-wrap items-center gap-3 w-full">
          <div className="relative flex-1 min-w-[280px] w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="Find Product or Store..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-xl py-2.5 pl-10 pr-4 text-[11px] font-black uppercase tracking-widest focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-400"
            />
          </div>
          <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              onClick={() => setViewMode('overall')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'overall' ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              <Layers size={14} /> Overall
            </button>
            <button
              onClick={() => setViewMode('store')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'store' ? 'bg-white dark:bg-slate-700 text-purple-600 dark:text-purple-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
            >
              <Store size={14} /> By Store
            </button>
          </div>

          <button 
            onClick={downloadCSV}
            disabled={overallStats.length === 0}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 disabled:grayscale shadow-lg shadow-blue-500/20"
          >
            <Download size={14} />
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-all duration-500">
              <Database size={120} className="text-blue-600" />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Items</p>
            <div className="text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tighter">
              {data.length === 0 ? '00' : totalItems}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[10px] font-bold text-slate-400 uppercase">Gross Volume</span>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden group">
            <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-all duration-500 text-purple-600">
              <Package size={120} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">SKU Count (ItemDesc)</p>
            <div className="text-4xl font-black text-slate-900 dark:text-slate-100 tracking-tighter">
              {data.length === 0 ? '00' : overallStats.length}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-purple-500" />
              <span className="text-[10px] font-bold text-slate-400 uppercase">Product Variety</span>
            </div>
          </div>
        </div>

        <div className="md:col-span-3">
          <div className="bg-white dark:bg-slate-900 rounded-[2rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="max-h-[500px] overflow-y-auto scrollbar-hide">
              {viewMode === 'overall' ? (
                <table className="w-full text-left border-collapse">
                  <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10">
                    <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <th className="px-8 py-4">Item Description</th>
                      <th className="px-8 py-4 text-right w-32">Total Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-bold">
                    <AnimatePresence>
                    {filteredOverallStats.length > 0 ? (
                      filteredOverallStats.map((stat, idx) => (
                        <motion.tr 
                          initial={{ opacity: 0, x: -10 }} 
                          animate={{ opacity: 1, x: 0 }} 
                          exit={{ opacity: 0 }}
                          transition={{ delay: Math.min(idx * 0.02, 0.2) }}
                          key={stat.name} 
                          className="group hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all duration-200"
                        >
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-500 transition-colors">
                                <Package size={14} />
                              </div>
                              <span className="text-sm text-slate-800 dark:text-slate-100 group-hover:translate-x-1 transition-transform">{stat.name}</span>
                            </div>
                          </td>
                          <td className="px-8 py-5 text-right">
                            <div className="inline-flex items-center justify-center min-w-[3rem] px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-xs font-black">
                              {stat.count}
                            </div>
                          </td>
                        </motion.tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={2} className="px-8 py-20 text-center">
                          <div className="flex flex-col items-center opacity-30">
                            <Search size={48} className="mb-4 text-slate-300" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No product data found</p>
                          </div>
                        </td>
                      </tr>
                    )}
                    </AnimatePresence>
                  </tbody>
                </table>
              ) : (
                <div className="flex flex-col">
                  {storeStats.length > 0 && (
                    <div className="flex flex-wrap gap-2 p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20">
                      <button
                        onClick={() => setSelectedStore(null)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${selectedStore === null ? 'bg-purple-500 text-white shadow-md shadow-purple-500/20' : 'bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700'}`}
                      >
                        All Stores
                      </button>
                      {storeStats.map(store => (
                        <button
                          key={store.storeName}
                          onClick={() => setSelectedStore(store.storeName)}
                          className={`px-3 py-1.5 rounded-lg text-[10px] items-center gap-2 flex font-black uppercase tracking-widest transition-all ${selectedStore === store.storeName ? 'bg-purple-500 text-white shadow-md shadow-purple-500/20' : 'bg-white dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-700'}`}
                        >
                          <span>{store.storeName}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[9px] ${selectedStore === store.storeName ? 'bg-white/20 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-400'}`}>
                            {store.parcels}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredStoreStats.length > 0 ? (
                    filteredStoreStats.map((store, sIdx) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(sIdx * 0.05, 0.3) }}
                        key={store.storeName} 
                        className="pb-4"
                      >
                        <div className="sticky top-0 bg-slate-50/90 dark:bg-slate-800/90 backdrop-blur-sm px-8 py-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 z-10">
                          <div className="flex items-center gap-2">
                            <Store size={14} className="text-purple-500" />
                            <h4 className="text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest">{store.storeName}</h4>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded-md">
                              {store.parcels} Parcels
                            </span>
                            <span className="text-[10px] font-black bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400 px-2 py-0.5 rounded-md">
                              {store.totalStoreItems} Items
                            </span>
                          </div>
                        </div>
                        <table className="w-full text-left border-collapse">
                          <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50 font-bold">
                            {store.items.map((item, idx) => (
                              <tr key={item.name} className="group hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-all duration-200">
                                <td className="px-8 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/30 group-hover:text-blue-500 transition-colors">
                                      <Package size={12} />
                                    </div>
                                    <span className="text-xs text-slate-600 dark:text-slate-300 group-hover:translate-x-1 transition-transform">{item.name}</span>
                                  </div>
                                </td>
                                <td className="px-8 py-3 text-right w-32">
                                  <span className="text-xs text-slate-500 dark:text-slate-400 font-black">{item.count}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </motion.div>
                    ))
                  ) : (
                    <div className="px-8 py-20 text-center flex flex-col items-center opacity-30">
                      <Search size={48} className="mb-4 text-slate-300" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No store data found</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
