import React, { useState } from 'react';
import { SalaryApiConfig, DEFAULT_SALARY_API_CONFIG } from '../types';
import { 
  KeyRound, 
  Globe, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Play, 
  ShieldCheck, 
  Terminal, 
  RefreshCw, 
  Sliders, 
  Lock,
  Layers
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SalarySettingsProps {
  config: SalaryApiConfig;
  onSave: (newConfig: SalaryApiConfig) => Promise<void> | void;
  canWrite?: boolean;
}

export function SalarySettings({ config, onSave, canWrite = true }: SalarySettingsProps) {
  const [formData, setFormData] = useState<SalaryApiConfig>({
    ...DEFAULT_SALARY_API_CONFIG,
    ...config
  });
  const [showKey, setShowKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Test Tool State
  const [testEmployeeId, setTestEmployeeId] = useState('EMP-001');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    status?: number;
    data?: any;
    error?: string;
    urlUsed?: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canWrite) return;

    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      await onSave({
        ...formData,
        updatedAt: new Date().toISOString()
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to save salary API configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestApi = async () => {
    if (!formData.apiUrl) {
      setTestResult({
        success: false,
        error: 'Please enter a valid API URL before testing.'
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const startTime = performance.now();
      const proxyRes = await fetch('/api/salary/proxy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          apiUrl: formData.apiUrl,
          apiKey: formData.apiKey,
          authHeaderType: formData.authHeaderType,
          customHeaderName: formData.customHeaderName,
          queryParamName: formData.queryParamName,
          paramName: formData.paramName || 'employee_id',
          httpMethod: formData.httpMethod || 'GET',
          employeeId: testEmployeeId.trim(),
          month: 'Current',
          year: new Date().getFullYear()
        })
      });
      const endTime = performance.now();

      const result = await proxyRes.json();
      const duration = Math.round(endTime - startTime);

      if (!proxyRes.ok || !result.ok) {
        setTestResult({
          success: false,
          status: result.status || proxyRes.status,
          data: result.data || result,
          error: result.error || `HTTP ${result.status || proxyRes.status}: Request to external API failed.`,
          urlUsed: `${result.urlUsed || formData.apiUrl} (${duration}ms)`
        });
      } else {
        setTestResult({
          success: true,
          status: result.status || 200,
          data: result.data,
          urlUsed: `${result.urlUsed || formData.apiUrl} (${duration}ms)`
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        error: `Server proxy connection error: ${err.message || 'Failed to reach local server proxy'}.`,
        urlUsed: formData.apiUrl
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <KeyRound size={20} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
              Salary & Payroll API Setup (স্যালারি এপিআই কনফিগারেশন)
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Only Admin can set the external API credentials for employee salary lookup
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full border ${
            formData.isActive 
              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700'
          }`}>
            {formData.isActive ? 'Active' : 'Disabled'}
          </span>
        </div>
      </div>

      {saveSuccess && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-bold flex items-center gap-3"
        >
          <CheckCircle2 size={18} className="shrink-0" />
          <span>Salary API configuration saved successfully! (এপিআই কনফিগারেশন সফলভাবে সেভ হয়েছে)</span>
        </motion.div>
      )}

      {saveError && (
        <div className="p-4 rounded-2xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-xs font-bold flex items-center gap-3">
          <AlertCircle size={18} className="shrink-0" />
          <span>{saveError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* API URL */}
          <div className="md:col-span-2">
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Globe size={13} className="text-blue-500" />
              External Salary Portal API Endpoint URL (এপিআই লিংক)
            </label>
            <input
              type="url"
              required
              placeholder="https://your-payroll-portal.com/api/employee-salary"
              value={formData.apiUrl}
              onChange={(e) => setFormData({ ...formData, apiUrl: e.target.value })}
              disabled={!canWrite || isSaving}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              Example: https://your-portal.com/api/salary or https://hrm.example.com/api/v1/payroll
            </p>
          </div>

          {/* API Key */}
          <div className="md:col-span-2">
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Lock size={13} className="text-amber-500" />
              Secret API Key / Authorization Token (গোপন এপিআই কি)
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                placeholder="sk_live_..."
                value={formData.apiKey}
                onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                disabled={!canWrite || isSaving}
                className="w-full px-4 py-3 pr-12 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Auth Header Type */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-emerald-500" />
              Authentication Method (অথেনটিকেশন ধরন)
            </label>
            <select
              value={formData.authHeaderType}
              onChange={(e) => setFormData({ ...formData, authHeaderType: e.target.value as any })}
              disabled={!canWrite || isSaving}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="Bearer">Authorization: Bearer {'<token>'} (Standard Bearer)</option>
              <option value="Token">Authorization: Token {'<token>'} (Token Style)</option>
              <option value="ApiKey">X-API-KEY: {'<key>'} (Default Header)</option>
              <option value="RawAuth">Authorization: {'<key>'} (Raw Auth Header)</option>
              <option value="QueryParam">URL Query Parameter (?api_key={'<key>'})</option>
              <option value="Custom">Custom Header Name (e.g. api-key / x-token)</option>
              <option value="None">None (Public API - No Auth Required)</option>
            </select>
          </div>

          {/* Custom Header Name or Query Param Name */}
          {formData.authHeaderType === 'QueryParam' ? (
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Sliders size={13} className="text-purple-500" />
                Query Parameter Key Name
              </label>
              <input
                type="text"
                placeholder="api_key"
                value={formData.queryParamName || 'api_key'}
                onChange={(e) => setFormData({ ...formData, queryParamName: e.target.value.trim() })}
                disabled={!canWrite || isSaving}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                e.g. api_key, key, token, or access_token
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
                <Sliders size={13} className="text-purple-500" />
                Header Key Name (হেডার নাম - No spaces)
              </label>
              <input
                type="text"
                placeholder="X-API-KEY"
                value={formData.customHeaderName || 'X-API-KEY'}
                onChange={(e) => {
                  // Clean header name to prevent invalid header errors with spaces
                  const sanitized = e.target.value.replace(/\s+/g, '-');
                  setFormData({ ...formData, customHeaderName: sanitized });
                }}
                disabled={!canWrite || isSaving || formData.authHeaderType === 'Bearer' || formData.authHeaderType === 'Token' || formData.authHeaderType === 'RawAuth' || formData.authHeaderType === 'None'}
                className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                {formData.authHeaderType === 'Bearer' ? 'Using Authorization: Bearer <key>' : formData.authHeaderType === 'Token' ? 'Using Authorization: Token <key>' : 'e.g. X-API-KEY, api-key, or x-access-token (no spaces)'}
              </p>
            </div>
          )}

          {/* Parameter Name */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Layers size={13} className="text-blue-500" />
              Employee ID Parameter Name
            </label>
            <input
              type="text"
              placeholder="employee_id"
              value={formData.paramName}
              onChange={(e) => setFormData({ ...formData, paramName: e.target.value.trim() })}
              disabled={!canWrite || isSaving}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
            />
            <p className="text-[10px] text-slate-400 mt-1">
              e.g. employee_id, id, emp_id, or employeeId
            </p>
          </div>

          {/* HTTP Method */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 flex items-center gap-1.5">
              <Terminal size={13} className="text-indigo-500" />
              Request Method
            </label>
            <select
              value={formData.httpMethod || 'GET'}
              onChange={(e) => setFormData({ ...formData, httpMethod: e.target.value as any })}
              disabled={!canWrite || isSaving}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="GET">GET (Query Parameter: ?employee_id=XYZ)</option>
              <option value="POST">POST (JSON Body: &#123;"employee_id": "XYZ"&#125;)</option>
            </select>
          </div>

          {/* User ID Field to Send */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Identifier Value to Send
            </label>
            <select
              value={formData.idField || 'employeeId'}
              onChange={(e) => setFormData({ ...formData, idField: e.target.value as any })}
              disabled={!canWrite || isSaving}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
            >
              <option value="employeeId">User Employee ID (কর্মচারী আইডি - Default)</option>
              <option value="email">User Email (ইমেইল)</option>
              <option value="loginHandle">Login Handle / Username</option>
            </select>
          </div>

          {/* Admin Notes / Remarks */}
          <div className="md:col-span-2">
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Admin Notes / Remarks (নোট বা মন্তব্য - Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. DA team salary recheck for double check"
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              disabled={!canWrite || isSaving}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          {/* Enable/Disable Toggle */}
          <div className="md:col-span-2 flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
            <div>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Enable Salary Integration (স্যালারি পোর্টাল সক্রিয় করুন)
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                When active, employees can view their salary in Salary Portal
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                disabled={!canWrite || isSaving}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* Save Button */}
        {canWrite && (
          <div className="pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-blue-500/20 active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Save size={16} />
              {isSaving ? 'Saving Configuration...' : 'Save API Configuration (এপিআই সেটিংস সেভ করুন)'}
            </button>
          </div>
        )}
      </form>

      {/* Live API Tester */}
      <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
        <div className="bg-slate-50 dark:bg-slate-800/50 p-5 sm:p-6 rounded-2xl border border-slate-200 dark:border-slate-700/80 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal size={18} className="text-indigo-500" />
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                Live Salary API Tester (এপিআই টেস্ট টুল)
              </h4>
            </div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Real-time check
            </span>
          </div>

          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            Test your external API endpoint with an Employee ID to confirm connectivity and response format.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Enter Employee ID (e.g. EMP001)"
              value={testEmployeeId}
              onChange={(e) => setTestEmployeeId(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-indigo-500 outline-none"
            />
            <button
              type="button"
              onClick={handleTestApi}
              disabled={isTesting}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-indigo-500/20 active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isTesting ? <RefreshCw size={14} className="animate-spin" /> : <Play size={14} />}
              {isTesting ? 'Fetching...' : 'Test API Fetch'}
            </button>
          </div>

          {/* Test Results Output */}
          <AnimatePresence>
            {testResult && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className={`p-4 rounded-xl border text-xs font-mono mt-3 ${
                  testResult.success 
                    ? 'bg-emerald-950/20 border-emerald-800 text-emerald-300'
                    : 'bg-red-950/20 border-red-800 text-red-300'
                }`}>
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-700/50">
                    <span className="font-bold flex items-center gap-1.5">
                      {testResult.success ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
                      {testResult.success ? `Status: ${testResult.status || 200} OK` : 'Test Request Failed'}
                    </span>
                    {testResult.urlUsed && (
                      <span className="text-[10px] text-slate-400 truncate max-w-xs font-sans">
                        {testResult.urlUsed}
                      </span>
                    )}
                  </div>

                  {testResult.error && (
                    <p className="text-red-400 font-sans text-xs mb-2">
                      {testResult.error}
                    </p>
                  )}

                  {testResult.data && (
                    <pre className="text-[11px] max-h-60 overflow-y-auto whitespace-pre-wrap p-2 rounded bg-black/40 text-slate-200">
                      {typeof testResult.data === 'string' 
                        ? testResult.data 
                        : JSON.stringify(testResult.data, null, 2)}
                    </pre>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
