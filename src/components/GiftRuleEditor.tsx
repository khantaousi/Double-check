import React from 'react';
import { GiftRule } from '../types';
import { Gift, Plus, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface GiftRuleEditorProps {
  rules: GiftRule[];
  onUpdate: (rules: GiftRule[]) => void;
  canWrite?: boolean;
}

interface KeywordInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder: string;
  className?: string;
  disabled?: boolean;
}

function KeywordInput({ value, onChange, placeholder, className, disabled }: KeywordInputProps) {
  const [localValue, setLocalValue] = React.useState(value.join(', '));

  // Update local value if props change from outside (e.g. from sync)
  React.useEffect(() => {
    const joined = value.join(', ');
    if (joined !== localValue.split(',').map(s => s.trim()).filter(Boolean).join(', ')) {
      setLocalValue(joined);
    }
  }, [value]);

  return (
    <input 
      value={localValue}
      disabled={disabled}
      onChange={e => {
        const newVal = e.target.value;
        setLocalValue(newVal);
        const tags = newVal.split(',').map(s => s.trim()).filter(Boolean);
        onChange(tags);
      }}
      placeholder={placeholder}
      className={className}
    />
  );
}

export function GiftRuleEditor({ rules, onUpdate, canWrite = true }: GiftRuleEditorProps) {
  const addRule = () => {
    if (!canWrite) return;
    const newRule: GiftRule = {
      id: crypto.randomUUID(),
      name: 'New Gift Rule',
      triggerKeywords: [],
      targetKeywords: [],
      isActive: true
    };
    onUpdate([...rules, newRule]);
  };

  const removeRule = (id: string) => {
    if (!canWrite) return;
    onUpdate(rules.filter(r => r.id !== id));
  };

  const updateRule = (id: string, updates: Partial<GiftRule>) => {
    if (!canWrite) return;
    onUpdate(rules.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-900/20 flex items-center justify-center text-rose-600 dark:text-rose-400">
            <Gift size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Gift Policies</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Define when items become free</p>
          </div>
        </div>
        <button 
          onClick={addRule}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-blue-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-blue-700 transition-all shadow-lg active:scale-95"
        >
          <Plus size={14} /> Add Policy
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <AnimatePresence mode="popLayout">
          {rules.map((rule) => (
            <motion.div 
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              key={rule.id}
              className={`p-6 rounded-[2rem] border transition-all ${rule.isActive ? 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800' : 'bg-slate-50 dark:bg-slate-900/50 border-slate-100 dark:border-slate-800/50 grayscale opacity-60'}`}
            >
              <div className="flex items-center justify-between mb-6">
                <input 
                  value={rule.name}
                  onChange={e => updateRule(rule.id, { name: e.target.value })}
                  placeholder="Rule Name (e.g. Mehedi Gift)"
                  className="bg-transparent border-none p-0 text-sm font-black text-slate-800 dark:text-slate-100 focus:ring-0 w-full placeholder:text-slate-300"
                />
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => updateRule(rule.id, { isActive: !rule.isActive })}
                    className={`p-2 rounded-xl transition-colors ${rule.isActive ? 'text-blue-500' : 'text-slate-300'}`}
                  >
                    {rule.isActive ? <CheckCircle2 size={18} /> : <Circle size={18} />}
                  </button>
                  <button 
                    onClick={() => removeRule(rule.id)}
                    className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">When Special Instructions contain:</label>
                  <KeywordInput 
                    value={rule.triggerKeywords}
                    onChange={tags => updateRule(rule.id, { triggerKeywords: tags })}
                    placeholder="sm gift, scalp massager, gift..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-2 px-3 text-[11px] font-bold placeholder:text-slate-300 focus:ring-2 focus:ring-blue-500/10"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Mark these products as FREE (0tk):</label>
                  <KeywordInput 
                    value={rule.targetKeywords}
                    onChange={tags => updateRule(rule.id, { targetKeywords: tags })}
                    placeholder="scalp massager, sm, mehedi mix..."
                    className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-2 px-3 text-[11px] font-bold placeholder:text-slate-300 focus:ring-2 focus:ring-blue-500/10"
                  />
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {rules.length === 0 && (
        <div className="text-center py-12 border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-[3rem]">
          <Gift size={32} className="mx-auto text-slate-200 mb-4" />
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">No gift policies defined</p>
        </div>
      )}
    </div>
  );
}
