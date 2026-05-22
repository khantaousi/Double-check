import React, { useState, useEffect } from 'react';

interface LiveTenureTrackerProps {
  joiningDate?: string;
  createdAt?: string;
  variant?: 'compact' | 'banner';
}

export function LiveTenureTracker({ joiningDate, createdAt, variant = 'compact' }: LiveTenureTrackerProps) {
  const [tenure, setTenure] = useState({
    years: 0,
    months: 0,
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    active: false
  });

  useEffect(() => {
    if (!joiningDate || joiningDate.trim() === '') {
      setTenure(prev => ({ ...prev, active: false }));
      return;
    }

    const updateTenure = () => {
      let baseDate: Date;
      // Parse 'YYYY-MM-DD' as local time midnight
      const [year, month, day] = joiningDate.split('-').map(Number);
      baseDate = new Date(year, month - 1, day, 0, 0, 0);

      const now = new Date();
      const diffMs = now.getTime() - baseDate.getTime();

      if (isNaN(diffMs) || diffMs < 0) {
        setTenure({ years: 0, months: 0, days: 0, hours: 0, minutes: 0, seconds: 0, active: false });
        return;
      }

      // High-precision stepped calendar walking
      let temp = new Date(baseDate.getTime());
      
      let years = 0;
      while (true) {
        let nextTemp = new Date(temp.getTime());
        nextTemp.setFullYear(nextTemp.getFullYear() + 1);
        if (nextTemp.getTime() <= now.getTime()) {
          temp = nextTemp;
          years++;
        } else {
          break;
        }
      }

      let months = 0;
      while (true) {
        let nextTemp = new Date(temp.getTime());
        nextTemp.setMonth(nextTemp.getMonth() + 1);
        if (nextTemp.getTime() <= now.getTime()) {
          temp = nextTemp;
          months++;
        } else {
          break;
        }
      }

      let days = 0;
      while (true) {
        let nextTemp = new Date(temp.getTime());
        nextTemp.setDate(nextTemp.getDate() + 1);
        if (nextTemp.getTime() <= now.getTime()) {
          temp = nextTemp;
          days++;
        } else {
          break;
        }
      }

      const diffRemainingMs = now.getTime() - temp.getTime();
      const totalSecs = Math.floor(diffRemainingMs / 1000);
      const hours = Math.floor(totalSecs / 3600);
      const minutes = Math.floor((totalSecs % 3600) / 60);
      const seconds = totalSecs % 60;

      setTenure({ years, months, days, hours, minutes, seconds, active: true });
    };

    updateTenure();
    const timer = setInterval(updateTenure, 1000);

    return () => clearInterval(timer);
  }, [joiningDate, createdAt]);

  const formatJoiningDate = (dateStr?: string) => {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts.map(Number);
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthAbbr = monthNames[month - 1] || 'Jan';
      return `${day}-${monthAbbr}-${year}`;
    }
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        const day = d.getDate();
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const monthAbbr = monthNames[d.getMonth()];
        const year = d.getFullYear();
        return `${day}-${monthAbbr}-${year}`;
      }
    } catch (e) {}
    return dateStr;
  };

  if (!tenure.active) return null;

  if (variant === 'banner') {
    return (
      <div className="w-full bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-2xl p-4 sm:p-5 shadow-lg shadow-blue-500/5 dark:shadow-none border border-blue-500/20 relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.1),transparent)] pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-9 h-9 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shrink-0">
            <span className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.8)] animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-black uppercase tracking-[0.15em] text-blue-100">Live System Tenure</h3>
            <p className="text-[9px] font-bold text-white/50 uppercase tracking-widest mt-0.5">Real-time operation duration monitor</p>
            {joiningDate ? (
              <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/20 text-emerald-300 font-mono text-[8px] font-black uppercase tracking-wider">
                <span>Joined:</span>
                <span>{formatJoiningDate(joiningDate)}</span>
              </div>
            ) : createdAt ? (
              <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/20 text-emerald-300 font-mono text-[8px] font-black uppercase tracking-wider">
                <span>Joined:</span>
                <span>{formatJoiningDate(createdAt)}</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:gap-2.5 font-mono text-center relative z-10 w-full md:w-auto">
          {/* Years */}
          <div className="bg-white/10 backdrop-blur-md border border-white/10 px-2 py-1 rounded-xl min-w-[50px] sm:min-w-[60px] shadow-sm transform hover:scale-105 transition-all">
            <span className="block text-sm sm:text-base font-black text-white leading-none tabular-nums">{tenure.years}</span>
            <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-wider text-blue-200 mt-0.5 block">Years</span>
          </div>

          {/* Months */}
          <div className="bg-white/10 backdrop-blur-md border border-white/10 px-2 py-1 rounded-xl min-w-[50px] sm:min-w-[60px] shadow-sm transform hover:scale-105 transition-all">
            <span className="block text-sm sm:text-base font-black text-white leading-none tabular-nums">{tenure.months}</span>
            <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-wider text-blue-200 mt-0.5 block">Months</span>
          </div>

          {/* Days */}
          <div className="bg-white/10 backdrop-blur-md border border-white/10 px-2 py-1 rounded-xl min-w-[50px] sm:min-w-[60px] shadow-sm transform hover:scale-105 transition-all">
            <span className="block text-sm sm:text-base font-black text-white leading-none tabular-nums">{tenure.days}</span>
            <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-wider text-blue-200 mt-0.5 block">Days</span>
          </div>

          <div className="text-white/45 text-xs font-black self-center">:</div>

          {/* Hours */}
          <div className="bg-white/10 backdrop-blur-md border border-white/10 px-2 py-1 rounded-xl min-w-[45px] sm:min-w-[55px] shadow-sm transform hover:scale-105 transition-all">
            <span className="block text-sm sm:text-base font-black text-white leading-none tabular-nums">{String(tenure.hours).padStart(2, '0')}</span>
            <span className="text-[7px] font-black uppercase tracking-wider text-blue-200 mt-0.5 block">Hrs</span>
          </div>

          {/* Minutes */}
          <div className="bg-white/10 backdrop-blur-md border border-white/10 px-2 py-1 rounded-xl min-w-[45px] sm:min-w-[55px] shadow-sm transform hover:scale-105 transition-all">
            <span className="block text-sm sm:text-base font-black text-white leading-none tabular-nums">{String(tenure.minutes).padStart(2, '0')}</span>
            <span className="text-[7px] font-black uppercase tracking-wider text-blue-200 mt-0.5 block">Mins</span>
          </div>

          {/* Seconds */}
          <div className="bg-white/20 backdrop-blur-md border border-white/20 px-2 py-1 rounded-xl min-w-[45px] sm:min-w-[55px] shadow-sm transform hover:scale-105 transition-all animate-pulse">
            <span className="block text-sm sm:text-base font-black text-green-300 leading-none tabular-nums">{String(tenure.seconds).padStart(2, '0')}</span>
            <span className="text-[7px] font-black uppercase tracking-wider text-green-200 mt-0.5 block">Secs</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5 mt-1 sm:mt-1.5 p-1.5 px-2 bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/10 dark:border-blue-500/5 rounded-lg text-[9px] font-black uppercase text-blue-600 dark:text-blue-400 tracking-wider">
      <div className="flex items-center gap-1">
        <span className="w-1 h-1 bg-green-500 rounded-full animate-ping shrink-0" />
        <span>Live Tenure:</span>
      </div>
      <div className="flex items-center flex-wrap gap-1 font-mono select-none font-bold tabular-nums">
        {tenure.years > 0 && <span>{tenure.years}y</span>}
        {tenure.months > 0 && <span>{tenure.months}m</span>}
        <span>{tenure.days}d</span>
        <span className="opacity-45">•</span>
        <span>{String(tenure.hours).padStart(2, '0')}h</span>
        <span className="opacity-45">•</span>
        <span>{String(tenure.minutes).padStart(2, '0')}m</span>
        <span className="opacity-45">•</span>
        <span className="text-blue-500 dark:text-blue-300">{String(tenure.seconds).padStart(2, '0')}s</span>
      </div>
    </div>
  );
}
