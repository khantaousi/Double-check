import React, { useState, useEffect } from 'react';
import { 
  EmployeeApplication, 
  ApplicationTemplate, 
  UserProfile, 
  ApplicationStatus,
  ApplicationCategory 
} from '../types';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  orderBy,
  where,
  getDocs
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { 
  FileText, 
  Plus, 
  Search, 
  Filter, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Download, 
  Eye, 
  Trash2, 
  Edit3, 
  Sliders, 
  ShieldCheck, 
  User, 
  Building2, 
  Inbox, 
  Send,
  Calendar,
  Lock,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ApplicationFormModal } from './ApplicationFormModal';
import { ApplicationViewModal } from './ApplicationViewModal';
import { ApplicationTemplatesManager } from './ApplicationTemplatesManager';
import { DEFAULT_APPLICATION_TEMPLATES } from '../lib/defaultApplicationTemplates';
import { generateNextApplicationId, canUserApproveApplication, cleanTemplateName } from '../lib/applicationFormatters';
import { downloadApplicationPdf } from '../lib/applicationPdf';
import { getBSTISOString, cleanObject } from '../lib/utils';

interface ApplicationsManagerProps {
  currentUser: UserProfile;
  allUsers: UserProfile[];
}

export const ApplicationsManager: React.FC<ApplicationsManagerProps> = ({
  currentUser,
  allUsers
}) => {
  // Navigation tabs
  const isApprover = currentUser.role === 'admin' || 
    currentUser.userRoleType === 'squad_leader' || 
    currentUser.userRoleType === 'team_leader' || 
    currentUser.userRoleType === 'hr_admin';

  const [activeTab, setActiveTab] = useState<'my' | 'approvals' | 'all' | 'templates'>('my');

  // Applications & Templates State
  const [applications, setApplications] = useState<EmployeeApplication[]>([]);
  const [templates, setTemplates] = useState<ApplicationTemplate[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingDraft, setEditingDraft] = useState<EmployeeApplication | null>(null);
  const [viewingApplication, setViewingApplication] = useState<EmployeeApplication | null>(null);

  // 1. Subscribe to Application Templates in Firestore (and bootstrap defaults if empty)
  useEffect(() => {
    const q = query(collection(db, 'application_templates'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, async snapshot => {
      if (snapshot.empty) {
        // Bootstrap defaults
        console.log('Bootstrapping default application templates...');
        for (const tmpl of DEFAULT_APPLICATION_TEMPLATES) {
          try {
            await setDoc(doc(db, 'application_templates', tmpl.id), cleanObject(tmpl));
          } catch (e) {
            console.warn('Failed to seed template:', e);
          }
        }
        setTemplates(DEFAULT_APPLICATION_TEMPLATES);
      } else {
        const loaded: ApplicationTemplate[] = [];
        snapshot.forEach(docSnap => {
          loaded.push({ id: docSnap.id, ...docSnap.data() } as ApplicationTemplate);
        });
        setTemplates(loaded);
      }
    }, err => {
      console.warn('Error loading templates, using local defaults:', err);
      setTemplates(DEFAULT_APPLICATION_TEMPLATES);
    });

    return () => unsubscribe();
  }, []);

  // 2. Subscribe to Applications in Firestore
  useEffect(() => {
    setIsLoading(true);
    const q = query(collection(db, 'applications'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, snapshot => {
      const loaded: EmployeeApplication[] = [];
      snapshot.forEach(docSnap => {
        loaded.push({ id: docSnap.id, ...docSnap.data() } as EmployeeApplication);
      });
      setApplications(loaded);
      setIsLoading(false);
    }, err => {
      console.error('Error listening to applications:', err);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Filter applications by active tab
  const tabFilteredApplications = applications.filter(app => {
    if (activeTab === 'my') {
      return app.userId === currentUser.id;
    }
    if (activeTab === 'approvals') {
      // Must be submitted, pending, approved or rejected, and user is eligible approver
      return canUserApproveApplication(currentUser, app);
    }
    if (activeTab === 'all') {
      return true;
    }
    return true;
  });

  // Calculate pending approvals count for badge
  const pendingApprovalsCount = applications.filter(app => 
    (app.status === 'submitted' || app.status === 'pending') && 
    canUserApproveApplication(currentUser, app)
  ).length;

  // Search & Status filters
  const filteredList = tabFilteredApplications.filter(app => {
    if (statusFilter !== 'all' && app.status !== statusFilter) return false;
    if (categoryFilter !== 'all' && app.category !== categoryFilter) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchId = app.applicationId?.toLowerCase().includes(q);
      const matchEmpId = app.employeeId?.toLowerCase().includes(q);
      const matchName = app.userName.toLowerCase().includes(q);
      const matchSubject = app.subject.toLowerCase().includes(q);
      const matchTemplate = app.templateName.toLowerCase().includes(q);
      return matchId || matchEmpId || matchName || matchSubject || matchTemplate;
    }
    return true;
  });

  // Metric counters
  const totalCount = tabFilteredApplications.length;
  const approvedCount = tabFilteredApplications.filter(a => a.status === 'approved').length;
  const pendingCount = tabFilteredApplications.filter(a => a.status === 'pending' || a.status === 'submitted').length;
  const rejectedCount = tabFilteredApplications.filter(a => a.status === 'rejected').length;
  const draftCount = tabFilteredApplications.filter(a => a.status === 'draft').length;

  // Handlers for Save Draft and Submit Application
  const handleSaveDraft = async (data: Partial<EmployeeApplication>) => {
    const docId = editingDraft?.id || `app_${Date.now()}`;
    const nextAppId = editingDraft?.applicationId || generateNextApplicationId(applications.length);

    const payload: EmployeeApplication = {
      id: docId,
      applicationId: nextAppId,
      userId: currentUser.id || 'usr',
      userName: currentUser.displayName || currentUser.loginHandle || 'Employee',
      userEmail: currentUser.email,
      employeeId: currentUser.employeeId,
      department: currentUser.department || 'Data & Delivery',
      applicantDepartment: currentUser.department || 'Data & Delivery',
      designation: currentUser.designation,
      templateId: data.templateId || 'default',
      templateName: data.templateName || 'Application',
      category: data.category || 'other',
      recipientRole: data.recipientRole || 'hr_admin',
      recipientName: data.recipientName || 'HR & Management',
      recipientDepartment: data.recipientDepartment,
      subject: data.subject || 'Application',
      salutation: data.salutation || 'Dear Sir/Madam,',
      fieldValues: data.fieldValues || {},
      body: data.body || '',
      closing: data.closing || 'Sincerely,',
      status: 'draft',
      isLocked: false,
      createdAt: editingDraft?.createdAt || getBSTISOString(),
      updatedAt: getBSTISOString()
    };

    await setDoc(doc(db, 'applications', docId), cleanObject(payload));
    setEditingDraft(null);
  };

  const handleSubmitApplication = async (data: Partial<EmployeeApplication>) => {
    const docId = editingDraft?.id || `app_${Date.now()}`;
    const nextAppId = editingDraft?.applicationId || generateNextApplicationId(applications.length);

    const payload: EmployeeApplication = {
      id: docId,
      applicationId: nextAppId,
      userId: currentUser.id || 'usr',
      userName: currentUser.displayName || currentUser.loginHandle || 'Employee',
      userEmail: currentUser.email,
      employeeId: currentUser.employeeId,
      department: currentUser.department || 'Data & Delivery',
      applicantDepartment: currentUser.department || 'Data & Delivery',
      designation: currentUser.designation,
      templateId: data.templateId || 'default',
      templateName: data.templateName || 'Application',
      category: data.category || 'other',
      recipientRole: data.recipientRole || 'hr_admin',
      recipientName: data.recipientName || 'HR & Management',
      recipientDepartment: data.recipientDepartment,
      subject: data.subject || 'Application',
      salutation: data.salutation || 'Dear Sir/Madam,',
      fieldValues: data.fieldValues || {},
      body: data.body || '',
      closing: data.closing || 'Sincerely,',
      status: 'submitted',
      isLocked: true, // Permanent lock on submission
      submittedAt: getBSTISOString(),
      createdAt: editingDraft?.createdAt || getBSTISOString(),
      updatedAt: getBSTISOString()
    };

    await setDoc(doc(db, 'applications', docId), cleanObject(payload));
    setEditingDraft(null);
  };

  // Status update by Approver / Admin
  const handleUpdateStatus = async (
    applicationId: string, 
    newStatus: ApplicationStatus, 
    comment?: string
  ) => {
    const target = applications.find(a => a.id === applicationId);
    if (!target) return;

    const updates: Partial<EmployeeApplication> = {
      status: newStatus,
      adminComment: comment || target.adminComment || undefined,
      reviewedBy: currentUser.displayName || currentUser.loginHandle || 'Official Reviewer',
      reviewerId: currentUser.id,
      reviewerRole: currentUser.userRoleType || (currentUser.role === 'admin' ? 'hr_admin' : 'squad_leader'),
      reviewedAt: getBSTISOString(),
      updatedAt: getBSTISOString()
    };

    await updateDoc(doc(db, 'applications', applicationId), cleanObject(updates));
  };

  // Delete Draft (Only allowed for Drafts owned by current user)
  const handleDeleteApplication = async (application: EmployeeApplication) => {
    if (application.isLocked && currentUser.role !== 'admin') {
      alert('Submitted applications are locked and cannot be deleted.');
      return;
    }

    if (!confirm(`Delete application "${application.applicationId} - ${application.subject}"?`)) return;

    try {
      await deleteDoc(doc(db, 'applications', application.id));
    } catch (err: any) {
      alert('Failed to delete: ' + (err?.message || 'Unknown error'));
    }
  };

  // Template management actions
  const handleSaveTemplate = async (tmpl: ApplicationTemplate) => {
    await setDoc(doc(db, 'application_templates', tmpl.id), cleanObject(tmpl));
  };

  const handleDeleteTemplate = async (templateId: string) => {
    await deleteDoc(doc(db, 'application_templates', templateId));
  };

  const handleResetDefaultTemplates = async () => {
    for (const tmpl of DEFAULT_APPLICATION_TEMPLATES) {
      await setDoc(doc(db, 'application_templates', tmpl.id), cleanObject(tmpl));
    }
  };

  const renderStatusBadge = (status: ApplicationStatus) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800">
            <CheckCircle2 size={11} />
            Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-800">
            <XCircle size={11} />
            Rejected
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-300 dark:border-amber-800">
            <Clock size={11} />
            Pending Review
          </span>
        );
      case 'submitted':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-300 dark:border-blue-800">
            <Clock size={11} />
            Submitted
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-300 dark:border-slate-700">
            Draft
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-0 sm:px-2 w-full max-w-full min-w-0">
      
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
            <FileText size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">
                Employee Applications & Approvals
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                Official Portal
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Submit formal email & letter requests for Leave, Resignation, Salary Advance, and Reassignment with immutable records.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingDraft(null);
            setIsFormModalOpen(true);
          }}
          className="px-5 py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-lg shadow-blue-500/25 hover:shadow-blue-500/35 transition-all flex items-center gap-2 cursor-pointer active:scale-95"
        >
          <Plus size={16} />
          <span>New Application</span>
        </button>
      </div>

      {/* Metric Counters Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Total Requests</span>
          <span className="text-2xl font-black text-slate-900 dark:text-white mt-1 block">{totalCount}</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-blue-500 block">Submitted / Pending</span>
          <span className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1 block">{pendingCount}</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-emerald-500 block">Approved</span>
          <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1 block">{approvedCount}</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-rose-500 block">Rejected</span>
          <span className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-1 block">{rejectedCount}</span>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Drafts</span>
          <span className="text-2xl font-black text-slate-600 dark:text-slate-300 mt-1 block">{draftCount}</span>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-2">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-850 rounded-2xl">
          <button
            type="button"
            onClick={() => setActiveTab('my')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
              activeTab === 'my'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            <User size={14} />
            <span>My Applications</span>
          </button>

          {isApprover && (
            <button
              type="button"
              onClick={() => setActiveTab('approvals')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 relative ${
                activeTab === 'approvals'
                  ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <Inbox size={14} />
              <span>Pending Approvals</span>
              {pendingApprovalsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-blue-600 text-white animate-pulse">
                  {pendingApprovalsCount}
                </span>
              )}
            </button>
          )}

          {(currentUser.role === 'admin' || currentUser.userRoleType === 'hr_admin') && (
            <>
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'all'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <ShieldCheck size={14} />
                <span>All Company Applications</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('templates')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                  activeTab === 'templates'
                    ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <Sliders size={14} />
                <span>Templates & Types</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {activeTab === 'templates' ? (
        <ApplicationTemplatesManager
          templates={templates}
          onSaveTemplate={handleSaveTemplate}
          onDeleteTemplate={handleDeleteTemplate}
          onResetDefaultTemplates={handleResetDefaultTemplates}
        />
      ) : (
        <div className="space-y-4">
          
          {/* Filter & Search Bar */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 shadow-sm">
            <div className="relative flex-1 min-w-0 sm:min-w-[220px] w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by ID (APP-2026-...), employee name, subject..."
                className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-2 pl-9 pr-3 text-xs font-bold text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-2 px-3 text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">All Statuses</option>
                <option value="submitted">Submitted</option>
                <option value="pending">Pending Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="draft">Drafts</option>
              </select>

              <select
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-2 px-3 text-xs font-bold text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="all">All Categories</option>
                <option value="paid_leave">Paid Leave</option>
                <option value="casual_leave">Casual Leave</option>
                <option value="reassignment">Reassignment</option>
                <option value="day_off">Day Off Exchange</option>
                <option value="resignation">Resignation</option>
                <option value="salary_advance">Salary Advance</option>
                <option value="permission">Permission</option>
                <option value="other">Other</option>
              </select>
            </div>
          </div>

          {/* Applications Table / Cards */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
            {isLoading ? (
              <div className="py-16 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                <RefreshCw size={16} className="animate-spin text-blue-500" />
                <span>Loading application records...</span>
              </div>
            ) : filteredList.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                  <FileText size={24} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-700 dark:text-slate-300">No applications found</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {searchQuery || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Create your first application using the button above'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-850/60 border-b border-slate-100 dark:border-slate-800 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    <tr>
                      <th className="py-3 px-4">Application ID</th>
                      <th className="py-3 px-4">Applicant</th>
                      <th className="py-3 px-4">Type & Subject</th>
                      <th className="py-3 px-4">Recipient Authority</th>
                      <th className="py-3 px-4">Date Submitted</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                    {filteredList.map(app => (
                      <tr 
                        key={app.id} 
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-850/40 transition-colors cursor-pointer"
                        onClick={() => setViewingApplication(app)}
                      >
                        {/* ID & Locked badge */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                              {app.applicationId}
                            </span>
                            {app.isLocked && (
                              <Lock size={12} className="text-slate-400" title="Locked official record" />
                            )}
                          </div>
                        </td>

                        {/* Applicant */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div>
                            <div className="font-bold text-slate-800 dark:text-slate-200">{app.userName}</div>
                            <div className="text-[10px] text-slate-400 font-mono">ID: {app.employeeId || 'N/A'} • {app.department || app.applicantDepartment || 'General'}</div>
                          </div>
                        </td>

                        {/* Type & Subject */}
                        <td className="py-3 px-4 max-w-xs">
                          <div>
                            <span className="inline-block text-[9px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.2 rounded mr-1.5">
                              {cleanTemplateName(app.templateName)}
                            </span>
                            <span className="font-bold text-slate-800 dark:text-slate-200 truncate block mt-0.5">
                              {app.subject}
                            </span>
                          </div>
                        </td>

                        {/* Recipient */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-bold text-slate-700 dark:text-slate-300">
                            {app.recipientName}
                          </div>
                          <div className="text-[10px] text-slate-400 font-medium">
                            {app.recipientRole.replace('_', ' ').toUpperCase()}
                          </div>
                        </td>

                        {/* Date */}
                        <td className="py-3 px-4 whitespace-nowrap text-slate-500 font-medium text-[11px]">
                          {app.submittedAt 
                            ? new Date(app.submittedAt).toLocaleDateString('en-GB')
                            : new Date(app.createdAt).toLocaleDateString('en-GB')}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4 whitespace-nowrap">
                          {renderStatusBadge(app.status)}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 whitespace-nowrap text-right" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setViewingApplication(app)}
                              className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-colors"
                              title="View formal letter"
                            >
                              <Eye size={14} />
                            </button>

                            <button
                              type="button"
                              onClick={() => downloadApplicationPdf(app, 'Vics Ventures')}
                              className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/50 hover:bg-blue-100 text-blue-600 dark:text-blue-400 transition-colors"
                              title="Download PDF"
                            >
                              <Download size={14} />
                            </button>

                            {!app.isLocked && app.userId === currentUser.id && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingDraft(app);
                                    setIsFormModalOpen(true);
                                  }}
                                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-colors"
                                  title="Edit draft"
                                >
                                  <Edit3 size={14} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteApplication(app)}
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
                                  title="Delete draft"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      )}

      {/* Create / Edit Form Modal */}
      {isFormModalOpen && (
        <ApplicationFormModal
          isOpen={isFormModalOpen}
          onClose={() => {
            setIsFormModalOpen(false);
            setEditingDraft(null);
          }}
          templates={templates.filter(t => t.isActive)}
          currentUser={currentUser}
          allUsers={allUsers}
          initialDraft={editingDraft}
          onSaveDraft={handleSaveDraft}
          onSubmitApplication={handleSubmitApplication}
        />
      )}

      {/* View Application & Decision Modal */}
      {viewingApplication && (
        <ApplicationViewModal
          isOpen={!!viewingApplication}
          onClose={() => setViewingApplication(null)}
          application={viewingApplication}
          currentUser={currentUser}
          onUpdateStatus={handleUpdateStatus}
          onEditDraft={app => {
            setViewingApplication(null);
            setEditingDraft(app);
            setIsFormModalOpen(true);
          }}
        />
      )}

    </div>
  );
};
