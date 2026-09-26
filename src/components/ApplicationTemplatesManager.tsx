import React, { useState } from 'react';
import { 
  ApplicationTemplate, 
  ApplicationCategory, 
  RecipientRoleType, 
  ApplicationCustomField 
} from '../types';
import { 
  Plus, 
  FileText, 
  Edit3, 
  Trash2, 
  CheckCircle2, 
  X, 
  RotateCcw, 
  Info, 
  Sparkles, 
  ListPlus,
  Sliders,
  Eye
} from 'lucide-react';
import { DEFAULT_APPLICATION_TEMPLATES } from '../lib/defaultApplicationTemplates';

interface ApplicationTemplatesManagerProps {
  templates: ApplicationTemplate[];
  onSaveTemplate: (template: ApplicationTemplate) => Promise<void>;
  onDeleteTemplate: (templateId: string) => Promise<void>;
  onResetDefaultTemplates: () => Promise<void>;
}

export const ApplicationTemplatesManager: React.FC<ApplicationTemplatesManagerProps> = ({
  templates,
  onSaveTemplate,
  onDeleteTemplate,
  onResetDefaultTemplates
}) => {
  const [editingTemplate, setEditingTemplate] = useState<ApplicationTemplate | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Field edit state inside modal
  const [currentFields, setCurrentFields] = useState<ApplicationCustomField[]>([]);

  const handleOpenCreate = () => {
    const newTmpl: ApplicationTemplate = {
      id: `custom_${Date.now()}`,
      name: '',
      category: 'other',
      defaultRecipientRole: 'hr_admin',
      subjectTemplate: 'Application from {userName} - {department}',
      salutation: 'Dear Sir/Madam,',
      bodyTemplate: 'I am writing to formally request...\n\nThank you for your consideration.',
      fields: [
        { id: 'reason', label: 'Reason for Request', type: 'textarea', required: true, placeholder: 'Explain your request in detail...' }
      ],
      closing: 'Sincerely,',
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setEditingTemplate(newTmpl);
    setCurrentFields(newTmpl.fields);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (tmpl: ApplicationTemplate) => {
    setEditingTemplate({ ...tmpl });
    setCurrentFields([...tmpl.fields]);
    setIsModalOpen(true);
  };

  const handleAddField = () => {
    const newField: ApplicationCustomField = {
      id: `field_${Date.now()}`,
      label: 'New Field',
      type: 'text',
      required: false,
      placeholder: ''
    };
    setCurrentFields(prev => [...prev, newField]);
  };

  const handleRemoveField = (index: number) => {
    setCurrentFields(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateField = (index: number, updates: Partial<ApplicationCustomField>) => {
    setCurrentFields(prev => prev.map((f, i) => i === index ? { ...f, ...updates } : f));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate || !editingTemplate.name.trim()) {
      alert('Template Name is required');
      return;
    }
    if (!editingTemplate.subjectTemplate.trim()) {
      alert('Subject Template is required');
      return;
    }
    if (!editingTemplate.bodyTemplate.trim()) {
      alert('Body Template is required');
      return;
    }

    setIsSaving(true);
    try {
      const payload: ApplicationTemplate = {
        ...editingTemplate,
        fields: currentFields,
        updatedAt: new Date().toISOString()
      };
      await onSaveTemplate(payload);
      setIsModalOpen(false);
      setEditingTemplate(null);
    } catch (err: any) {
      alert('Failed to save template: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete the template "${name}"?`)) return;
    try {
      await onDeleteTemplate(id);
    } catch (err: any) {
      alert('Failed to delete template: ' + (err?.message || 'Unknown error'));
    }
  };

  const handleResetDefaults = async () => {
    if (!confirm('Reset all application templates to official default system presets (Paid Leave, Resignation, Salary Advance, etc.)? Any custom additions will be replaced.')) return;
    try {
      await onResetDefaultTemplates();
      alert('Application templates successfully reset to defaults.');
    } catch (err: any) {
      alert('Failed to reset templates: ' + (err?.message || 'Unknown error'));
    }
  };

  return (
    <div className="space-y-6 w-full max-w-full min-w-0">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div>
          <h2 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Sliders size={20} className="text-blue-600 dark:text-blue-400" />
            Application Types & Templates
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Configure reusable templates, fixed text, dynamic inputs, and default recipients for employee requests.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-bold transition-all flex items-center gap-1.5"
            title="Reset system templates to standard presets"
          >
            <RotateCcw size={13} />
            <span>Reset Defaults</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5"
          >
            <Plus size={15} />
            <span>Create Template</span>
          </button>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map(tmpl => (
          <div
            key={tmpl.id}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between hover:shadow-md transition-all group"
          >
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                    <FileText size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                      {tmpl.name}
                    </h3>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Category: {tmpl.category}
                    </span>
                  </div>
                </div>

                <span className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                  tmpl.isActive 
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border border-emerald-200/50 dark:border-emerald-800/40' 
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                }`}>
                  {tmpl.isActive ? 'Active' : 'Disabled'}
                </span>
              </div>

              <div className="bg-slate-50 dark:bg-slate-850 rounded-xl p-3 text-xs space-y-1.5 border border-slate-100 dark:border-slate-800">
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Default Recipient: <strong className="text-slate-700 dark:text-slate-300">{tmpl.defaultRecipientRole?.replace('_', ' ').toUpperCase()}</strong>
                </div>
                <div className="text-slate-700 dark:text-slate-300 font-medium truncate text-[11px]">
                  <strong>Subject:</strong> {tmpl.subjectTemplate}
                </div>
                <div className="text-[10px] text-slate-500">
                  {tmpl.fields.length} dynamic field{tmpl.fields.length !== 1 ? 's' : ''} configured
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {tmpl.fields.map(f => (
                  <span
                    key={f.id}
                    className="px-2 py-0.5 rounded text-[9px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                  >
                    {f.label} {f.required && <strong className="text-red-500">*</strong>}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => handleOpenEdit(tmpl)}
                className="px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold transition-all flex items-center gap-1"
              >
                <Edit3 size={13} />
                <span>Edit</span>
              </button>

              <button
                type="button"
                onClick={() => handleDelete(tmpl.id, tmpl.name)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all"
                title="Delete template"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit / Create Template Modal */}
      {isModalOpen && editingTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
          <form
            onSubmit={handleSave}
            className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] my-auto overflow-hidden"
          >
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-850/50 shrink-0">
              <div>
                <h3 className="text-base font-black text-slate-800 dark:text-slate-100">
                  {editingTemplate.id.startsWith('custom_') ? 'Create New Template' : 'Edit Application Template'}
                </h3>
                <p className="text-[11px] text-slate-500">Configure letter layout, parameters, and form fields</p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Template Name</label>
                  <input
                    type="text"
                    required
                    value={editingTemplate.name}
                    onChange={e => setEditingTemplate({ ...editingTemplate, name: e.target.value })}
                    placeholder="e.g. Paid Leave Request"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 dark:text-slate-100"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Category</label>
                  <select
                    value={editingTemplate.category}
                    onChange={e => setEditingTemplate({ ...editingTemplate, category: e.target.value as ApplicationCategory })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 dark:text-slate-100"
                  >
                    <option value="paid_leave">Paid Leave</option>
                    <option value="casual_leave">Casual Leave</option>
                    <option value="reassignment">Reassignment</option>
                    <option value="day_off">Day Off Exchange</option>
                    <option value="resignation">Resignation</option>
                    <option value="salary_advance">Salary Advance</option>
                    <option value="permission">Permission Request</option>
                    <option value="other">Other Request</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Default Recipient Authority</label>
                  <select
                    value={editingTemplate.defaultRecipientRole}
                    onChange={e => setEditingTemplate({ ...editingTemplate, defaultRecipientRole: e.target.value as RecipientRoleType })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 dark:text-slate-100"
                  >
                    <option value="squad_leader">Squad Leader</option>
                    <option value="team_leader">Team Leader</option>
                    <option value="hr_admin">HR & Admin</option>
                    <option value="custom">Custom Recipient</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Subject Format</label>
                  <input
                    type="text"
                    required
                    value={editingTemplate.subjectTemplate}
                    onChange={e => setEditingTemplate({ ...editingTemplate, subjectTemplate: e.target.value })}
                    placeholder="Application for {leaveType} - {userName}"
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 dark:text-slate-100"
                  />
                  <span className="text-[9px] text-slate-400 pl-1 block">
                    Use placeholders: <code>&#123;userName&#125;</code>, <code>&#123;department&#125;</code>, <code>&#123;employeeId&#125;</code>
                  </span>
                </div>
              </div>

              {/* Salutation & Closing */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Salutation</label>
                  <input
                    type="text"
                    value={editingTemplate.salutation}
                    onChange={e => setEditingTemplate({ ...editingTemplate, salutation: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 dark:text-slate-100"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">Sign-off Closing</label>
                  <input
                    type="text"
                    value={editingTemplate.closing}
                    onChange={e => setEditingTemplate({ ...editingTemplate, closing: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 dark:text-slate-100"
                  />
                </div>
              </div>

              {/* Dynamic Form Fields Editor */}
              <div className="border border-slate-200 dark:border-slate-800 rounded-2xl p-4 bg-slate-50/40 dark:bg-slate-850/40 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-slate-800">
                  <div>
                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles size={13} className="text-blue-500" />
                      Dynamic Template Variables
                    </h4>
                    <span className="text-[10px] text-slate-400">Fields the applicant will fill out</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddField}
                    className="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 text-[11px] font-bold flex items-center gap-1"
                  >
                    <Plus size={12} />
                    <span>Add Variable</span>
                  </button>
                </div>

                <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                  {currentFields.map((field, idx) => (
                    <div
                      key={field.id || idx}
                      className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-2 text-xs"
                    >
                      <input
                        type="text"
                        value={field.id}
                        onChange={e => handleUpdateField(idx, { id: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                        placeholder="var_key"
                        className="w-24 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 font-mono text-[10px] text-blue-600 dark:text-blue-400"
                        title="Variable Key for template substitution e.g. {reason}"
                      />

                      <input
                        type="text"
                        value={field.label}
                        onChange={e => handleUpdateField(idx, { label: e.target.value })}
                        placeholder="Field Label"
                        className="flex-1 min-w-[120px] bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 font-bold text-slate-800 dark:text-slate-100"
                      />

                      <select
                        value={field.type}
                        onChange={e => handleUpdateField(idx, { type: e.target.value as any })}
                        className="w-24 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 font-semibold"
                      >
                        <option value="text">Text</option>
                        <option value="textarea">Paragraph</option>
                        <option value="date">Date</option>
                        <option value="number">Number</option>
                        <option value="select">Dropdown</option>
                      </select>

                      <label className="flex items-center gap-1 text-[10px] font-bold text-slate-500 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={e => handleUpdateField(idx, { required: e.target.checked })}
                          className="rounded text-blue-600 focus:ring-0"
                        />
                        <span>Req</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => handleRemoveField(idx)}
                        className="p-1 rounded text-slate-400 hover:text-rose-500"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Body Template Editor */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1 flex items-center justify-between">
                  <span>Application Body Template (Official Letter Format)</span>
                  <span className="text-blue-500 text-[9px] font-mono">
                    Placeholders: {currentFields.map(f => `{${f.id}}`).join(' ')}
                  </span>
                </label>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 pl-1 leading-snug">
                  This official letter format is provided to employees. Employees can choose to use this template or write their own letter, and if they use this template, they can also edit the text directly before submitting.
                </p>
                <textarea
                  rows={8}
                  required
                  value={editingTemplate.bodyTemplate}
                  onChange={e => setEditingTemplate({ ...editingTemplate, bodyTemplate: e.target.value })}
                  className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 text-xs leading-relaxed font-sans text-slate-800 dark:text-slate-100 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              {/* Status Switch */}
              <div className="flex items-center gap-2 pt-1">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingTemplate.isActive}
                    onChange={e => setEditingTemplate({ ...editingTemplate, isActive: e.target.checked })}
                    className="rounded text-blue-600 focus:ring-0"
                  />
                  <span>Active & Available for Employees to Select</span>
                </label>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex items-center justify-end gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shadow-md shadow-blue-500/20"
              >
                {isSaving ? 'Saving...' : 'Save Template'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
