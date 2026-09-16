import React, { useState } from 'react';
import { EmployeeApplication, UserProfile, ApplicationStatus } from '../types';
import { 
  X, 
  Download, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle, 
  Lock, 
  Building2, 
  User, 
  Calendar,
  MessageSquare,
  ShieldCheck,
  Printer
} from 'lucide-react';
import { downloadApplicationPdf } from '../lib/applicationPdf';
import { canUserApproveApplication } from '../lib/applicationFormatters';
import { getBSTISOString } from '../lib/utils';

interface ApplicationViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  application: EmployeeApplication | null;
  currentUser: UserProfile;
  onUpdateStatus?: (
    applicationId: string, 
    newStatus: ApplicationStatus, 
    comment?: string
  ) => Promise<void>;
  onEditDraft?: (application: EmployeeApplication) => void;
}

export const ApplicationViewModal: React.FC<ApplicationViewModalProps> = ({
  isOpen,
  onClose,
  application,
  currentUser,
  onUpdateStatus,
  onEditDraft
}) => {
  const [adminComment, setAdminComment] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<'letter' | 'decision'>('letter');

  if (!isOpen || !application) return null;

  const canApprove = canUserApproveApplication(currentUser, application);
  const isApplicant = application.userId === currentUser.id;

  const getStatusBadge = (status: ApplicationStatus) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 size={13} />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800">
            <XCircle size={13} />
            Rejected
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
            <Clock size={13} />
            Pending Review
          </span>
        );
      case 'submitted':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-800">
            <Clock size={13} />
            Submitted
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
            Draft
          </span>
        );
    }
  };

  const handleStatusChange = async (newStatus: ApplicationStatus) => {
    if (!onUpdateStatus) return;
    const confirmMsg = newStatus === 'approved' 
      ? 'Are you sure you want to approve this application?' 
      : newStatus === 'rejected'
      ? 'Are you sure you want to reject this application?'
      : 'Move application to pending review?';

    if (!confirm(confirmMsg)) return;

    setIsProcessing(true);
    try {
      await onUpdateStatus(application.id, newStatus, adminComment.trim() || undefined);
      onClose();
    } catch (err: any) {
      alert('Error updating status: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadPdf = async () => {
    await downloadApplicationPdf(application, 'Company Enterprise');
  };

  const formattedDate = application.submittedAt 
    ? new Date(application.submittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : new Date(application.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] my-auto overflow-hidden">
        
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-100 dark:border-blue-800/40">
              <ShieldCheck size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-black text-slate-800 dark:text-slate-100">
                  {application.applicationId || 'APP-2026-XXXX'}
                </h2>
                {getStatusBadge(application.status)}
              </div>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                {application.templateName} • {application.category.toUpperCase()}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-xs font-bold transition-all flex items-center gap-1.5 border border-blue-200 dark:border-blue-800/60 shadow-sm"
              title="Download formal PDF"
            >
              <Download size={13} />
              <span>Download PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Read-Only Status & Lock Banner */}
          <div className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300">
                <Lock size={15} />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Record Integrity</span>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {application.isLocked ? 'Immutable & Locked (Official Submission)' : 'Draft Application'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-6 text-xs">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Applicant</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{application.userName}</span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Employee ID</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{application.employeeId || 'N/A'}</span>
              </div>
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase block">Department</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{application.department || application.applicantDepartment || 'General'}</span>
              </div>
            </div>
          </div>

          {/* Formal Letter Paper Card */}
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-10 shadow-sm space-y-6 max-w-3xl mx-auto">
            
            {/* Top Date & Ref */}
            <div className="flex justify-between items-start text-xs text-slate-500 border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <span className="font-semibold">Date: </span>
                {formattedDate}
              </div>
              <div className="font-mono text-[11px] font-bold text-slate-400">
                REF: {application.applicationId}
              </div>
            </div>

            {/* Recipient Block */}
            <div className="text-xs space-y-1 text-slate-800 dark:text-slate-200">
              <div className="font-bold text-slate-500 uppercase text-[10px] tracking-wider">To:</div>
              <div className="font-bold text-sm">{application.recipientName}</div>
              {application.recipientDepartment && (
                <div className="text-slate-600 dark:text-slate-400 font-medium">{application.recipientDepartment}</div>
              )}
              <div className="text-slate-500 text-[11px] uppercase tracking-wide font-semibold">
                Designated Recipient: {application.recipientRole.replace('_', ' ').toUpperCase()}
              </div>
            </div>

            {/* Subject */}
            <div className="text-sm font-black text-slate-900 dark:text-white pt-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              Subject: <span className="underline decoration-slate-300 dark:decoration-slate-700">{application.subject}</span>
            </div>

            {/* Salutation */}
            <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
              {application.salutation || 'Dear Sir/Madam,'}
            </div>

            {/* Rendered Application Body */}
            <div className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed tracking-wide font-sans py-2">
              {application.body}
            </div>

            {/* Closing & Sign-off Block */}
            <div className="pt-6 border-t border-slate-100 dark:border-slate-800 text-xs space-y-1 text-slate-800 dark:text-slate-200">
              <div>{application.closing || 'Sincerely,'}</div>
              <div className="font-bold pt-2 text-sm text-slate-900 dark:text-white">
                {application.userName}
              </div>
              <div className="text-slate-500">Employee ID: {application.employeeId || 'N/A'}</div>
              <div className="text-slate-500">Department: {application.department || application.applicantDepartment || 'General'}</div>
              {application.designation && (
                <div className="text-slate-500">Designation: {application.designation}</div>
              )}
              <div className="text-slate-400 text-[10px] pt-1">{application.userEmail}</div>
            </div>

            {/* Official Reviewer Decision Block */}
            {(application.reviewedBy || application.status !== 'draft') && (
              <div className={`mt-8 p-4 rounded-xl border ${
                application.status === 'approved' 
                  ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
                  : application.status === 'rejected'
                  ? 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/60'
                  : 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/60'
              }`}>
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/50 dark:border-slate-800">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-400">
                    Official Review & Authority Decision
                  </span>
                  {getStatusBadge(application.status)}
                </div>

                <div className="mt-2 text-xs space-y-1 text-slate-700 dark:text-slate-300">
                  {application.reviewedBy ? (
                    <>
                      <div>
                        Reviewed by: <strong>{application.reviewedBy}</strong> ({application.reviewerRole?.replace('_', ' ').toUpperCase() || 'Authority'})
                      </div>
                      {application.reviewedAt && (
                        <div className="text-[11px] text-slate-500">
                          Timestamp: {new Date(application.reviewedAt).toLocaleString('en-GB')}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="italic text-slate-500">
                      Application has been submitted and is awaiting review by authorized leadership.
                    </div>
                  )}

                  {application.adminComment && (
                    <div className="mt-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-800">
                      <span className="text-[10px] font-bold text-slate-500 uppercase block">Reviewer Remarks:</span>
                      <p className="italic text-slate-800 dark:text-slate-200 mt-0.5">"{application.adminComment}"</p>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>

          {/* Approver Action Panel */}
          {canApprove && application.status !== 'draft' && (
            <div className="bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 max-w-3xl mx-auto">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-blue-600 dark:text-blue-400" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
                    Authority Action Controls ({currentUser.userRoleType || currentUser.role})
                  </h3>
                </div>
                <span className="text-[10px] text-slate-400 font-semibold">
                  You are authorized to review this request
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                  Official Decision Remarks / Comments (Optional)
                </label>
                <textarea
                  rows={2}
                  value={adminComment}
                  onChange={e => setAdminComment(e.target.value)}
                  placeholder="Provide comments, reasons, or conditions for this decision..."
                  className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
                {application.status !== 'pending' && (
                  <button
                    type="button"
                    disabled={isProcessing}
                    onClick={() => handleStatusChange('pending')}
                    className="px-4 py-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 text-xs font-bold transition-all flex items-center gap-1.5"
                  >
                    <Clock size={13} />
                    <span>Mark Pending Review</span>
                  </button>
                )}

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleStatusChange('rejected')}
                  className="px-4 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800 text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  <XCircle size={13} />
                  <span>Reject Application</span>
                </button>

                <button
                  type="button"
                  disabled={isProcessing}
                  onClick={() => handleStatusChange('approved')}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-500/20 transition-all flex items-center gap-1.5"
                >
                  <CheckCircle2 size={13} />
                  <span>Approve Application</span>
                </button>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex items-center justify-between shrink-0">
          <div className="text-[11px] text-slate-400">
            Official Document • Hash: {application.id.substring(0, 8)}
          </div>

          <div className="flex items-center gap-2">
            {!application.isLocked && isApplicant && onEditDraft && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditDraft(application);
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all"
              >
                Edit Draft
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 rounded-xl bg-slate-800 dark:bg-slate-700 hover:bg-slate-700 dark:hover:bg-slate-600 text-white text-xs font-bold transition-all"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
