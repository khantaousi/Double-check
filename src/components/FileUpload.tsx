import React, { useCallback, useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

interface FileUploadProps {
  onDataLoaded: (data: any[]) => void;
  isLoading: boolean;
  resetTrigger: number;
}

export const FileUpload: React.FC<FileUploadProps> = ({ onDataLoaded, isLoading, resetTrigger }) => {
  const [isDragging, setIsDragging] = useState(false);
  const [filename, setFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    setFilename(null);
    setError(null);
  }, [resetTrigger]);

  const processFile = async (file: File) => {
    setFilename(file.name);
    setError(null);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const bstr = e.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        
        if (data.length === 0) {
          setError("The file is empty.");
          return;
        }
        
        onDataLoaded(data);
      } catch (err) {
        setError("Failed to parse file. Ensure it's a valid Excel or CSV.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, []);

  return (
    <div className="space-y-4">
      <div 
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`
          relative border-2 border-dashed p-6 transition-all group rounded-2xl
          ${isDragging ? 'border-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm hover:border-slate-300 dark:hover:border-slate-700'}
          ${isLoading ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
        `}
      >
        <input 
          type="file" 
          id="file-upload" 
          className="hidden" 
          accept=".csv, .xlsx, .xls"
          onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])}
        />
        <label htmlFor="file-upload" className="cursor-pointer">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-all ${filename ? 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400' : 'bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 group-hover:text-blue-500 dark:group-hover:text-blue-400'}`}>
              {isLoading ? (
                <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
              ) : filename ? (
                <CheckCircle size={24} />
              ) : (
                <Upload size={24} />
              )}
            </div>
            
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-slate-700 dark:text-slate-200 tracking-tight">
                {filename || "DATA PIPELINE READY"}
              </p>
              <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-widest uppercase">
                {filename ? "Processing complete" : "Supports .csv & .xlsx (Max 50MB)"}
              </p>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-500 bg-red-50 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest mt-2">
                <AlertCircle size={14} />
                {error}
              </div>
            )}
          </div>
        </label>
      </div>
      
      {!filename && (
        <a 
          href="/template.csv" 
          download 
          className="flex items-center justify-center gap-2 text-[10px] font-bold text-blue-600 hover:text-blue-700 uppercase tracking-widest"
        >
          <Download size={12} />
          Download CSV Template
        </a>
      )}
    </div>
  );
};
