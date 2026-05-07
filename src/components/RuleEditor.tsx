import React, { useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { ValidationRule, DEFAULT_RULES } from '../types';

interface RuleEditorProps {
  existingRules: ValidationRule[];
  onRulesUpdate: (rules: ValidationRule[]) => void;
}

export const RuleEditor: React.FC<RuleEditorProps> = ({ existingRules, onRulesUpdate }) => {
  const [rules, setRules] = React.useState<ValidationRule[]>(existingRules);

  React.useEffect(() => {
    setRules(existingRules);
  }, [existingRules]);

  const addRule = () => {
    const newRule: ValidationRule = {
      id: crypto.randomUUID(),
      min: 0,
      max: 0,
      percentage: 0
    };
    setRules([...rules, newRule]);
  };

  const removeRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
  };

  const updateRule = (id: string, field: keyof ValidationRule, value: number) => {
    const newRules = rules.map(r => r.id === id ? { ...r, [field]: value } : r);
    setRules(newRules);
  };

  const handleSave = () => {
    onRulesUpdate(rules);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Validation Tiers</h3>
        <button 
          onClick={addRule}
          className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="space-y-2">
        {rules.map((rule) => (
          <div key={rule.id} className="group relative flex items-center gap-2 p-2 bg-blue-50/50 dark:bg-blue-900/10 rounded-lg border border-blue-100 dark:border-blue-900/30 transition-colors duration-300">
            <div className="flex-1 flex items-center gap-1">
              <input
                type="number"
                value={rule.min}
                onChange={(e) => updateRule(rule.id, 'min', Number(e.target.value))}
                className="w-full bg-transparent text-[11px] font-bold text-blue-700 dark:text-blue-400 focus:outline-none"
              />
              <span className="text-[10px] font-bold text-blue-300 dark:text-blue-700">-</span>
              <input
                type="number"
                value={rule.max}
                onChange={(e) => updateRule(rule.id, 'max', Number(e.target.value))}
                className="w-full bg-transparent text-[11px] font-bold text-blue-700 dark:text-blue-400 focus:outline-none text-right"
              />
            </div>
            <div className="w-[1px] h-4 bg-blue-200 dark:bg-blue-800" />
            <div className="flex items-center gap-1 w-12 shrink-0">
              <input
                type="number"
                value={rule.percentage}
                onChange={(e) => updateRule(rule.id, 'percentage', Number(e.target.value))}
                className="w-full bg-transparent text-[11px] font-bold text-blue-800 dark:text-blue-300 focus:outline-none text-center"
              />
              <span className="text-[10px] font-bold text-blue-400 dark:text-blue-600">%</span>
            </div>
            
            <button 
              onClick={() => removeRule(rule.id)}
              className="absolute -right-2 -top-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-800 text-red-500 p-1 rounded-full shadow-sm border border-slate-100 dark:border-slate-700 hover:text-red-600"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      <button 
        onClick={handleSave}
        className="mt-4 w-full py-3 bg-slate-900 dark:bg-blue-600 text-white text-xs font-bold rounded-lg shadow-lg shadow-slate-200 dark:shadow-none hover:bg-slate-800 dark:hover:bg-blue-700 transition-all flex items-center justify-center gap-2 uppercase tracking-wide active:scale-[0.98]"
      >
        <Save size={14} />
        Update Logic
      </button>
    </div>
  );
};
