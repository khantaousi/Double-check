import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile, SalaryApiConfig, SalaryRecord } from '../types';
import { 
  Banknote, 
  Wallet, 
  User, 
  Calendar, 
  RefreshCw, 
  Download, 
  Printer, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  ExternalLink, 
  CreditCard, 
  TrendingUp, 
  TrendingDown, 
  Receipt, 
  HelpCircle, 
  Search,
  Building2,
  ChevronRight,
  ShieldAlert,
  Settings as SettingsIcon,
  Code
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SalaryPortalProps {
  currentUser: UserProfile | null;
  allUsers: UserProfile[];
  apiConfig: SalaryApiConfig;
  companyName?: string;
  onNavigateToSettings?: () => void;
}

export function SalaryPortal({
  currentUser,
  allUsers,
  apiConfig,
  companyName = 'Parcel Intelligence',
  onNavigateToSettings
}: SalaryPortalProps) {
  const isAdmin = currentUser?.role === 'admin';

  // Admin view mode: 'my-salary' | 'all-staff'
  const [adminViewMode, setAdminViewMode] = useState<'my-salary' | 'all-staff'>('my-salary');
  const [selectedStaffUser, setSelectedStaffUser] = useState<UserProfile | null>(currentUser);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');

  // The active user whose salary is being inspected
  const activeUser = (isAdmin && adminViewMode === 'all-staff') 
    ? (selectedStaffUser || currentUser) 
    : currentUser;

  // Month & Year selection
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonthIdx = currentDate.getMonth(); // 0-11
  
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const [selectedMonth, setSelectedMonth] = useState<string>(months[currentMonthIdx]);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  // Salary Fetching State
  const [isLoading, setIsLoading] = useState(false);
  const [salaryData, setSalaryData] = useState<SalaryRecord | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [rawResponse, setRawResponse] = useState<any | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  // Helper to parse diverse API responses into SalaryRecord
  const parseSalaryResponse = useCallback((raw: any, empId: string, empName: string): SalaryRecord => {
    let payload = raw;
    const employeeObj = (raw && typeof raw === 'object' && raw.employee) ? raw.employee : null;
    const summaryObj = (raw && typeof raw === 'object' && raw.summary) ? raw.summary : null;

    const monthIdx = months.indexOf(selectedMonth);
    const monthNumStr = monthIdx >= 0 ? String(monthIdx + 1).padStart(2, '0') : '';
    const targetYm = `${selectedYear}-${monthNumStr}`; // e.g. "2026-05"

    if (raw && typeof raw === 'object') {
      if (Array.isArray(raw.salaries) && raw.salaries.length > 0) {
        // Look for matching month if available, else pick latest/first
        const matchingSal = raw.salaries.find((s: any) => {
          const sMonth = String(s.salary_month || s.month || '').trim();
          return (
            sMonth === targetYm ||
            sMonth.includes(targetYm) ||
            sMonth.toLowerCase().includes(selectedMonth.toLowerCase()) ||
            (sMonth.includes(String(selectedYear)) && sMonth.includes(monthNumStr))
          );
        });
        payload = matchingSal || raw.salaries[0];
      } else if (raw.data && typeof raw.data === 'object') {
        if (Array.isArray(raw.data.salaries) && raw.data.salaries.length > 0) {
          const matchingSal = raw.data.salaries.find((s: any) => {
            const sMonth = String(s.salary_month || s.month || '').trim();
            return (
              sMonth === targetYm ||
              sMonth.includes(targetYm) ||
              sMonth.toLowerCase().includes(selectedMonth.toLowerCase()) ||
              (sMonth.includes(String(selectedYear)) && sMonth.includes(monthNumStr))
            );
          });
          payload = matchingSal || raw.data.salaries[0];
        } else {
          payload = raw.data;
        }
      } else if (raw.result && typeof raw.result === 'object') {
        payload = raw.result;
      } else if (raw.salary && typeof raw.salary === 'object') {
        payload = raw.salary;
      } else if (Array.isArray(raw) && raw.length > 0) {
        payload = raw[0];
      }
    }

    const getNum = (keys: string[], defaultVal = 0): number => {
      if (!payload || typeof payload !== 'object') return defaultVal;
      for (const k of keys) {
        if (payload[k] !== undefined && payload[k] !== null) {
          const val = Number(payload[k]);
          if (!isNaN(val)) return val;
        }
      }
      return defaultVal;
    };

    const getStr = (keys: string[], defaultVal = ''): string => {
      if (!payload || typeof payload !== 'object') return defaultVal;
      for (const k of keys) {
        if (payload[k] !== undefined && payload[k] !== null) {
          return String(payload[k]);
        }
      }
      return defaultVal;
    };

    const gross = getNum(['gross_salary', 'gross', 'grossSalary', 'basic_salary', 'basic']);
    const basic = getNum(['basic', 'basic_salary', 'basicSalary', 'base_salary', 'base']) || gross;
    const bonus = getNum(['bonus', 'bonuses', 'total_bonus', 'festival_bonus', 'performance_bonus']);
    const allowances = getNum(['allowance', 'allowances', 'house_rent', 'medical', 'transport', 'other_allowance']);
    const overtime = getNum(['overtime', 'ot', 'overtime_amount']);
    const deductions = getNum(['deductions', 'deduction', 'fine_and_deductions', 'total_deductions', 'fine', 'late_deduction']);
    const tax = getNum(['tax', 'income_tax', 'ait']);
    const pf = getNum(['provident_fund', 'pf', 'pension']);
    
    // Net salary calculation fallback
    let net = getNum(['deposited_salary', 'total_payable_salary', 'net_salary', 'netSalary', 'net', 'payable_amount', 'total_payable', 'salary', 'amount', 'total']);
    if (net === 0 && summaryObj && summaryObj.total_deposited_salary) {
      net = Number(summaryObj.total_deposited_salary) || 0;
    }
    if (net === 0 && (gross > 0 || basic > 0)) {
      net = (gross + bonus + allowances + overtime) - (deductions + tax + pf);
    }

    const totalEarnings = (gross > 0 ? (gross + bonus + allowances + overtime) : (basic + bonus + allowances + overtime)) || net;
    const totalDeductions = (deductions + tax + pf) || 0;

    let statusRaw = getStr(['status', 'payment_status', 'paymentStatus', 'state'], 'Paid');
    let paymentStatus: 'Paid' | 'Pending' | 'Processing' | 'On Hold' = 'Paid';
    if (/pending|due|unpaid/i.test(statusRaw)) paymentStatus = 'Pending';
    else if (/process/i.test(statusRaw)) paymentStatus = 'Processing';
    else if (/hold/i.test(statusRaw)) paymentStatus = 'On Hold';

    const paymentDate = getStr(['payment_date', 'paymentDate', 'date', 'disbursed_at', 'pay_date', 'salary_month'], `${selectedMonth} ${selectedYear}`);
    const paymentMethod = getStr(['payment_method', 'paymentMethod', 'method', 'bank_name', 'channel', 'default_payment_channel'], employeeObj?.default_payment_channel || 'Bank / MFS Transfer');
    const bankAccount = getStr(['account', 'account_number', 'account_no', 'bank_account', 'bKash', 'phone', 'mfs_account'], employeeObj?.account_number || activeUser?.loginHandle || '');
    const remarks = getStr(['remarks', 'note', 'comment', 'description'], 'Monthly payroll disbursement');

    const displayName = employeeObj?.name || empName;

    const breakdownItems: { label: string; amount: number; type: 'earning' | 'deduction' }[] = [];
    if (gross > 0) breakdownItems.push({ label: 'Gross Salary (মোট মূল বেতন)', amount: gross, type: 'earning' });
    else if (basic > 0) breakdownItems.push({ label: 'Basic Salary (মূল বেতন)', amount: basic, type: 'earning' });
    if (bonus > 0) breakdownItems.push({ label: 'Bonus / Incentives (বোনাস)', amount: bonus, type: 'earning' });
    if (allowances > 0) breakdownItems.push({ label: 'Allowances & House Rent (ভাতা)', amount: allowances, type: 'earning' });
    if (overtime > 0) breakdownItems.push({ label: 'Overtime Pay (ওভারটাইম)', amount: overtime, type: 'earning' });
    if (deductions > 0) breakdownItems.push({ label: 'Fine & Deductions (জরিমানা ও কর্তন)', amount: deductions, type: 'deduction' });
    if (tax > 0) breakdownItems.push({ label: 'Tax Deduction (আয়কর)', amount: tax, type: 'deduction' });
    if (pf > 0) breakdownItems.push({ label: 'Provident Fund (পিএফ)', amount: pf, type: 'deduction' });

    return {
      employeeId: employeeObj?.employee_id || empId,
      employeeName: displayName,
      month: selectedMonth,
      year: selectedYear,
      basicSalary: basic || gross,
      grossSalary: gross,
      netSalary: net,
      totalEarnings,
      totalDeductions,
      bonuses: bonus,
      allowances,
      overtime,
      deductions,
      tax,
      providentFund: pf,
      paymentStatus,
      paymentDate,
      paymentMethod,
      bankAccountOrMfs: bankAccount,
      breakdown: breakdownItems,
      remarks,
      rawResponse: raw
    };
  }, [activeUser, selectedMonth, selectedYear]);

  // Fetch Salary from External API via Server Proxy
  const fetchSalary = useCallback(async () => {
    if (!activeUser) return;

    const empId = (apiConfig.idField === 'email' 
      ? activeUser.email 
      : apiConfig.idField === 'loginHandle' 
        ? (activeUser.loginHandle || activeUser.email)
        : (activeUser.employeeId || activeUser.id || activeUser.email)) || '';

    if (!empId) {
      setFetchError('No Employee ID found for this user. Please set your Employee ID in Profile Settings or contact Administrator.');
      setSalaryData(null);
      return;
    }

    if (!apiConfig.apiUrl || !apiConfig.isActive) {
      setFetchError('Salary API is not yet configured or is currently disabled. Please ask Admin to configure it in Settings.');
      setSalaryData(null);
      return;
    }

    setIsLoading(true);
    setFetchError(null);
    setRawResponse(null);

    try {
      let result: any = null;
      let usedDirectFetch = false;

      // Attempt 1: Server-side proxy (bypasses CORS & handles headers)
      try {
        const proxyRes = await fetch('/api/salary/proxy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            apiUrl: apiConfig.apiUrl,
            apiKey: apiConfig.apiKey,
            authHeaderType: apiConfig.authHeaderType,
            customHeaderName: apiConfig.customHeaderName,
            queryParamName: apiConfig.queryParamName,
            paramName: apiConfig.paramName || 'employee_id',
            httpMethod: apiConfig.httpMethod || 'GET',
            employeeId: empId,
            month: selectedMonth,
            year: selectedYear
          })
        });

        const rawText = await proxyRes.text();
        try {
          result = JSON.parse(rawText);
        } catch {
          // If proxy returned HTML or invalid JSON (e.g. 404 from static hosting or proxy error)
          if (!proxyRes.ok || rawText.includes('<!DOCTYPE') || rawText.includes('The page')) {
            result = null; // trigger fallback
          } else {
            result = { ok: false, status: proxyRes.status, error: rawText };
          }
        }
      } catch {
        result = null;
      }

      // Attempt 2: Direct browser fetch fallback (if proxy is not present in deployed static build)
      if (!result) {
        usedDirectFetch = true;
        let directUrl = apiConfig.apiUrl.trim()
          .replace(/EMPLOYEE_ID/gi, String(empId))
          .replace(new RegExp(`\\{${apiConfig.paramName || 'employee_id'}\\}`, 'gi'), String(empId))
          .replace(new RegExp(`:${apiConfig.paramName || 'employee_id'}\\b`, 'gi'), String(empId));

        const directHeaders: Record<string, string> = {
          'Accept': 'application/json, text/plain, */*'
        };

        const cleanKey = (apiConfig.apiKey || '').trim();
        if (cleanKey) {
          directHeaders['X-API-KEY'] = cleanKey;
          directHeaders['Authorization'] = `Bearer ${cleanKey}`;
        }

        try {
          const directUrlObj = new URL(directUrl);
          if (!directUrlObj.searchParams.has(apiConfig.paramName || 'employee_id')) {
            directUrlObj.searchParams.set(apiConfig.paramName || 'employee_id', String(empId));
          }
          if (cleanKey && apiConfig.authHeaderType === 'QueryParam') {
            directUrlObj.searchParams.set(apiConfig.queryParamName || 'api_key', cleanKey);
          }
          directUrl = directUrlObj.toString();
        } catch {
          const sep = directUrl.includes('?') ? '&' : '?';
          directUrl += `${sep}${encodeURIComponent(apiConfig.paramName || 'employee_id')}=${encodeURIComponent(String(empId))}`;
        }

        const directRes = await fetch(directUrl, {
          method: 'GET',
          headers: directHeaders
        });

        const directText = await directRes.text();
        try {
          const parsedJson = JSON.parse(directText);
          result = {
            ok: directRes.ok,
            status: directRes.status,
            data: parsedJson,
            urlUsed: directUrl
          };
        } catch {
          result = {
            ok: false,
            status: directRes.status,
            error: directText.length > 150 ? `API returned non-JSON page (HTTP ${directRes.status})` : directText,
            data: directText
          };
        }
      }

      setRawResponse(result?.data || result);

      if (!result || !result.ok) {
        const statusCode = result?.status || 500;
        const remoteMsg = typeof result?.data === 'string' ? result.data : (result?.data?.message || result?.data?.error || result?.error);
        
        let errMsg = '';
        if (typeof remoteMsg === 'string' && (remoteMsg.includes('The page') || remoteMsg.includes('<!DOCTYPE') || remoteMsg.includes('Not Found'))) {
          errMsg = `External API Endpoint পাওয়া যায়নি (HTTP ${statusCode}). API URL ভুল বা সার্ভার নিষ্ক্রিয়। দয়া করে Settings-এ গিয়ে সঠিক API Link প্রদান করুন।`;
        } else if (statusCode === 404) {
          errMsg = `Employee ID "${empId}" was not found in the payroll system (HTTP 404 Not Found).`;
        } else if (statusCode === 401 || statusCode === 403) {
          errMsg = `Authentication failed with external API (HTTP ${statusCode}). ${remoteMsg ? `Server response: "${remoteMsg}". ` : ''}Please check your API Key in Settings.`;
        } else if (statusCode === 502) {
          errMsg = `Cannot connect to API server (${apiConfig.apiUrl}). Error: ${result?.error || 'Server unreachable'}`;
        } else {
          errMsg = remoteMsg || result?.error || `API returned status ${statusCode}`;
        }

        throw new Error(errMsg);
      }

      const resData = result.data;
      if (!resData) {
        throw new Error('Empty response received from payroll API');
      }

      const parsed = parseSalaryResponse(resData, empId, activeUser.displayName || activeUser.email);
      setSalaryData(parsed);
    } catch (err: any) {
      console.warn('Salary API fetch error:', err);
      setFetchError(err.message || 'Unable to connect to salary API');
      setSalaryData(null);
    } finally {
      setIsLoading(false);
    }
  }, [activeUser, apiConfig, selectedMonth, selectedYear, parseSalaryResponse]);

  // Trigger fetch when target user or month/year changes
  useEffect(() => {
    if (apiConfig.apiUrl && apiConfig.isActive) {
      fetchSalary();
    }
  }, [activeUser?.id, selectedMonth, selectedYear, apiConfig.apiUrl, apiConfig.isActive, fetchSalary]);

  // Filtered personnel for Admin search
  const filteredUsers = allUsers.filter(u => {
    if (!staffSearchQuery) return true;
    const q = staffSearchQuery.toLowerCase();
    return (
      (u.displayName && u.displayName.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.employeeId && u.employeeId.toLowerCase().includes(q)) ||
      (u.loginHandle && u.loginHandle.toLowerCase().includes(q))
    );
  });

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-sm">
              <Banknote size={26} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2">
                Salary & Payroll Portal (বেতন ও পে-স্লিপ)
              </h2>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                View your monthly compensation, deductions, and payment status securely
              </p>
            </div>
          </div>

          {/* Admin Mode Switch & Settings Link */}
          <div className="flex items-center gap-2 flex-wrap">
            {isAdmin && (
              <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-xl flex items-center gap-1 border border-slate-200 dark:border-slate-700 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => {
                    setAdminViewMode('my-salary');
                    setSelectedStaffUser(currentUser);
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    adminViewMode === 'my-salary'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  My Salary
                </button>
                <button
                  type="button"
                  onClick={() => setAdminViewMode('all-staff')}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    adminViewMode === 'all-staff'
                      ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                  }`}
                >
                  Staff Overview ({allUsers.length})
                </button>
              </div>
            )}

            {isAdmin && onNavigateToSettings && (
              <button
                type="button"
                onClick={onNavigateToSettings}
                className="px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1.5 transition-all"
                title="Configure External Salary API"
              >
                <SettingsIcon size={14} />
                <span>API Settings</span>
              </button>
            )}
          </div>
        </div>

        {/* Month & Year Bar */}
        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar size={16} className="text-slate-400" />
              <span className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Period:
              </span>
            </div>

            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              {months.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 outline-none"
            >
              {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={fetchSalary}
              disabled={isLoading}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-sm shadow-emerald-500/20 active:scale-95 disabled:opacity-50"
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
              <span>{isLoading ? 'Fetching...' : 'Fetch Salary'}</span>
            </button>
          </div>

          {/* Current Target Personnel Tag */}
          <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/60 px-3.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700/80">
            <User size={14} className="text-slate-400" />
            <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
              {activeUser?.displayName || activeUser?.email}
            </span>
            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-mono">
              ID: {activeUser?.employeeId || 'Not Set'}
            </span>
          </div>
        </div>
      </div>

      {/* Admin Personnel Selector Sidebar / Drawer */}
      {isAdmin && adminViewMode === 'all-staff' && (
        <div className="bg-white dark:bg-slate-900 p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Building2 size={18} className="text-blue-500" />
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
                Select Team Member to Inspect Salary
              </h3>
            </div>
            <div className="relative max-w-xs w-full">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff by name or ID..."
                value={staffSearchQuery}
                onChange={(e) => setStaffSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-h-56 overflow-y-auto pr-1">
            {filteredUsers.map((u) => {
              const isSelected = activeUser?.id === u.id;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedStaffUser(u)}
                  className={`p-3 rounded-2xl border text-left transition-all flex items-center justify-between gap-2 ${
                    isSelected
                      ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-200 shadow-sm'
                      : 'bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700/60 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="truncate">
                    <p className="text-xs font-black truncate">{u.displayName || u.loginHandle || u.email}</p>
                    <p className="text-[10px] font-mono text-slate-400">
                      ID: {u.employeeId || 'N/A'} • {u.role}
                    </p>
                  </div>
                  <ChevronRight size={14} className={`shrink-0 ${isSelected ? 'text-blue-600' : 'text-slate-300'}`} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Notice if No Employee ID */}
      {!activeUser?.employeeId && (
        <div className="p-5 rounded-3xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 flex items-start gap-4 shadow-sm">
          <AlertTriangle size={22} className="shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="space-y-1 text-xs">
            <h4 className="font-black uppercase tracking-tight text-sm">
              Employee ID Missing (কর্মচারী আইডি যুক্ত নেই)
            </h4>
            <p className="font-medium text-amber-700 dark:text-amber-300">
              Your profile does not have an Employee ID assigned. The salary portal queries external payroll systems using your unique Employee ID.
            </p>
            {onNavigateToSettings && (
              <button
                type="button"
                onClick={onNavigateToSettings}
                className="mt-2 text-xs font-bold text-amber-900 dark:text-amber-100 underline hover:no-underline flex items-center gap-1"
              >
                Go to Profile Settings to update your Employee ID &rarr;
              </button>
            )}
          </div>
        </div>
      )}

      {/* Notice if API Not Configured */}
      {(!apiConfig.apiUrl || !apiConfig.isActive) && (
        <div className="p-8 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-center space-y-4 shadow-sm">
          <div className="w-14 h-14 mx-auto rounded-3xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <ShieldAlert size={28} />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h3 className="text-base font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">
              Salary API Not Configured (স্যালারি এপিআই সংযুক্ত নেই)
            </h3>
            <p className="text-xs font-medium text-slate-400">
              Only system administrators can configure the external Salary & Payroll API Key and Endpoint in the Settings tab.
            </p>
          </div>
          {isAdmin && onNavigateToSettings && (
            <button
              type="button"
              onClick={onNavigateToSettings}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-md shadow-blue-500/20 active:scale-95 inline-flex items-center gap-2"
            >
              <SettingsIcon size={16} />
              <span>Configure Salary API in Settings (এপিআই সেট করুন)</span>
            </button>
          )}
        </div>
      )}

      {/* Fetch Error Display */}
      {fetchError && (
        <div className="p-6 rounded-3xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200 space-y-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 font-black text-xs uppercase tracking-tight text-red-700 dark:text-red-300">
              <AlertTriangle size={16} />
              <span>Salary Fetch Warning</span>
            </div>
            {isAdmin && onNavigateToSettings && (
              <button
                type="button"
                onClick={onNavigateToSettings}
                className="text-[11px] font-black uppercase text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <SettingsIcon size={13} />
                <span>Adjust API Settings &rarr;</span>
              </button>
            )}
          </div>
          <p className="text-xs font-medium text-red-600 dark:text-red-300 leading-relaxed">
            {fetchError}
          </p>
          {rawResponse && (
            <details className="text-[10px] text-slate-500 dark:text-slate-400 bg-white/60 dark:bg-slate-900/60 p-3 rounded-xl border border-red-100 dark:border-red-900/30">
              <summary className="cursor-pointer font-bold select-none text-slate-600 dark:text-slate-300">
                Show Technical Response Details
              </summary>
              <pre className="mt-2 font-mono whitespace-pre-wrap overflow-x-auto p-2 bg-slate-100 dark:bg-slate-950 rounded-lg text-slate-800 dark:text-slate-200 text-[10px]">
                {JSON.stringify(rawResponse, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}

      {/* Salary Overview Cards */}
      {salaryData && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          {/* Main Top Highlights Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Net Salary Main Card */}
            <div className="md:col-span-2 bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-emerald-600/20 relative overflow-hidden flex flex-col justify-between min-h-[220px]">
              <div className="relative z-10 flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20">
                    {salaryData.month} {salaryData.year} Pay Statement
                  </span>
                  <h3 className="text-sm font-bold text-emerald-100 mt-3">
                    Net Take-Home Salary (মোট প্রদেয় বেতন)
                  </h3>
                  <p className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight mt-1">
                    ৳ {salaryData.netSalary.toLocaleString('en-IN')}
                  </p>
                </div>

                <div className="text-right">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                    salaryData.paymentStatus === 'Paid'
                      ? 'bg-emerald-400 text-emerald-950 shadow-sm'
                      : salaryData.paymentStatus === 'Pending'
                        ? 'bg-amber-400 text-amber-950 shadow-sm'
                        : 'bg-blue-400 text-blue-950 shadow-sm'
                  }`}>
                    {salaryData.paymentStatus === 'Paid' ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                    {salaryData.paymentStatus}
                  </span>
                  <p className="text-[10px] font-medium text-emerald-200 mt-2">
                    Disbursed: {salaryData.paymentDate || 'N/A'}
                  </p>
                </div>
              </div>

              <div className="relative z-10 pt-6 mt-6 border-t border-white/15 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2 text-emerald-100">
                  <CreditCard size={16} />
                  <span>Channel: <strong>{salaryData.paymentMethod}</strong></span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowPrintModal(true)}
                    className="px-4 py-2 rounded-xl bg-white text-emerald-900 hover:bg-emerald-50 font-black text-xs uppercase tracking-wider flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                  >
                    <Receipt size={14} />
                    <span>View Official Pay Slip (পে-স্লিপ)</span>
                  </button>
                </div>
              </div>

              {/* Decorative Background Circles */}
              <div className="absolute -right-12 -bottom-12 w-48 h-48 rounded-full bg-white/5 pointer-events-none" />
              <div className="absolute right-24 -top-8 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
            </div>

            {/* Quick Metrics Column */}
            <div className="space-y-4 flex flex-col justify-between">
              {/* Gross Earnings */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Total Gross Earnings (মোট আয়)
                  </p>
                  <p className="text-xl font-black text-slate-800 dark:text-slate-100 mt-0.5">
                    ৳ {(salaryData.totalEarnings || salaryData.grossSalary || salaryData.netSalary).toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <TrendingUp size={20} />
                </div>
              </div>

              {/* Total Deductions */}
              <div className="bg-white dark:bg-slate-900 p-5 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Total Deductions (মোট কর্তন)
                  </p>
                  <p className="text-xl font-black text-red-600 dark:text-red-400 mt-0.5">
                    ৳ {(salaryData.totalDeductions || 0).toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center justify-center">
                  <TrendingDown size={20} />
                </div>
              </div>

              {/* Employee ID Badge */}
              <div className="bg-slate-50 dark:bg-slate-800/40 p-4 rounded-3xl border border-slate-200 dark:border-slate-700/60 flex items-center justify-between text-xs">
                <span className="font-bold text-slate-500 dark:text-slate-400">Personnel ID:</span>
                <span className="font-black font-mono text-slate-800 dark:text-slate-200">{salaryData.employeeId}</span>
              </div>
            </div>
          </div>

          {/* Detailed Itemized Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Earnings Breakdown */}
            <div className="bg-white dark:bg-slate-900 p-6 sm:p-7 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
                  <TrendingUp size={16} />
                </div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Earnings & Allowances (আয় বিবরণী)
                </h4>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50 dark:border-slate-800/60">
                  <span className="font-bold text-slate-600 dark:text-slate-300">Basic Salary (মূল বেতন)</span>
                  <span className="font-black font-mono text-slate-800 dark:text-slate-100">
                    ৳ {(salaryData.basicSalary || salaryData.netSalary).toLocaleString('en-IN')}
                  </span>
                </div>

                {(salaryData.allowances || 0) > 0 && (
                  <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50 dark:border-slate-800/60">
                    <span className="font-bold text-slate-600 dark:text-slate-300">House Rent & Allowances</span>
                    <span className="font-black font-mono text-emerald-600 dark:text-emerald-400">
                      + ৳ {salaryData.allowances?.toLocaleString('en-IN')}
                    </span>
                  </div>
                )}

                {(salaryData.bonuses || 0) > 0 && (
                  <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50 dark:border-slate-800/60">
                    <span className="font-bold text-slate-600 dark:text-slate-300">Performance / Festival Bonus</span>
                    <span className="font-black font-mono text-emerald-600 dark:text-emerald-400">
                      + ৳ {salaryData.bonuses?.toLocaleString('en-IN')}
                    </span>
                  </div>
                )}

                {(salaryData.overtime || 0) > 0 && (
                  <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50 dark:border-slate-800/60">
                    <span className="font-bold text-slate-600 dark:text-slate-300">Overtime Compensation</span>
                    <span className="font-black font-mono text-emerald-600 dark:text-emerald-400">
                      + ৳ {salaryData.overtime?.toLocaleString('en-IN')}
                    </span>
                  </div>
                )}

                <div className="flex items-center justify-between text-xs pt-3 font-black text-slate-900 dark:text-slate-100">
                  <span>Gross Earnings Subtotal:</span>
                  <span className="font-mono text-sm">
                    ৳ {(salaryData.totalEarnings || salaryData.grossSalary || salaryData.netSalary).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            {/* Deductions Breakdown */}
            <div className="bg-white dark:bg-slate-900 p-6 sm:p-7 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div className="w-8 h-8 rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 flex items-center justify-center">
                  <TrendingDown size={16} />
                </div>
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  Deductions & Contributions (কর্তন বিবরণী)
                </h4>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50 dark:border-slate-800/60">
                  <span className="font-bold text-slate-600 dark:text-slate-300">General Deductions / Fine</span>
                  <span className="font-black font-mono text-slate-700 dark:text-slate-300">
                    ৳ {(salaryData.deductions || 0).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50 dark:border-slate-800/60">
                  <span className="font-bold text-slate-600 dark:text-slate-300">Income Tax (AIT)</span>
                  <span className="font-black font-mono text-slate-700 dark:text-slate-300">
                    ৳ {(salaryData.tax || 0).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs py-1.5 border-b border-slate-50 dark:border-slate-800/60">
                  <span className="font-bold text-slate-600 dark:text-slate-300">Provident Fund (PF)</span>
                  <span className="font-black font-mono text-slate-700 dark:text-slate-300">
                    ৳ {(salaryData.providentFund || 0).toLocaleString('en-IN')}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs pt-3 font-black text-red-600 dark:text-red-400">
                  <span>Total Deductions:</span>
                  <span className="font-mono text-sm">
                    - ৳ {(salaryData.totalDeductions || 0).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Raw API Response Inspector for Admin / Debugging */}
          {rawResponse && (
            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowRawJson(!showRawJson)}
                className="text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 flex items-center gap-1.5"
              >
                <Code size={14} />
                <span>{showRawJson ? 'Hide Raw API Response' : 'Inspect Raw API Payload'}</span>
              </button>

              <span className="text-[10px] text-slate-400">
                Synced from: {apiConfig.apiUrl}
              </span>
            </div>
          )}

          {showRawJson && rawResponse && (
            <div className="p-4 rounded-2xl bg-slate-950 text-slate-200 text-xs font-mono max-h-60 overflow-y-auto">
              <pre className="whitespace-pre-wrap">{JSON.stringify(rawResponse, null, 2)}</pre>
            </div>
          )}
        </motion.div>
      )}

      {/* Official Printable Pay Slip Modal */}
      <AnimatePresence>
        {showPrintModal && salaryData && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl p-6 sm:p-8 space-y-6"
            >
              {/* Slip Header */}
              <div className="flex items-start justify-between pb-6 border-b border-slate-200 dark:border-slate-800">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                    Official Salary Slip
                  </span>
                  <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 mt-2">
                    {companyName}
                  </h3>
                  <p className="text-xs font-bold text-slate-400">
                    Pay Period: {salaryData.month} {salaryData.year}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-slate-400">
                    Ref: SLIP-{salaryData.employeeId}-{salaryData.year}
                  </span>
                  <p className="text-xs font-bold text-emerald-600 mt-1">
                    Status: {salaryData.paymentStatus}
                  </p>
                </div>
              </div>

              {/* Employee Information */}
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-100 dark:border-slate-800">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-black">Employee Name:</span>
                  <span className="font-black text-slate-800 dark:text-slate-100 text-sm">
                    {salaryData.employeeName || activeUser?.displayName || 'Personnel'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-black">Employee ID:</span>
                  <span className="font-black font-mono text-slate-800 dark:text-slate-100">
                    {salaryData.employeeId}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-black">Payment Date:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {salaryData.paymentDate}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-black">Payment Channel:</span>
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {salaryData.paymentMethod}
                  </span>
                </div>
              </div>

              {/* Breakdown Table */}
              <div className="space-y-3">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-400 font-black uppercase text-[10px]">
                      <th className="text-left py-2">Item Description</th>
                      <th className="text-right py-2">Amount (BDT)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                    <tr>
                      <td className="py-2.5 text-slate-700 dark:text-slate-300">Basic Salary (মূল বেতন)</td>
                      <td className="py-2.5 text-right font-mono font-bold text-slate-800 dark:text-slate-100">
                        ৳ {(salaryData.basicSalary || salaryData.netSalary).toLocaleString('en-IN')}
                      </td>
                    </tr>
                    {(salaryData.allowances || 0) > 0 && (
                      <tr>
                        <td className="py-2.5 text-slate-700 dark:text-slate-300">Allowances & Housing</td>
                        <td className="py-2.5 text-right font-mono font-bold text-emerald-600">
                          + ৳ {salaryData.allowances?.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    )}
                    {(salaryData.bonuses || 0) > 0 && (
                      <tr>
                        <td className="py-2.5 text-slate-700 dark:text-slate-300">Bonus / Incentive</td>
                        <td className="py-2.5 text-right font-mono font-bold text-emerald-600">
                          + ৳ {salaryData.bonuses?.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    )}
                    {(salaryData.deductions || 0) > 0 && (
                      <tr>
                        <td className="py-2.5 text-slate-700 dark:text-slate-300">General Deductions</td>
                        <td className="py-2.5 text-right font-mono font-bold text-red-500">
                          - ৳ {salaryData.deductions?.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    )}
                    {(salaryData.tax || 0) > 0 && (
                      <tr>
                        <td className="py-2.5 text-slate-700 dark:text-slate-300">Income Tax</td>
                        <td className="py-2.5 text-right font-mono font-bold text-red-500">
                          - ৳ {salaryData.tax?.toLocaleString('en-IN')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-300 dark:border-slate-700 text-sm font-black">
                      <td className="py-3 text-slate-900 dark:text-slate-100">Net Payable Amount (মোট প্রদেয় বেতন):</td>
                      <td className="py-3 text-right font-mono text-emerald-600 dark:text-emerald-400">
                        ৳ {salaryData.netSalary.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowPrintModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold hover:bg-slate-200 transition-all cursor-pointer"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-wider flex items-center gap-2 shadow-md shadow-emerald-500/20 active:scale-95 transition-all cursor-pointer"
                >
                  <Printer size={15} />
                  <span>Print Pay Slip</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
