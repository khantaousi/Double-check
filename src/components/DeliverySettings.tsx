import React from 'react';
import { Truck, Home, Map } from 'lucide-react';
import { DeliverySettings as IDeliverySettings } from '../types';

interface DeliverySettingsProps {
  settings: IDeliverySettings;
  onUpdate: (settings: IDeliverySettings) => void;
}

export const DeliverySettings: React.FC<DeliverySettingsProps> = ({ settings, onUpdate }) => {
  const handleChange = (key: keyof IDeliverySettings, value: string) => {
    onUpdate({
      ...settings,
      [key]: Number(value)
    });
  };

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 transition-colors duration-300">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
          <Truck size={16} />
        </div>
        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Delivery Charges</h3>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800/50">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <Home size={14} />
            <span className="text-[11px] font-medium">Inside Dhaka</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-600">৳</span>
            <input
              type="number"
              value={settings.insideDhaka}
              onChange={(e) => handleChange('insideDhaka', e.target.value)}
              className="w-16 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-[11px] font-bold text-blue-700 dark:text-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
            />
          </div>
        </div>

        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-800/50">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <Map size={14} />
            <span className="text-[11px] font-medium">Outside Dhaka</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[11px] font-bold text-slate-400 dark:text-slate-600">৳</span>
            <input
              type="number"
              value={settings.outsideDhaka}
              onChange={(e) => handleChange('outsideDhaka', e.target.value)}
              className="w-16 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-[11px] font-bold text-blue-700 dark:text-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-500 text-right"
            />
          </div>
        </div>
      </div>
      
      <p className="mt-4 text-[9px] text-slate-400 italic">
        * Calculation will check both inclusive and exclusive of these charges.
      </p>
    </div>
  );
};
