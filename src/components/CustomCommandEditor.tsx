import React, { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { SiteSettings } from '../types';

export function CustomCommandEditor({ settings, onUpdate }: { settings: SiteSettings, onUpdate: (s: SiteSettings) => void }) {
  const [val, setVal] = useState(settings.customAmountRule || '');

  useEffect(() => {
    setVal(settings.customAmountRule || '');
  }, [settings.customAmountRule]);

  const handleSave = () => {
    onUpdate({ ...settings, customAmountRule: val, combineBaseRulesWithAI: settings.combineBaseRulesWithAI });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="combineBaseRulesWithAI"
          checked={!!settings.combineBaseRulesWithAI}
          onChange={(e) => onUpdate({ ...settings, combineBaseRulesWithAI: e.target.checked })}
          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
        />
        <label htmlFor="combineBaseRulesWithAI" className="text-xs font-bold text-slate-700 dark:text-slate-200">
          Combine Base Rules with AI Command
        </label>
      </div>
      <textarea
        value={val}
        onChange={(e) => setVal(e.target.value)}
        placeholder="e.g. If area is 'Uttara', charge 50 for delivery. If there's a gift item, make it 0. Otherwise check exactly..."
        className="w-full h-32 p-4 text-sm font-medium bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-400"
      />
      <button 
        onClick={handleSave}
        className="w-full py-3 bg-slate-900 dark:bg-blue-600 text-white text-xs font-bold rounded-lg shadow-lg shadow-slate-200 dark:shadow-none hover:bg-slate-800 dark:hover:bg-blue-700 transition-all flex items-center justify-center gap-2 uppercase tracking-wide active:scale-[0.98]"
      >
        <Save size={14} />
        Save Command
      </button>
      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest text-center mt-2">
        {settings.customAmountRule ? 'AI evaluation is Active for data processing.' : 'Using standard logical rules.'}
      </p>
    </div>
  );
}
