import React, { useState, useEffect } from 'react';
import { 
  EmployeeApplication, 
  ApplicationTemplate, 
  UserProfile, 
  RecipientRoleType,
  ApplicationCustomField 
} from '../types';
import { 
  X, 
  Send, 
  Save, 
  Eye, 
  EyeOff, 
  FileText, 
  AlertCircle, 
  Lock, 
  User, 
  Building2, 
  Calendar, 
  CheckCircle2, 
  Download,
  HelpCircle,
  Clock,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  renderApplicationBody, 
  formatRecipientBlock, 
  generateNextApplicationId 
} from '../lib/applicationFormatters';
import { downloadApplicationPdf } from '../lib/applicationPdf';
import { getBSTISOString } from '../lib/utils';

interface ApplicationFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: ApplicationTemplate[];
  currentUser: UserProfile;
  allUsers: UserProfile[];
  initialDraft?: EmployeeApplication | null;
  onSaveDraft: (app: Partial<EmployeeApplication>) => Promise<void>;
  onSubmitApplication: (app: Partial<EmployeeApplication>) => Promise<void>;
}

export const ApplicationFormModal: React.FC<ApplicationFormModalProps> = ({
  isOpen,
  onClose,
  templates,
  currentUser,
  allUsers,
  initialDraft,
  onSaveDraft,
  onSubmitApplication
}) => {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    initialDraft?.templateId || templates[0]?.id || ''
  );
  const [recipientRole, setRecipientRole] = useState<RecipientRoleType>(
    initialDraft?.recipientRole || 'hr_admin'
  );
  const [recipientName, setRecipientName] = useState<string>(
    initialDraft?.recipientName || 'Human Resources & Management'
  );
  const [recipientDepartment, setRecipientDepartment] = useState<string>(
    initialDraft?.recipientDepartment || 'HR & Operations'
  );
  const [subject, setSubject] = useState<string>(initialDraft?.subject || '');
  const [salutation, setSalutation] = useState<string>(
    initialDraft?.salutation || 'Dear Sir/Madam,'
  );
  const [fieldValues, setFieldValues] = useState<Record<string, any>>(
    initialDraft?.fieldValues || {}
  );
  const [closing, setClosing] = useState<string>(
    initialDraft?.closing || 'Sincerely,'
  );
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showConfirmSubmit, setShowConfirmSubmit] = useState<boolean>(false);

  // Active template
  const activeTemplate = templates.find(t => t.id === selectedTemplateId) || templates[0];

  // Initialize form when template changes
  useEffect(() => {
    if (!initialDraft && activeTemplate) {
      setSubject(
        activeTemplate.subjectTemplate
          .replace(/{userName}/g, currentUser.displayName || currentUser.loginHandle || 'Employee')
          .replace(/{department}/g, currentUser.department || 'General')
          .replace(/{employeeId}/g, currentUser.employeeId || 'N/A')
      );
      setSalutation(activeTemplate.salutation || 'Dear Sir/Madam,');
      setClosing(activeTemplate.closing || 'Sincerely,');
      setRecipientRole(activeTemplate.defaultRecipientRole || 'hr_admin');

      // Initialize default field values
      const initialFields: Record<string, any> = {};
      activeTemplate.fields.forEach(f => {
        if (f.defaultValue !== undefined) {
          initialFields[f.id] = f.defaultValue;
        } else if (f.type === 'date') {
          initialFields[f.id] = new Date().toISOString().split('T')[0];
        } else if (f.type === 'number') {
          initialFields[f.id] = 1;
        } else {
          initialFields[f.id] = '';
        }
      });
      setFieldValues(initialFields);
    }
  }, [selectedTemplateId, activeTemplate, initialDraft, currentUser]);

  // Handle template selection change
  const handleTemplateChange = (tmplId: string) => {
    setSelectedTemplateId(tmplId);
    const tmpl = templates.find(t => t.id === tmplId);
    if (tmpl) {
      setSubject(
        tmpl.subjectTemplate
          .replace(/{userName}/g, currentUser.displayName || currentUser.loginHandle || 'Employee')
          .replace(/{department}/g, currentUser.department || 'General')
          .replace(/{employeeId}/g, currentUser.employeeId || 'N/A')
      );
      setSalutation(tmpl.salutation || 'Dear Sir/Madam,');
      setClosing(tmpl.closing || 'Sincerely,');
      setRecipientRole(tmpl.defaultRecipientRole || 'hr_admin');

      const initialFields: Record<string, any> = {};
      tmpl.fields.forEach(f => {
        if (f.defaultValue !== undefined) {
          initialFields[f.id] = f.defaultValue;
        } else if (f.type === 'date') {
          initialFields[f.id] = new Date().toISOString().split('T')[0];
        } else {
          initialFields[f.id] = '';
        }
      });
      setFieldValues(initialFields);
    }
  };

  // Potential approvers in the system to choose recipient name
  const filteredApprovers = allUsers.filter(u => {
    if (recipientRole === 'squad_leader') return u.userRoleType === 'squad_leader';
    if (recipientRole === 'team_leader') return u.userRoleType === 'team_leader';
    if (recipientRole === 'hr_admin') return u.userRoleType === 'hr_admin' || u.role === 'admin';
    return true;
  });

  const handleFieldChange = (fieldId: string, value: any) => {
    setFieldValues(prev => ({
      ...prev,
      [fieldId]: value
    }));
  };

  const validateRequiredFields = (): string | null => {
    if (!subject.trim()) return 'Application Subject is required';
    if (!recipientName.trim()) return 'Recipient Name / Title is required';

    if (activeTemplate) {
      for (const field of activeTemplate.fields) {
        if (field.required) {
          const val = fieldValues[field.id];
          if (val === undefined || val === null || val === '') {
            return `"${field.label}" is a required field.`;
          }
        }
      }
    }
    return null;
  };

  // Generate rendered body for preview / submission
  const renderedBody = activeTemplate 
    ? renderApplicationBody(activeTemplate.bodyTemplate, fieldValues, {
        userName: currentUser.displayName || currentUser.loginHandle || 'Applicant',
        userEmail: currentUser.email,
        employeeId: currentUser.employeeId || 'N/A',
        department: currentUser.department || 'General',
        designation: currentUser.designation || ''
      })
    : '';

  const getApplicationPayload = (status: 'draft' | 'submitted'): Partial<EmployeeApplication> => {
    return {
      templateId: selectedTemplateId,
      templateName: activeTemplate?.name || 'Custom Application',
      category: activeTemplate?.category || 'other',
      recipientRole,
      recipientName,
      recipientDepartment: recipientDepartment || undefined,
      subject: subject.trim(),
      salutation: salutation.trim(),
      fieldValues,
      body: renderedBody,
      closing: closing.trim(),
      status,
      isLocked: status === 'submitted',
      applicantDepartment: currentUser.department || 'Data & Delivery',
      designation: currentUser.designation || '',
      department: currentUser.department || 'Data & Delivery',
      submittedAt: status === 'submitted' ? getBSTISOString() : undefined
    };
  };

  const handleSaveDraftClick = async () => {
    setIsSubmitting(true);
    try {
      await onSaveDraft(getApplicationPayload('draft'));
      onClose();
    } catch (err: any) {
      alert('Failed to save draft: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmSubmit = async () => {
    const validationError = validateRequiredFields();
    if (validationError) {
      alert(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmitApplication(getApplicationPayload('submitted'));
      setShowConfirmSubmit(false);
      onClose();
    } catch (err: any) {
      alert('Failed to submit application: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDownloadPreviewPdf = async () => {
    const dummyApp: EmployeeApplication = {
      id: initialDraft?.id || 'PREVIEW-TEMP',
      applicationId: initialDraft?.applicationId || 'APP-PREVIEW-DRAFT',
      userId: currentUser.id || 'usr',
      userName: currentUser.displayName || currentUser.loginHandle || 'Employee',
      userEmail: currentUser.email,
      employeeId: currentUser.employeeId,
      department: currentUser.department || 'Data & Delivery',
      applicantDepartment: currentUser.department || 'Data & Delivery',
      designation: currentUser.designation,
      templateId: selectedTemplateId,
      templateName: activeTemplate?.name || 'Application',
      category: activeTemplate?.category || 'other',
      recipientRole,
      recipientName,
      recipientDepartment,
      subject,
      salutation,
      fieldValues,
      body: renderedBody,
      closing,
      status: 'draft',
      isLocked: false,
      createdAt: getBSTISOString(),
      updatedAt: getBSTISOString()
    };
    await downloadApplicationPdf(dummyApp, 'Company Office');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] my-auto overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-100 dark:border-blue-800/40">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800 dark:text-slate-100">
                {initialDraft ? 'Edit Application Draft' : 'Create Formal Application'}
              </h2>
              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                Official employee request with auto-populated profile credentials
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsPreviewMode(!isPreviewMode)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                isPreviewMode 
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {isPreviewMode ? <EyeOff size={14} /> : <Eye size={14} />}
              <span>{isPreviewMode ? 'Edit Form' : 'Letter Preview'}</span>
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
          
          {/* Read-Only Applicant Credentials Banner */}
          <div className="bg-slate-50 dark:bg-slate-850/70 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/60 dark:border-slate-800/60">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Lock size={12} className="text-amber-500" />
                Verified Applicant Credentials (Auto-Populated & Locked)
              </span>
              <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-md">
                Official Record
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Applicant Name</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 truncate block">
                  {currentUser.displayName || currentUser.loginHandle || 'Employee'}
                </span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Employee ID</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400 block">
                  {currentUser.employeeId || 'Not Assigned'}
                </span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Department</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">
                  {currentUser.department || 'Data & Delivery'}
                </span>
              </div>
              <div>
                <span className="text-[9px] uppercase font-bold text-slate-400 block">Designation / Role</span>
                <span className="font-bold text-slate-800 dark:text-slate-200 block truncate">
                  {currentUser.designation || 'Staff'}
                </span>
              </div>
            </div>
          </div>

          {!isPreviewMode ? (
            /* Form View */
            <div className="space-y-5">
              
              {/* Template & Recipient Selection Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Application Type / Template */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1 flex items-center justify-between">
                    <span>Application Type</span>
                    <span className="text-blue-500 text-[9px] font-bold">{templates.length} templates available</span>
                  </label>
                  <select
                    value={selectedTemplateId}
                    onChange={e => handleTemplateChange(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3.5 text-sm font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20"
                  >
                    {templates.map(tmpl => (
                      <option key={tmpl.id} value={tmpl.id}>
                        {tmpl.name} ({tmpl.category})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Recipient Role Authority */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                    Application Recipient Authority
                  </label>
                  <select
                    value={recipientRole}
                    onChange={e => {
                      const newRole = e.target.value as RecipientRoleType;
                      setRecipientRole(newRole);
                      if (newRole === 'squad_leader') {
                        setRecipientName('Squad Leader');
                        setRecipientDepartment(currentUser.department || 'Squad Operations');
                      } else if (newRole === 'team_leader') {
                        setRecipientName('Team Leader');
                        setRecipientDepartment(currentUser.department || 'Team Operations');
                      } else if (newRole === 'hr_admin') {
                        setRecipientName('Human Resources & Admin');
                        setRecipientDepartment('HR & Management');
                      }
                    }}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3.5 text-sm font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="squad_leader">Squad Leader</option>
                    <option value="team_leader">Team Leader</option>
                    <option value="hr_admin">HR & Admin</option>
                    <option value="custom">Custom Recipient</option>
                  </select>
                </div>
              </div>

              {/* Recipient Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                    Recipient Designation / Name
                  </label>
                  <input
                    type="text"
                    value={recipientName}
                    onChange={e => setRecipientName(e.target.value)}
                    placeholder="e.g. Human Resources Manager or John Doe"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3.5 text-sm font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20"
                  />
                  {filteredApprovers.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className="text-[9px] text-slate-400 font-bold">Suggested:</span>
                      {filteredApprovers.slice(0, 3).map(u => (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setRecipientName(u.displayName || u.loginHandle || u.email);
                            if (u.department) setRecipientDepartment(u.department);
                          }}
                          className="text-[9px] font-semibold text-blue-600 hover:underline bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.5 rounded"
                        >
                          {u.displayName || u.loginHandle}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                    Recipient Department
                  </label>
                  <input
                    type="text"
                    value={recipientDepartment}
                    onChange={e => setRecipientDepartment(e.target.value)}
                    placeholder="e.g. Human Resources Department"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3.5 text-sm font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
              </div>

              {/* Subject Line */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1 flex items-center justify-between">
                  <span>Application Subject</span>
                  <span className="text-amber-500 text-[9px] font-bold">* Required</span>
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Application for..."
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2.5 px-3.5 text-sm font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Dynamic Template Fields Section */}
              {activeTemplate && activeTemplate.fields.length > 0 && (
                <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-slate-50/40 dark:bg-slate-850/40 space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800">
                    <span className="text-[11px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Sparkles size={13} className="text-blue-500" />
                      Application Details & Parameters
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">Fill in the application variables</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeTemplate.fields.map(field => {
                      const value = fieldValues[field.id] ?? '';
                      const isFullWidth = field.type === 'textarea';

                      return (
                        <div key={field.id} className={`space-y-1.5 ${isFullWidth ? 'md:col-span-2' : ''}`}>
                          <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest pl-1 flex items-center justify-between">
                            <span>{field.label}</span>
                            {field.required && (
                              <span className="text-red-500 text-[9px] font-bold">* required</span>
                            )}
                          </label>

                          {field.type === 'textarea' ? (
                            <textarea
                              rows={3}
                              value={value}
                              onChange={e => handleFieldChange(field.id, e.target.value)}
                              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
                              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-medium text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20"
                            />
                          ) : field.type === 'select' ? (
                            <select
                              value={value}
                              onChange={e => handleFieldChange(field.id, e.target.value)}
                              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20"
                            >
                              <option value="">Select an option...</option>
                              {field.options?.map(opt => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
                              value={value}
                              onChange={e => handleFieldChange(field.id, e.target.value)}
                              placeholder={field.placeholder || ''}
                              className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Salutation & Closing customizer */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Salutation</label>
                  <input
                    type="text"
                    value={salutation}
                    onChange={e => setSalutation(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Closing</label>
                  <input
                    type="text"
                    value={closing}
                    onChange={e => setClosing(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

            </div>
          ) : (
            /* Live Formal Letter / Email Preview */
            <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 shadow-inner space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-black uppercase tracking-wider text-slate-600 dark:text-slate-300">
                    Formal Letter / Application Preview
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadPreviewPdf}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold text-slate-700 dark:text-slate-300 transition-colors"
                >
                  <Download size={13} />
                  <span>Download Draft PDF</span>
                </button>
              </div>

              {/* Letter Content Layout */}
              <div className="space-y-4 font-serif text-slate-800 dark:text-slate-200 text-sm leading-relaxed max-w-2xl mx-auto py-2">
                {/* Date */}
                <div className="font-sans text-xs text-slate-500">
                  Date: {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>

                {/* Recipient */}
                <div className="font-sans text-xs space-y-0.5 text-slate-700 dark:text-slate-300">
                  <div className="font-bold">To:</div>
                  <div className="font-bold">{recipientName}</div>
                  {recipientDepartment && <div>{recipientDepartment}</div>}
                  <div>Company Headquarters</div>
                </div>

                {/* Subject */}
                <div className="font-sans font-black text-sm text-slate-900 dark:text-white pt-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                  Subject: <span className="underline decoration-slate-400">{subject || '(No subject provided)'}</span>
                </div>

                {/* Salutation */}
                <div className="font-sans font-medium text-xs pt-1">
                  {salutation}
                </div>

                {/* Body */}
                <div className="whitespace-pre-line text-xs font-sans leading-relaxed text-slate-700 dark:text-slate-300">
                  {renderedBody || '(Application body will appear here once fields are filled)'}
                </div>

                {/* Closing */}
                <div className="font-sans text-xs space-y-1 pt-4">
                  <div>{closing}</div>
                  <div className="font-bold pt-2">{currentUser.displayName || currentUser.loginHandle}</div>
                  <div className="text-slate-500">Employee ID: {currentUser.employeeId || 'N/A'}</div>
                  <div className="text-slate-500">Department: {currentUser.department || 'Data & Delivery'}</div>
                  {currentUser.designation && <div className="text-slate-500">Designation: {currentUser.designation}</div>}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <Lock size={13} className="text-amber-500 shrink-0" />
            <span>Submitting will permanently lock the application into read-only mode for review.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSaveDraftClick}
              className="px-4 py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all flex items-center gap-1.5"
            >
              <Save size={14} />
              <span>Save as Draft</span>
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                const err = validateRequiredFields();
                if (err) {
                  alert(err);
                  return;
                }
                setShowConfirmSubmit(true);
              }}
              className="px-5 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-lg shadow-blue-500/20 transition-all flex items-center gap-2"
            >
              <Send size={14} />
              <span>Submit & Lock</span>
            </button>
          </div>
        </div>

        {/* Confirmation Modal for Submit & Lock */}
        {showConfirmSubmit && (
          <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mx-auto">
                <Lock size={24} />
              </div>

              <div className="text-center space-y-1.5">
                <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                  Confirm Official Submission
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Are you sure you want to submit this application? Once submitted, it will be <strong>permanently locked</strong> and cannot be edited by the applicant. It will immediately be routed to authority for formal review.
                </p>
              </div>

              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40 rounded-xl p-3 text-[11px] text-amber-700 dark:text-amber-300">
                • Recipient: <strong>{recipientName}</strong> ({recipientRole})<br />
                • Subject: <strong>{subject}</strong>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmSubmit(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleConfirmSubmit}
                  className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 flex items-center justify-center gap-1.5"
                >
                  {isSubmitting ? (
                    <span>Submitting...</span>
                  ) : (
                    <>
                      <CheckCircle2 size={14} />
                      <span>Confirm & Lock</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
