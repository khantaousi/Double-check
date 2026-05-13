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
    <div className="space-y-6 pb-20">
      {/* Header Section */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-[0_8px_20px_-6px_rgba(37,99,235,0.5)]">
            <Layout className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight leading-none mb-1">Team Performance</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">
              {isAdmin ? 'System assignments and efficiency reporting' : 'Your current workload and tasks'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 shadow-sm border border-slate-100 dark:border-slate-800 p-2 rounded-[2rem]">
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
            <button 
              onClick={() => setView('list')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${view === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Overview
            </button>
            <button 
              onClick={() => setView('report')}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${view === 'report' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Report
            </button>
          </div>

          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl overflow-x-auto no-scrollbar">
            {(['all', 'pending', 'in-progress', 'paused', 'completed'] as const).map(status => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase transition-all whitespace-nowrap ${
                  statusFilter === status ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {isAdmin && view === 'list' && (
            <div className="flex items-center gap-2">
              <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl">
                {(['today', 'yesterday', '30days', 'custom'] as const).map(range => (
                  <button
                    key={range}
                    onClick={() => setBoardDateRange(range)}
                    className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase transition-all whitespace-nowrap ${
                      boardDateRange === range ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'
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
                  className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl"
                >
                  <input 
                    type="date" 
                    value={boardCustomStart}
                    onChange={(e) => setBoardCustomStart(e.target.value)}
                    className="bg-white dark:bg-slate-900 border-none rounded-xl py-1.5 px-3 text-[9px] font-bold outline-none"
                  />
                  <span className="text-slate-400 text-[9px] font-black uppercase">To</span>
                  <input 
                    type="date" 
                    value={boardCustomEnd}
                    onChange={(e) => setBoardCustomEnd(e.target.value)}
                    className="bg-white dark:bg-slate-900 border-none rounded-xl py-1.5 px-3 text-[9px] font-bold outline-none"
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
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_8px_20px_-6px_rgba(37,99,235,0.4)] active:scale-95 flex items-center gap-2 whitespace-nowrap"
          >
            <Plus size={16} />
            {isAdmin ? 'Assign Work' : 'Add Task'}
          </button>
        </div>
      </div>

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
                    className={`p-6 rounded-[2rem] border transition-all relative overflow-hidden group cursor-pointer ${
                      task.status === 'completed' 
                        ? 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800 opacity-80' 
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-100/50 dark:shadow-none hover:shadow-2xl hover:shadow-blue-500/10 hover:border-blue-200 dark:hover:border-blue-800'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex flex-col gap-1">
                        <div className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 w-fit ${
                          task.isRejected ? 'bg-red-100 text-red-600' :
                          task.status === 'completed' ? (task.isApproved ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-600') : 
                          task.status === 'in-progress' ? 'bg-amber-100 text-amber-600' : 
                          task.status === 'paused' ? 'bg-slate-100 text-slate-600' : 'bg-blue-100 text-blue-600'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            task.isRejected ? 'bg-red-500' :
                            task.status === 'completed' ? (task.isApproved ? 'bg-green-500' : 'bg-slate-400') : 
                            task.status === 'in-progress' ? 'bg-amber-500 animate-pulse' : 
                            task.status === 'paused' ? 'bg-slate-400' : 'bg-blue-500'
                          }`} />
                          {task.isRejected ? 'Rejected' : 
                           task.status === 'completed' ? (task.isApproved ? 'Completed & Approved' : 'Submitted') : 
                           task.status}
                          {task.isEveryday && <span className="ml-1 opacity-70">• DAILY</span>}
                        </div>
                        {task.order !== undefined && (
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter pl-1">
                            PRIORITY: #{task.order}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400">
                          {format(parseISO(task.assignedAt), 'MMM dd')}
                        </span>
                        {isAdmin && (
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => handleOpenEditModal(task)}
                              className="p-1.5 text-slate-300 hover:text-blue-500 transition-colors"
                              title="Edit Task"
                            >
                              <Edit size={14} />
                            </button>
                            <button 
                              onClick={() => handleDeleteTask(task.id)}
                              className="p-1.5 text-slate-300 hover:text-red-500 transition-colors"
                              title="Delete Task"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <h3 className={`font-black text-sm mb-2 uppercase tracking-tight leading-snug ${
                      task.status === 'completed' ? 'text-slate-500 line-through' : 'text-slate-800 dark:text-slate-100'
                    }`}>
                      {task.title}
                    </h3>
                    {task.description && (
                      <p className="text-xs text-slate-400 mb-6 line-clamp-3 font-medium leading-relaxed">
                        {task.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-6 border-t border-slate-100 dark:border-slate-800">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black text-blue-600 uppercase">
                          {task.assigneeName.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-tighter">
                            {task.assigneeName}
                          </span>
                          <span className="text-[8px] font-black text-slate-400 uppercase">
                            assigned @ {format(parseISO(task.assignedAt), 'hh:mm a')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isAdmin && task.status === 'completed' && !task.isApproved && !task.isRejected && (
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => handleApproveTask(task.id)}
                              className="bg-green-100 text-green-600 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase hover:bg-green-200 transition-all border border-green-200 flex items-center gap-1"
                            >
                              <CheckCheck size={12} />
                              Approve
                            </button>
                            <button 
                              onClick={() => handleRejectTask(task.id)}
                              className="bg-red-100 text-red-600 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase hover:bg-red-200 transition-all border border-red-200 flex items-center gap-1"
                            >
                              <X size={12} />
                              Reject
                            </button>
                          </div>
                        )}
                        {(task.status === 'pending' || task.status === 'paused') && !isAdmin && (
                          <button 
                            onClick={() => task.status === 'paused' ? handleResumeTask(task) : handleStartTask(task.id)}
                            className="bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none flex items-center gap-2 text-[10px] font-black uppercase"
                            title={task.status === 'paused' ? "Resume Task" : "Start Task"}
                          >
                            <Play size={14} fill="currentColor" />
                            {task.status === 'paused' ? 'Resume' : 'Start'}
                          </button>
                        )}
                        {task.status === 'in-progress' && !isAdmin && (
                          <div className="flex items-center gap-2">
                             <button 
                              onClick={() => handlePauseTask(task.id)}
                              className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-4 py-2.5 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700 flex items-center gap-2 text-[10px] font-black uppercase"
                              title="Pause Task"
                            >
                              <Pause size={14} fill="currentColor" />
                              Pause
                            </button>
                            <button 
                              onClick={() => handleCompleteTask(task)}
                              className="bg-green-600 text-white px-4 py-2.5 rounded-xl hover:bg-green-700 transition-all shadow-lg shadow-green-200 dark:shadow-none flex items-center gap-2 text-[10px] font-black uppercase"
                              title="Submit Task"
                            >
                              <CheckCircle2 size={16} />
                              Submit
                            </button>
                          </div>
                        )}
                        {task.status === 'completed' && (
                          <div className="flex flex-col items-end">
                            <div className="text-[10px] font-black text-green-600 flex items-center gap-1">
                              <Timer size={10} />
                              {task.durationMinutes}m
                            </div>
                            <div className="text-[8px] font-bold text-slate-400">
                              EFFICIENCY
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {(task.startedAt || task.completedAt) && (
                      <div className="mt-4 pt-3 border-t border-slate-50 dark:border-slate-800/50 flex flex-wrap gap-x-4 gap-y-1">
                        {task.startedAt && (
                          <div className="text-[8px] font-bold text-slate-400 uppercase flex items-center gap-1">
                            <Clock size={8} /> Started: {format(parseISO(task.startedAt), 'hh:mm:ss a')}
                          </div>
                        )}
                        {task.completedAt && (
                          <div className="text-[8px] font-bold text-green-500 uppercase flex items-center gap-1">
                            <CheckCircle2 size={8} /> Finished: {format(parseISO(task.completedAt), 'hh:mm:ss a')}
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
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <motion.div 
                    whileHover={{ scale: 1.1, y: -2 }}
                    className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-2xl text-blue-600"
                  >
                    <CheckCircle2 size={24} />
                  </motion.div>
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Completed</span>
                </div>
                <div className="text-3xl font-black text-slate-800 dark:text-slate-100">
                  {analyticsData?.reduce((acc, curr) => acc + curr.completed, 0)}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <motion.div 
                    whileHover={{ scale: 1.1, y: -2 }}
                    className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-2xl text-amber-600"
                  >
                    <Timer size={24} />
                  </motion.div>
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Avg Time</span>
                </div>
                <div className="text-3xl font-black text-slate-800 dark:text-slate-100">
                  {analyticsData?.length ? Math.round(analyticsData.reduce((acc, curr) => acc + curr.avgMinutes, 0) / analyticsData.length) : 0}
                  <span className="text-sm font-bold text-slate-400 ml-2">min</span>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <motion.div 
                    whileHover={{ scale: 1.1, y: -2 }}
                    className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl text-indigo-600"
                  >
                    <Play size={24} />
                  </motion.div>
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">At Work</span>
                </div>
                <div className="text-3xl font-black text-slate-800 dark:text-slate-100">
                  {tasks.filter(t => t.status === 'in-progress').length}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <motion.div 
                    whileHover={{ scale: 1.1, y: -2 }}
                    className="p-3 bg-violet-100 dark:bg-violet-900/30 rounded-2xl text-violet-600"
                  >
                    <Database size={24} />
                  </motion.div>
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Ops Hours</span>
                </div>
                <div className="text-3xl font-black text-slate-800 dark:text-slate-100">
                  {Math.round((analyticsData?.reduce((acc, curr) => acc + curr.totalMinutes, 0) || 0) / 60 * 10) / 10}
                  <span className="text-sm font-bold text-slate-400 ml-2">hrs</span>
                </div>
              </div>
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
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="p-10 pb-4 flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter mb-2">
                    {editingTask ? 'Modify Task' : isAdmin ? 'Assign Team Work' : 'Add Personal Task'}
                  </h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">
                    {editingTask ? 'Updating intelligence parameters' : 'Personnel task management'}
                  </p>
                </div>
                <button 
                  onClick={() => setShowAssignModal(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={handleAssignTask} className="p-10 pt-4 space-y-6">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Task Protocol</label>
                  <input 
                    required
                    type="text" 
                    placeholder="Brief description of work..."
                    value={newTask.title}
                    onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-blue-500/20 rounded-2xl py-4 px-6 text-sm font-bold focus:ring-4 focus:ring-blue-500/5 transition-all outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {isAdmin && (
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Assignees (Multi-select)</label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-48 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-800">
                        {assignableUsers.map(u => (
                          <label key={u.id} className="flex items-center gap-2 p-2 rounded-xl hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer group">
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
                              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500/20"
                            />
                            <div className="flex flex-col">
                              <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase truncate">
                                {u.displayName}
                              </span>
                              <span className="text-[8px] font-bold text-slate-400 uppercase">
                                {u.email.split('@')[0]}
                              </span>
                            </div>
                          </label>
                        ))}
                      </div>
                      {newTask.assigneeIds.length === 0 && (
                        <p className="text-[9px] text-red-500 font-bold mt-1 ml-1 uppercase">Please select at least one agent</p>
                      )}
                    </div>
                  )}
                  
                  <div className={newTask.isEveryday ? 'opacity-30 pointer-events-none' : ''}>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Schedule Date</label>
                    <input 
                      type="date" 
                      disabled={newTask.isEveryday}
                      value={newTask.scheduledDate}
                      onChange={e => setNewTask({ ...newTask, scheduledDate: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-blue-500/20 rounded-2xl py-4 px-6 text-sm font-bold focus:ring-4 focus:ring-blue-500/5 transition-all outline-none"
                    />
                  </div>
                  
                  <div className="flex flex-col justify-end">
                    <label className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors h-full">
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
                        className="w-4 h-4 rounded-lg text-blue-600 focus:ring-blue-500/20"
                      />
                      <span className="text-[10px] font-black text-slate-700 dark:text-slate-300 uppercase tracking-widest">Daily Task</span>
                    </label>
                  </div>
                </div>

                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Display Order</label>
                   <input 
                      type="number" 
                      min="1"
                      value={newTask.order}
                      onChange={e => setNewTask({ ...newTask, order: parseInt(e.target.value) || 1 })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-blue-500/20 rounded-2xl py-4 px-6 text-sm font-bold focus:ring-4 focus:ring-blue-500/5 transition-all outline-none"
                    />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Detailed Intel (Optional)</label>
                  <textarea 
                    placeholder="Specific parameters for execution..."
                    value={newTask.description}
                    onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                    className="w-full bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-blue-500/20 rounded-2xl py-4 px-6 text-sm font-bold focus:ring-4 focus:ring-blue-500/5 transition-all outline-none h-32 resize-none"
                  />
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setShowAssignModal(false)}
                    className="flex-1 bg-slate-100 dark:bg-slate-800 text-slate-500 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-colors hover:bg-slate-200"
                  >
                    Cancel
                  </button>
                  <button 
                    disabled={isSubmitting}
                    className="flex-1 bg-blue-600 text-white py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:bg-blue-700 shadow-xl shadow-blue-200 dark:shadow-none disabled:opacity-50"
                  >
                    {isSubmitting ? 'Processing...' : editingTask ? 'Update Task' : 'Authorize Task'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
