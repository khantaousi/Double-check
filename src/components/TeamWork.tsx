import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, TeamTask } from '../types';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, query, where, onSnapshot, updateDoc, doc, deleteDoc, orderBy, getDocs, writeBatch } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/errors';
import { CheckCircle2, Clock, Plus, UserPlus, Trash2, Calendar, Layout, User, Play, Pause, BarChart3, TrendingUp, Timer, Database, Edit, CheckCheck, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, differenceInMinutes, parseISO, subDays } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface TeamWorkProps {
  userProfile: UserProfile;
  allUsers: UserProfile[];
}

export const TeamWork: React.FC<TeamWorkProps> = ({ userProfile, allUsers }) => {
  const [tasks, setTasks] = useState<TeamTask[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [view, setView] = useState<'list' | 'report'>('list');
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assigneeIds: [] as string[],
    order: 1,
    isEveryday: false,
    scheduledDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [boardDateRange, setBoardDateRange] = useState<'today' | 'yesterday' | '30days' | 'custom'>('today');
  const [boardCustomStart, setBoardCustomStart] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [boardCustomEnd, setBoardCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTask, setEditingTask] = useState<TeamTask | null>(null);

  const [statusFilter, setStatusFilter] = useState<'all' | TeamTask['status']>('all');
  const isAdmin = userProfile.role === 'admin';

  useEffect(() => {
    // Current user context
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;

    // Sync tasks
    let q;
    if (isAdmin) {
      // Admin sees everything for history/reporting
      q = query(collection(db, 'tasks'), orderBy('assignedAt', 'desc'));
    } else {
      // Users see their own tasks
      q = query(
        collection(db, 'tasks'), 
        where('assigneeId', '==', currentUid),
        orderBy('assignedAt', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as TeamTask[];
      setTasks(taskList);
    }, (error) => {
      console.error("Task subscription error:", error);
    });

    return () => unsubscribe();
  }, [isAdmin]);

  const [purgeStartDate, setPurgeStartDate] = useState(format(subDays(new Date(), 90), 'yyyy-MM-dd'));
  const [purgeEndDate, setPurgeEndDate] = useState(format(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [isPurging, setIsPurging] = useState(false);

  const handlePurgeTasks = async () => {
    if (!isAdmin) return;
    if (!window.confirm(`Are you sure you want to PERMANENTLY delete all non-daily tasks between ${purgeStartDate} and ${purgeEndDate}? This cannot be undone.`)) return;

    setIsPurging(true);
    try {
      const startISO = new Date(purgeStartDate);
      startISO.setHours(0, 0, 0, 0);
      
      const endISO = new Date(purgeEndDate);
      endISO.setHours(23, 59, 59, 999);

      const oldQuery = query(
        collection(db, 'tasks'), 
        where('assignedAt', '>=', startISO.toISOString()),
        where('assignedAt', '<=', endISO.toISOString())
      );
      const oldDocs = await getDocs(oldQuery);
      
      if (oldDocs.empty) {
        alert("No records found within this date range.");
        return;
      }

      const batch = writeBatch(db);
      oldDocs.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
      alert(`Successfully deleted ${oldDocs.size} legacy tasks.`);
    } catch (error) {
      console.error("Purge error:", error);
      alert("Failed to purge tasks. Check permissions.");
    } finally {
      setIsPurging(false);
    }
  };

  const handleOpenEditModal = (task: TeamTask) => {
    setEditingTask(task);
    setNewTask({
      title: task.title,
      description: task.description || '',
      assigneeIds: [task.assigneeId],
      order: task.order || 1,
      isEveryday: task.isEveryday || false,
      scheduledDate: format(parseISO(task.assignedAt), 'yyyy-MM-dd')
    });
    setShowAssignModal(true);
  };

  const handleAssignTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const effectiveAssigneeIds = isAdmin ? newTask.assigneeIds : [auth.currentUser?.uid || ''];
    if (!newTask.title || effectiveAssigneeIds.length === 0) return;

    setIsSubmitting(true);
    try {
      const now = new Date();
      const scheduledDateTime = new Date(newTask.scheduledDate);
      if (format(scheduledDateTime, 'yyyy-MM-dd') !== format(now, 'yyyy-MM-dd')) {
        scheduledDateTime.setHours(9, 0, 0, 0);
      }

      if (editingTask) {
        // Edit is always single task
        const selectedUser = allUsers.find(u => u.id === effectiveAssigneeIds[0]) || userProfile;
        const taskData = {
          title: newTask.title,
          description: newTask.description,
          assigneeId: effectiveAssigneeIds[0],
          assigneeName: selectedUser.displayName || 'Unknown',
          assignedAt: newTask.isEveryday ? (editingTask.assignedAt || now.toISOString()) : scheduledDateTime.toISOString(),
          order: newTask.order,
          isEveryday: newTask.isEveryday || false,
          updatedAt: now.toISOString()
        };
        
        try {
          await updateDoc(doc(db, 'tasks', editingTask.id), taskData);
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `tasks/${editingTask.id}`);
        }
      } else {
        // Creation can be multiple
        const batch = writeBatch(db);
        
        effectiveAssigneeIds.forEach(uid => {
          const selectedUser = allUsers.find(u => u.id === uid) || userProfile;
          const taskData: any = {
            title: newTask.title,
            description: newTask.description,
            assigneeId: uid,
            assigneeName: selectedUser.displayName || 'Unknown',
            status: 'pending',
            assignedAt: newTask.isEveryday ? now.toISOString() : scheduledDateTime.toISOString(),
            createdBy: auth.currentUser?.uid,
            order: newTask.order,
            isEveryday: newTask.isEveryday || false,
          };

          if (!isAdmin) {
            taskData.isSelfAssigned = true;
            taskData.isApproved = false;
          }

          const newDocRef = doc(collection(db, 'tasks'));
          batch.set(newDocRef, taskData);
        });

        await batch.commit();
      }

      setNewTask({ 
        title: '', 
        description: '', 
        assigneeIds: [], 
        order: (newTask.order || 0) + 1,
        isEveryday: false,
        scheduledDate: format(new Date(), 'yyyy-MM-dd')
      });
      setEditingTask(null);
      setShowAssignModal(false);
    } catch (error) {
      console.error("Error saving task:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveTask = async (taskId: string) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        isApproved: true,
        isRejected: false,
        approvedBy: auth.currentUser?.uid,
        approvedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  const handleRejectTask = async (taskId: string) => {
    if (!window.confirm("Are you sure you want to reject this task?")) return;
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        isRejected: true,
        isApproved: false,
        rejectedBy: auth.currentUser?.uid,
        rejectedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  const handleStartTask = async (taskId: string) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        status: 'in-progress',
        startedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  const handlePauseTask = async (taskId: string) => {
    try {
      await updateDoc(doc(db, 'tasks', taskId), {
        status: 'paused',
        lastPausedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${taskId}`);
    }
  };

  const handleResumeTask = async (task: TeamTask) => {
    try {
      const now = new Date();
      const pauseDuration = task.lastPausedAt ? differenceInMinutes(now, parseISO(task.lastPausedAt)) : 0;
      const totalPause = (task.totalPauseMinutes || 0) + pauseDuration;

      await updateDoc(doc(db, 'tasks', task.id), {
        status: 'in-progress',
        resumedAt: now.toISOString(),
        totalPauseMinutes: totalPause
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${task.id}`);
    }
  };

  const handleCompleteTask = async (task: TeamTask) => {
    const now = new Date();
    const startTimeStr = task.startedAt || task.assignedAt;
    const rawDuration = differenceInMinutes(now, parseISO(startTimeStr));
    const effectiveDuration = Math.max(0, rawDuration - (task.totalPauseMinutes || 0));

    try {
      await updateDoc(doc(db, 'tasks', task.id), {
        status: 'completed',
        completedAt: now.toISOString(),
        durationMinutes: effectiveDuration
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${task.id}`);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    try {
      await deleteDoc(doc(db, 'tasks', taskId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `tasks/${taskId}`);
    }
  };

  const filteredTasks = useMemo(() => {
    let list = [];
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');

    if (isAdmin) {
      list = tasks.filter(t => {
        if (t.isEveryday) return true;
        const taskDate = format(parseISO(t.assignedAt), 'yyyy-MM-dd');
        
        if (boardDateRange === 'today') return taskDate === todayStr;
        if (boardDateRange === 'yesterday') return taskDate === yesterdayStr;
        if (boardDateRange === '30days') {
          const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
          return taskDate >= thirtyDaysAgo;
        }
        if (boardDateRange === 'custom') return taskDate >= boardCustomStart && taskDate <= boardCustomEnd;
        return false;
      });
    } else {
      // Users see their tasks for today, pending tasks from past, or everyday tasks
      // UNTIL they are approved by admin. Once approved, they disappear.
      list = tasks.filter(t => 
        t.isEveryday ||
        (t.status !== 'completed' || !t.isApproved)
      );
    }

    // Filter by status if not 'all'
    if (statusFilter !== 'all') {
      list = list.filter(t => t.status === statusFilter);
    }

    // Sort by order asc, then by assignedAt desc
    return list.sort((a, b) => {
      const orderA = a.order ?? 999;
      const orderB = b.order ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime();
    });
  }, [tasks, isAdmin, boardDateRange, boardCustomStart, boardCustomEnd, statusFilter]);

  // Analytics Calculations
  const [statsDateRange, setStatsDateRange] = useState<'today' | 'yesterday' | '30days' | 'custom'>('30days');
  const [customStatsStart, setCustomStatsStart] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [customStatsEnd, setCustomStatsEnd] = useState(format(new Date(), 'yyyy-MM-dd'));

  const analyticsData = useMemo(() => {
    const currentUid = auth.currentUser?.uid;
    const now = new Date();
    const todayStr = format(now, 'yyyy-MM-dd');
    const yesterdayStr = format(subDays(now, 1), 'yyyy-MM-dd');

    const filteredForStats = tasks.filter(t => {
      const taskDate = format(parseISO(t.assignedAt), 'yyyy-MM-dd');
      if (statsDateRange === 'today') return taskDate === todayStr;
      if (statsDateRange === 'yesterday') return taskDate === yesterdayStr;
      if (statsDateRange === '30days') return true; 
      if (statsDateRange === 'custom') {
        return taskDate >= customStatsStart && taskDate <= customStatsEnd;
      }
      return true;
    });

    const userStatsMap = new Map<string, { name: string, completed: number, avgMinutes: number, totalMinutes: number, totalPause: number, taskIds: string[] }>();
    
    filteredForStats.forEach(task => {
      // Only count completed tasks
      // All completed tasks MUST be approved to show in stats
      const isCountable = task.status === 'completed' && 
                        task.durationMinutes !== undefined &&
                        task.isApproved === true;

      if (isCountable) {
        const stats = userStatsMap.get(task.assigneeId) || { name: task.assigneeName, completed: 0, avgMinutes: 0, totalMinutes: 0, totalPause: 0, taskIds: [] };
        stats.completed += 1;
        stats.totalMinutes += task.durationMinutes;
        stats.totalPause += (task.totalPauseMinutes || 0);
        stats.avgMinutes = Math.round(stats.totalMinutes / stats.completed);
        stats.taskIds.push(task.id);
        userStatsMap.set(task.assigneeId, stats);
      }
    });

    return Array.from(userStatsMap.values()).sort((a, b) => b.completed - a.completed);
  }, [tasks, isAdmin, statsDateRange, customStatsStart, customStatsEnd]);

  const handleDeleteUserTasks = async (taskIds: string[], userName: string) => {
    if (!isAdmin) return;
    if (!window.confirm(`Are you sure you want to PERMANENTLY delete all ${taskIds.length} completed & approved tasks for ${userName} in this report period?`)) return;

    try {
      const batch = writeBatch(db);
      taskIds.forEach(id => {
        batch.delete(doc(db, 'tasks', id));
      });
      await batch.commit();
      alert(`Deleted ${taskIds.length} tasks for ${userName}.`);
    } catch (error) {
      console.error("Manual report delete error:", error);
      alert("Failed to delete tasks.");
    }
  };

  // Allow assignment to ALL active users
  const assignableUsers = allUsers.filter(u => u.isActive);

  return (
    <div className="space-y-8 pb-20 relative">
      {/* Background Decor */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* Header Section */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-12 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md p-8 rounded-[3rem] border border-white/20 dark:border-slate-800"
      >
        <div className="flex items-center gap-6">
          <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-blue-800 rounded-3xl flex items-center justify-center text-white shadow-[0_12px_24px_-8px_rgba(37,99,235,0.6)]">
            <Layout className="w-8 h-8" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter leading-none mb-2">Team Work</h2>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none opacity-70">
                {isAdmin ? 'Operational Command & Analytics' : 'Active Duty & Mission Parameters'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-sm p-1.5 rounded-2xl border border-white/20 dark:border-slate-700/30">
            <button 
              onClick={() => setView('list')}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'list' ? 'bg-white dark:bg-slate-700 shadow-[0_4px_12px_rgba(0,0,0,0.05)] text-blue-600' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
            >
              Overview
            </button>
            <button 
              onClick={() => setView('report')}
              className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${view === 'report' ? 'bg-white dark:bg-slate-700 shadow-[0_4px_12px_rgba(0,0,0,0.05)] text-blue-600' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
            >
              Report
            </button>
          </div>

          <div className="flex bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-sm p-1.5 rounded-2xl border border-white/20 dark:border-slate-700/30 overflow-x-auto no-scrollbar">
            {(['all', 'pending', 'in-progress', 'paused', 'completed'] as const).map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  statusFilter === status ? 'bg-white dark:bg-slate-700 shadow-[0_4px_12px_rgba(0,0,0,0.05)] text-blue-600' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {status.replace('-', ' ')}
              </button>
            ))}
          </div>

          {isAdmin && view === 'list' && (
            <div className="flex items-center gap-3">
              <div className="flex bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-sm p-1.5 rounded-2xl border border-white/20 dark:border-slate-700/30">
                {(['today', 'yesterday', '30days', 'custom'] as const).map(range => (
                  <button
                    key={range}
                    onClick={() => setBoardDateRange(range)}
                    className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                      boardDateRange === range ? 'bg-white dark:bg-slate-700 shadow-[0_4px_12px_rgba(0,0,0,0.05)] text-blue-600' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    {range === '30days' ? '30 Days' : range}
                  </button>
                ))}
              </div>

              {boardDateRange === 'custom' && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }} 
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-2 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-sm p-1.5 rounded-2xl border border-white/20 dark:border-slate-700/30"
                >
                  <input 
                    type="date" 
                    value={boardCustomStart}
                    onChange={(e) => setBoardCustomStart(e.target.value)}
                    className="bg-white/80 dark:bg-slate-900/80 border-none rounded-xl py-2 px-4 text-[9px] font-black outline-none w-32"
                  />
                  <span className="text-slate-400 text-[9px] font-black uppercase tracking-widest">to</span>
                  <input 
                    type="date" 
                    value={boardCustomEnd}
                    onChange={(e) => setBoardCustomEnd(e.target.value)}
                    className="bg-white/80 dark:bg-slate-900/80 border-none rounded-xl py-2 px-4 text-[9px] font-black outline-none w-32"
                  />
                </motion.div>
              )}
            </div>
          )}

          <button 
            onClick={() => {
              setEditingTask(null);
              setNewTask({
                title: '',
                description: '',
                assigneeIds: isAdmin ? [] : [(auth.currentUser?.uid || '')],
                order: 1,
                isEveryday: false,
                scheduledDate: format(new Date(), 'yyyy-MM-dd')
              });
              setShowAssignModal(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 rounded-[1.5rem] text-[10px] font-black uppercase tracking-[0.2em] transition-all shadow-[0_15px_30px_-10px_rgba(37,99,235,0.4)] active:scale-95 flex items-center gap-3 whitespace-nowrap"
          >
            <Plus size={18} strokeWidth={3} />
            {isAdmin ? 'Deploy Unit' : 'New Protocol'}
          </button>
        </div>
      </motion.div>

      {/* Admin Purge Tool (Integrated for both views) */}
      {isAdmin && (
        <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 rounded-[2rem] p-6 flex flex-col md:flex-row items-center justify-between gap-4 mb-2">
          <div className="flex items-center gap-4">
            <motion.div 
              whileHover={{ scale: 1.1, rotate: 10 }}
              className="p-3 bg-red-100 dark:bg-red-900/30 rounded-2xl text-red-600"
            >
              <Trash2 size={24} />
            </motion.div>
            <div>
              <h4 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight">Database Purge Utility</h4>
              <p className="text-[10px] font-bold text-slate-400 uppercase">Clear historical task data to optimize performance</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">From Date</span>
              <input 
                type="date" 
                value={purgeStartDate}
                onChange={(e) => setPurgeStartDate(e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl py-2 px-4 text-xs font-bold outline-none"
              />
            </div>
            <div className="flex flex-col">
              <span className="text-[8px] font-black text-slate-400 uppercase mb-1 ml-1">To Date</span>
              <input 
                type="date" 
                value={purgeEndDate}
                onChange={(e) => setPurgeEndDate(e.target.value)}
                className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-800 rounded-xl py-2 px-4 text-xs font-bold outline-none"
              />
            </div>
            <button 
              onClick={handlePurgeTasks}
              disabled={isPurging}
              className="mt-4 md:mt-0 bg-red-600 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-700 transition-all disabled:opacity-50 shadow-lg shadow-red-200 dark:shadow-none"
            >
              {isPurging ? 'Purging...' : 'Execute Purge'}
            </button>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <AnimatePresence mode="wait">
        {view === 'list' ? (
          <motion.div 
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 gap-6"
          >
            {filteredTasks.length === 0 ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-20 text-center">
                <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="text-slate-200" size={32} />
                </div>
                <p className="text-slate-400 font-black uppercase tracking-widest text-[10px]">No Tasks for this period</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredTasks.map((task) => (
                      <motion.div 
                    layout
                    key={task.id}
                    whileHover={{ y: -8, scale: 1.01 }}
                    transition={{ type: "spring", stiffness: 300, damping: 25 }}
                    className={`p-7 rounded-[2.5rem] border transition-all relative overflow-hidden group cursor-pointer ${
                      task.status === 'completed' 
                        ? 'bg-slate-50/40 dark:bg-slate-800/20 shadow-inner dark:shadow-none border-slate-100 dark:border-slate-800/50 grayscale-[0.3] opacity-70' 
                        : 'bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-slate-100 dark:border-slate-800 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.06)] dark:shadow-none hover:shadow-[0_40px_70px_-20px_rgba(37,99,235,0.12)] hover:border-blue-300/30 dark:hover:border-blue-700/30'
                    }`}
                  >
                    <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
                      <Layout size={80} className="text-blue-600 rotate-12" />
                    </div>

                    <div className="flex justify-between items-start mb-5 relative z-10">
                      <div className="flex flex-col gap-1.5">
                        <div className={`px-3 py-1.5 rounded-2xl text-[9px] font-black uppercase tracking-[0.1em] flex items-center gap-2 w-fit shadow-sm border ${
                          task.isRejected ? 'bg-red-50 text-red-600 border-red-100' :
                          task.status === 'completed' ? (task.isApproved ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-100') : 
                          task.status === 'in-progress' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                          task.status === 'paused' ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            task.isRejected ? 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]' :
                            task.status === 'completed' ? (task.isApproved ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-slate-400') : 
                            task.status === 'in-progress' ? 'bg-blue-500 shadow-[0_0_8px_rgba(37,99,235,0.5)] animate-pulse' : 
                            task.status === 'paused' ? 'bg-slate-400' : 'bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]'
                          }`} />
                          {task.isRejected ? 'Rejected Access' : 
                           task.status === 'completed' ? (task.isApproved ? 'Verified & Complete' : 'Submission Pending') : 
                           task.status.replace('-', ' ')}
                          {task.isEveryday && <span className="ml-1 opacity-60 font-medium">| DAILY</span>}
                        </div>
                        {task.order !== undefined && (
                          <div className="text-[9px] font-black text-slate-400/60 uppercase tracking-widest pl-1">
                            L-Priority: <span className="text-slate-800 dark:text-slate-200">{task.order}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex flex-col items-end">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                            {format(parseISO(task.assignedAt), 'MMM dd')}
                          </span>
                        </div>
                        {isAdmin && (
                          <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800/50 p-1 rounded-xl border border-slate-100 dark:border-slate-800">
                            <button 
                              onClick={() => handleOpenEditModal(task)}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all"
                              title="Edit Task"
                            >
                              <Edit size={12} />
                            </button>
                            <div className="w-px h-3 bg-slate-200 dark:bg-slate-700" />
                            <button 
                              onClick={() => handleDeleteTask(task.id)}
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-all"
                              title="Delete Task"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="relative z-10">
                      <h3 className={`font-black text-base mb-3 uppercase tracking-tight leading-loose ${
                        task.status === 'completed' ? 'text-slate-400 line-through decoration-slate-300' : 'text-slate-800 dark:text-slate-50'
                      }`}>
                        {task.title}
                      </h3>
                      {task.description && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-8 line-clamp-3 font-semibold leading-relaxed tracking-wide opacity-80">
                          {task.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-6 border-t border-slate-50 dark:border-slate-800 relative z-10">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-[12px] font-black text-white uppercase shadow-lg shadow-blue-500/20">
                          {task.assigneeName.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-800 dark:text-slate-100 uppercase tracking-tight leading-none mb-0.5">
                            {task.assigneeName}
                          </span>
                          <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest opacity-60">
                            ID: {task.assigneeId.slice(0, 5)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isAdmin && task.status === 'completed' && !task.isApproved && !task.isRejected && (
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => handleApproveTask(task.id)}
                              className="bg-emerald-600 text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 active:scale-95"
                            >
                              <CheckCheck size={12} />
                              Verify
                            </button>
                            <button 
                              onClick={() => handleRejectTask(task.id)}
                              className="bg-white dark:bg-slate-800 text-red-500 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-900/10 transition-all border border-red-100 dark:border-red-900/30 flex items-center gap-1.5 active:scale-95"
                            >
                              <X size={12} />
                              Reject
                            </button>
                          </div>
                        )}
                        {(task.status === 'pending' || task.status === 'paused') && !isAdmin && (
                          <button 
                            onClick={() => task.status === 'paused' ? handleResumeTask(task) : handleStartTask(task.id)}
                            className="bg-blue-600 text-white px-5 py-3 rounded-2xl hover:bg-blue-700 transition-all shadow-[0_8px_20px_-6px_rgba(37,99,235,0.4)] flex items-center gap-2 text-[10px] font-black uppercase tracking-widest active:scale-95"
                          >
                            <Play size={14} fill="currentColor" />
                            {task.status === 'paused' ? 'Resume System' : 'Initiate Work'}
                          </button>
                        )}
                        {task.status === 'in-progress' && !isAdmin && (
                          <div className="flex items-center gap-2">
                             <button 
                              onClick={() => handlePauseTask(task.id)}
                              className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 h-10 px-4 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-all border border-slate-100 dark:border-slate-800 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest"
                              title="Pause Task"
                            >
                              <Pause size={12} fill="currentColor" />
                              Hold
                            </button>
                            <button 
                              onClick={() => handleCompleteTask(task)}
                              className="bg-emerald-600 text-white h-10 px-5 rounded-2xl hover:bg-emerald-700 transition-all shadow-[0_8px_20px_-6px_rgba(16,185,129,0.4)] flex items-center gap-2 text-[10px] font-black uppercase tracking-widest active:scale-95"
                              title="Submit Task"
                            >
                              <CheckCircle2 size={16} />
                              Complete
                            </button>
                          </div>
                        )}
                        {task.status === 'completed' && (
                          <div className="flex flex-col items-end">
                            <div className="text-[11px] font-black text-emerald-600 flex items-center gap-1 leading-none">
                              <Timer size={10} className="opacity-70" />
                              {task.durationMinutes}m
                            </div>
                            <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5 opacity-60">
                              Active Dev
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {(task.startedAt || task.completedAt) && (
                      <div className="mt-5 pt-4 border-t border-slate-50 dark:border-slate-800/10 flex flex-wrap gap-x-6 gap-y-2 relative z-10">
                        {task.startedAt && (
                          <div className="text-[8px] font-black text-slate-400/80 uppercase flex items-center gap-1.5 tracking-widest">
                            <Clock size={10} className="text-blue-500/50" /> 
                            Started: <span className="text-slate-500 dark:text-slate-300 font-bold">{format(parseISO(task.startedAt), 'hh:mm:ss a')}</span>
                          </div>
                        )}
                        {task.completedAt && (
                          <div className="text-[8px] font-black text-emerald-500/80 uppercase flex items-center gap-1.5 tracking-widest">
                            <CheckCircle2 size={10} className="text-emerald-500/50" /> 
                            Finished: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{format(parseISO(task.completedAt), 'hh:mm:ss a')}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div 
            key="report"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-6"
          >
            {/* Report Filters */}
            <div className="flex flex-wrap items-center gap-4 bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                {(['today', 'yesterday', '30days', 'custom'] as const).map(range => (
                  <button 
                    key={range}
                    onClick={() => setStatsDateRange(range)}
                    className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${statsDateRange === range ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500'}`}
                  >
                    {range === '30days' ? 'Last 30 Days' : range}
                  </button>
                ))}
              </div>

              {statsDateRange === 'custom' && (
                <div className="flex items-center gap-2">
                  <input 
                    type="date" 
                    value={customStatsStart}
                    onChange={(e) => setCustomStatsStart(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-2 px-4 text-[10px] font-bold outline-none"
                  />
                  <span className="text-slate-400 font-bold text-[10px]">TO</span>
                  <input 
                    type="date" 
                    value={customStatsEnd}
                    onChange={(e) => setCustomStatsEnd(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-800 border-none rounded-xl py-2 px-4 text-[10px] font-bold outline-none"
                  />
                </div>
              )}
            </div>

        {/* Top Report Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <motion.div 
                whileHover={{ y: -5 }}
                className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-100 dark:border-slate-800 rounded-[2.5rem] p-8 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.05)]"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-blue-600 shadow-sm">
                    <CheckCircle2 size={24} />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Executed</span>
                </div>
                <div className="text-4xl font-black text-slate-800 dark:text-slate-50 tracking-tight">
                  {analyticsData?.reduce((acc, curr) => acc + curr.completed, 0)}
                </div>
              </motion.div>

              <motion.div 
                whileHover={{ y: -5 }}
                className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-100 dark:border-slate-800 rounded-[2.5rem] p-8 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.05)]"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl text-emerald-600 shadow-sm">
                    <Timer size={24} />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Efficiency</span>
                </div>
                <div className="text-4xl font-black text-slate-800 dark:text-slate-50 tracking-tight">
                  {analyticsData?.length ? Math.round(analyticsData.reduce((acc, curr) => acc + curr.avgMinutes, 0) / analyticsData.length) : 0}
                  <span className="text-sm font-black text-slate-400 ml-2 uppercase tracking-widest opacity-50">Min</span>
                </div>
              </motion.div>

              <motion.div 
                whileHover={{ y: -5 }}
                className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-100 dark:border-slate-800 rounded-[2.5rem] p-8 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.05)]"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-blue-600 shadow-sm">
                    <Play size={24} className="fill-current" />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Active</span>
                </div>
                <div className="text-4xl font-black text-slate-800 dark:text-slate-50 tracking-tight">
                  {tasks.filter(t => t.status === 'in-progress').length}
                </div>
              </motion.div>

              <motion.div 
                whileHover={{ y: -5 }}
                className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border border-slate-100 dark:border-slate-800 rounded-[2.5rem] p-8 shadow-[0_20px_40px_-20px_rgba(0,0,0,0.05)]"
              >
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-blue-600 shadow-sm">
                    <Database size={24} />
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Engage</span>
                </div>
                <div className="text-4xl font-black text-slate-800 dark:text-slate-50 tracking-tight">
                  {Math.round((analyticsData?.reduce((acc, curr) => acc + curr.totalMinutes, 0) || 0) / 60 * 10) / 10}
                  <span className="text-sm font-black text-slate-400 ml-2 uppercase tracking-widest opacity-50">Hrs</span>
                </div>
              </motion.div>
            </div>

            {/* Performance Chart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-10">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 mb-8 uppercase tracking-widest flex items-center gap-3">
                  <BarChart3 className="text-blue-600" size={18} />
                  {isAdmin ? 'Efficiency Comparison By Staff' : 'Personal Performance Overview'}
                </h3>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData || []}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis 
                        dataKey="name" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 800 }}
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: '#94A3B8', fontSize: 10, fontWeight: 800 }}
                      />
                      <Tooltip 
                        contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)' }} 
                        cursor={{ fill: 'rgba(59, 130, 246, 0.05)' }} 
                      />
                      <Bar dataKey="completed" name="Tasks Done" radius={[8, 8, 0, 0]}>
                        {(analyticsData || []).map((_, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? '#2563EB' : '#94A3B8'} />
                        ))}
                      </Bar>
                      <Bar dataKey="avgMinutes" name="Avg Time (m)" fill="#F59E0B" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-10">
                <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 mb-8 uppercase tracking-widest flex items-center gap-3">
                  <TrendingUp className="text-green-600" size={18} />
                  {isAdmin ? 'Team Rankings' : 'Personal Rank'}
                </h3>
                <div className="space-y-6">
                  {(analyticsData || []).map((staff, idx) => (
                    <div key={staff.name} className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black ${
                          idx === 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                        }`}>
                          {idx + 1}
                        </div>
                        <div>
                          <p className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-tighter">{staff.name}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">{staff.completed} Tasks</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xs font-black text-slate-400 dark:text-slate-500">{staff.totalPause}m</p>
                          <p className="text-[8px] font-bold text-slate-300 dark:text-slate-600 uppercase italic">PAUSE</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs font-black text-blue-600">{staff.avgMinutes}m</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase italic">AVG TIME</p>
                        </div>
                        {isAdmin && staff.taskIds.length > 0 && (
                          <button 
                            onClick={() => handleDeleteUserTasks(staff.taskIds, staff.name)}
                            className="p-2 text-slate-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                            title={`Clear ${staff.completed} report tasks`}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  {(!analyticsData || analyticsData.length === 0) && (
                    <div className="text-center py-10">
                      <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">No detailed performance data</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Assign Modal */}
      <AnimatePresence>
        {showAssignModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAssignModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.2)] flex flex-col overflow-hidden border border-white/20 dark:border-slate-800"
            >
              <div className="p-12 pb-6 flex justify-between items-start">
                <div>
                  <h3 className="text-3xl font-black text-slate-800 dark:text-white uppercase tracking-tighter mb-2 leading-none">
                    {editingTask ? 'Edit Profile' : isAdmin ? 'Assign Unit' : 'New Protocol'}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] opacity-60">
                    {editingTask ? 'Updating intelligence parameters' : 'Personnel task management & authorization'}
                  </p>
                </div>
                <button 
                  onClick={() => setShowAssignModal(false)}
                  className="p-3 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-2xl transition-all active:scale-90"
                >
                  <X size={20} strokeWidth={3} />
                </button>
              </div>

              <form onSubmit={handleAssignTask} className="p-12 pt-6 space-y-8">
                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Task Designation</label>
                  <input 
                    required
                    type="text" 
                    placeholder="Brief description of work..."
                    value={newTask.title}
                    onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                    className="w-full bg-slate-100/50 dark:bg-slate-800/50 border-2 border-transparent focus:border-blue-500/20 rounded-2xl py-5 px-7 text-sm font-bold focus:bg-white dark:focus:bg-slate-800 transition-all outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {isAdmin && (
                    <div className="md:col-span-2 space-y-2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Deployment Target</label>
                      <div className="grid grid-cols-2 gap-3 max-h-56 overflow-y-auto p-5 bg-slate-100/50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-800 no-scrollbar">
                        {assignableUsers.map(u => (
                          <label key={u.id} className={`flex items-center gap-3 p-3 rounded-2xl transition-all cursor-pointer border-2 ${
                            newTask.assigneeIds.includes(u.id || '') 
                            ? 'bg-white dark:bg-slate-700 border-blue-500/30 ring-4 ring-blue-500/5 shadow-sm' 
                            : 'bg-transparent border-transparent hover:bg-white/50 dark:hover:bg-slate-700/50'
                          }`}>
                            <div className="relative">
                              <input 
                                type="checkbox"
                                checked={newTask.assigneeIds.includes(u.id || '')}
                                onChange={e => {
                                  const uid = u.id || '';
                                  if (e.target.checked) {
                                    setNewTask({ ...newTask, assigneeIds: [...newTask.assigneeIds, uid] });
                                  } else {
                                    setNewTask({ ...newTask, assigneeIds: newTask.assigneeIds.filter(id => id !== uid) });
                                  }
                                }}
                                className="hidden"
                              />
                              <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${
                                newTask.assigneeIds.includes(u.id || '') ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-slate-600'
                              }`}>
                                {newTask.assigneeIds.includes(u.id || '') && <CheckCheck size={12} className="text-white" strokeWidth={4} />}
                              </div>
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-[10px] font-black text-slate-800 dark:text-slate-200 uppercase truncate leading-none mb-0.5">
                                {u.displayName}
                              </span>
                              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
                                {u.email.split('@')[0]}
                              </span>
                            </div>
                          </label>
                        ))}
                      </div>
                      {newTask.assigneeIds.length === 0 && (
                        <p className="text-[9px] text-red-500 font-black mt-2 ml-2 uppercase tracking-widest italic">Authorization Required: Select Personnel</p>
                      )}
                    </div>
                  )}
                  
                  <div className={`space-y-2 ${newTask.isEveryday ? 'opacity-30 pointer-events-none' : ''}`}>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Launch Date</label>
                    <input 
                      type="date" 
                      disabled={newTask.isEveryday}
                      value={newTask.scheduledDate}
                      onChange={e => setNewTask({ ...newTask, scheduledDate: e.target.value })}
                      className="w-full bg-slate-100/50 dark:bg-slate-800/50 border-2 border-transparent focus:border-blue-500/20 rounded-2xl py-4 px-6 text-xs font-bold outline-none"
                    />
                  </div>
                  
                  <div className="flex flex-col justify-end">
                    <label className={`flex items-center gap-4 p-4 rounded-2xl cursor-pointer transition-all border-2 h-[52px] ${
                      newTask.isEveryday ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-900/30' : 'bg-slate-100/50 dark:bg-slate-800/50 border-transparent'
                    }`}>
                      <input 
                        type="checkbox"
                        checked={newTask.isEveryday}
                        onChange={e => {
                          const isDaily = e.target.checked;
                          setNewTask({ 
                            ...newTask, 
                            isEveryday: isDaily,
                            scheduledDate: isDaily ? format(new Date(), 'yyyy-MM-dd') : newTask.scheduledDate
                          });
                        }}
                        className="hidden"
                      />
                      <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${
                        newTask.isEveryday ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-slate-600'
                      }`}>
                        {newTask.isEveryday && <CheckCheck size={12} className="text-white" strokeWidth={4} />}
                      </div>
                      <span className="text-[10px] font-black text-slate-800 dark:text-slate-300 uppercase tracking-[0.15em]">Daily Cycle</span>
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                  <div className="space-y-2">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Queue Priority</label>
                    <input 
                      type="number" 
                      min="1"
                      value={newTask.order}
                      onChange={e => setNewTask({ ...newTask, order: parseInt(e.target.value) || 1 })}
                      className="w-full bg-slate-100/50 dark:bg-slate-800/50 border-2 border-transparent focus:border-blue-500/20 rounded-2xl py-4 px-6 text-xs font-bold outline-none"
                    />
                  </div>

                  <div className="flex gap-3">
                    <button 
                      type="button"
                      onClick={() => setShowAssignModal(false)}
                      className="flex-1 bg-slate-100 dark:bg-slate-800 h-14 text-slate-500 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      Abort
                    </button>
                    <button 
                      disabled={isSubmitting}
                      className="flex-[2] bg-blue-600 h-14 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-blue-700 shadow-xl shadow-blue-500/20 disabled:opacity-50 active:scale-95"
                    >
                      {isSubmitting ? 'Syncing...' : editingTask ? 'Update Ops' : 'Authorize Deployment'}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Operational Context</label>
                  <textarea 
                    placeholder="Specific parameters for execution..."
                    value={newTask.description}
                    onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                    className="w-full bg-slate-100/50 dark:bg-slate-800/50 border-2 border-transparent focus:border-blue-500/20 rounded-3xl py-5 px-7 text-sm font-bold focus:bg-white dark:focus:bg-slate-800 transition-all outline-none h-36 resize-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
                  />
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
