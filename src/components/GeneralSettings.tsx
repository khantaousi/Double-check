import React, { useState, useEffect, useRef } from 'react';
import { SiteSettings } from '../types';
import { Globe, ShieldCheck, DollarSign, Upload, RotateCcw, Image as ImageIcon, Database, Palette } from 'lucide-react';

interface GeneralSettingsProps {
  settings: SiteSettings;
  onUpdate: (settings: SiteSettings) => void;
  canWrite?: boolean;
}

export function GeneralSettings({ settings, onUpdate, canWrite = true }: GeneralSettingsProps) {
  const [keywordInput, setKeywordInput] = useState(settings.permissionKeywords?.join(', ') || '');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update local state when settings change from outside (e.g. Firebase load)
  // but only if it's actually different to avoid interrupting typing
  useEffect(() => {
    const currentJoined = settings.permissionKeywords?.join(', ') || '';
    const inputParsedJoined = keywordInput.split(',').map(s => s.trim()).filter(Boolean).join(', ');
    
    if (currentJoined !== inputParsedJoined) {
      setKeywordInput(currentJoined);
    }
  }, [settings.permissionKeywords]);

  const handleKeywordChange = (value: string) => {
    setKeywordInput(value);
    const keywords = value.split(',')
      .map(s => s.trim())
      .filter(Boolean);
    
    // Only trigger parent update if the actual list of keywords changed
    const currentJoined = settings.permissionKeywords?.join(',') || '';
    const newJoined = keywords.join(',');
    
    if (currentJoined !== newJoined) {
      onUpdate({ ...settings, permissionKeywords: keywords });
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 500000) { // 500KB limit
      alert("Logo image is too large. Please use a file under 500KB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      onUpdate({ ...settings, logoUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const resetLogo = () => {
    onUpdate({ ...settings, logoUrl: '' });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 p-6 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300">
        <div className="flex items-center gap-4">
          <div className="relative group">
            <div className="w-20 h-20 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden border-2 border-dashed border-slate-200 dark:border-slate-700 group-hover:border-blue-400 transition-all duration-300">
              {settings.logoUrl ? (
                <img src={settings.logoUrl} alt="Logo" className="w-full h-full object-contain" />
              ) : (
                <Database className="text-slate-300 dark:text-slate-600" size={32} />
              )}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <Upload size={20} className="text-white" />
              </div>
            </div>
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={handleLogoUpload}
            />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Platform Branding</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Upload your business logo</p>
            <div className="flex gap-2 mt-3">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white rounded-xl text-[10px] font-bold uppercase transition-all hover:bg-blue-700 shadow-lg shadow-blue-500/20 active:scale-95"
              >
                <ImageIcon size={12} />
                Change Logo
              </button>
              {settings.logoUrl && (
                <button 
                  onClick={resetLogo}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-[10px] font-bold uppercase transition-all hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 active:scale-95"
                >
                  <RotateCcw size={12} />
                  Default
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-2 px-2">
        <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
          <Globe size={16} />
        </div>
        <div>
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">System Properties</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Global names and thresholds</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Company / Platform Name</label>
          <div className="relative">
            <Globe className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
            <input 
              value={settings.companyName}
              onChange={e => onUpdate({ ...settings, companyName: e.target.value })}
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all"
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Validation Tolerance (৳)</label>
          <div className="relative">
            <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
            <input 
              type="number"
              value={settings.amountTolerance}
              onChange={e => onUpdate({ ...settings, amountTolerance: Number(e.target.value) })}
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all"
            />
          </div>
          <p className="text-[9px] text-slate-400 mt-1 ml-1 leading-relaxed">
            If the difference between "Expected" and "Collected" is less than this amount, it will be marked as a <span className="text-green-500 font-bold">MATCH</span>.
          </p>
        </div>

        <div className="space-y-2 md:col-span-2">
          <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Leader Permission Keywords (Comma separated)</label>
          <div className="relative">
            <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
            <input 
              value={keywordInput}
              onChange={e => handleKeywordChange(e.target.value)}
              placeholder="boss ok, permit, authorized..."
              className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl py-4 pl-12 pr-6 text-sm font-bold focus:ring-2 focus:ring-indigo-500/10 focus:outline-none transition-all"
            />
          </div>
          <p className="text-[9px] text-slate-400 mt-1 ml-1 leading-relaxed">
            If any of these keywords are found in <span className="font-bold">Special Instruction</span>, the row will be automatically marked as a <span className="text-purple-500 font-bold">MATCH</span>.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-2 px-2 pt-4 border-t border-slate-100 dark:border-slate-800">
        <div className="w-8 h-8 rounded-xl bg-pink-50 dark:bg-pink-900/20 flex items-center justify-center text-pink-600 dark:text-pink-400">
          <Palette size={16} />
        </div>
        <div>
          <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">System Theme UI</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select the global UI style for the full site</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
        {[
          { id: 'classic-blue', name: 'Classic Blue', dot: '#2563eb' },
          { id: 'royal-indigo', name: 'Royal Indigo', dot: '#4f46e5' },
          { id: 'forest-emerald', name: 'Forest Emerald', dot: '#059669' },
          { id: 'crimson-rose', name: 'Crimson Rose', dot: '#e11d48' },
          { id: 'sunset-amber', name: 'Sunset Amber', dot: '#f59e0b' },
          { id: 'amethyst-purple', name: 'Amethyst Purple', dot: '#9333ea' },
        ].map((themeOpt) => {
          const isSelected = (settings.theme || 'classic-blue') === themeOpt.id;
          return (
            <button
              key={themeOpt.id}
              disabled={!canWrite}
              onClick={() => onUpdate({ ...settings, theme: themeOpt.id })}
              className={`flex flex-col items-center gap-3 p-4 rounded-2xl border transition-all ${
                isSelected 
                  ? 'border-blue-600 bg-blue-50/20 dark:bg-blue-900/10 ring-2 ring-blue-500/20 shadow-sm' 
                  : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div 
                className="w-8 h-8 rounded-full flex items-center justify-center shadow-inner"
                style={{ backgroundColor: themeOpt.dot }}
              >
                {isSelected && (
                  <div className="w-3.5 h-3.5 rounded-full bg-white dark:bg-slate-900 shadow-md" />
                )}
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 text-center">
                {themeOpt.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
