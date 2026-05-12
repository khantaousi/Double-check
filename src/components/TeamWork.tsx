import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, TeamTask, WorkCategory } from '../types';
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
  const [categories, setCategories] = useState<WorkCategory[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [view, setView] = useState<'list' | 'report'>('list');
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assigneeIds: [] as string[],
    category: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    dueDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [newCategory, setNewCategory] = useState({
    name: '',
    description: '',
    color: '#3b82f6'
  });
  const [boardDateRange, setBoardDateRange] = useState<'today' | 'yesterday' | '30days' | 'custom'>('today');
  const [boardCustomStart, setBoardCustomStart] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [boardCustomEnd, setBoardCustomEnd] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTask, setEditingTask] = useState<TeamTask | null>(null);

  const isAdmin = userProfile.role === 'admin';

  useEffect(() => {
    // Current user context
    const currentUid = auth.currentUser?.uid;
    if (!currentUid) return;

    // Sync categories
    const qCat = query(collection(db, 'categories'), orderBy('createdAt', 'desc'));
    const unsubCat = onSnapshot(qCat, (snapshot) => {
      setCategories(snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as WorkCategory[]);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'categories');
    });

    // Sync tasks
    let q;
    if (isAdmin) {
      q = query(collection(db, 'tasks'), orderBy('assignedAt', 'desc'));
    } else {
      q = query(
        collection(db, 'tasks'), 
        where('assigneeIds', 'array-contains', currentUid),
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
      assigneeIds: task.assigneeIds || [],
      category: task.category || '',
      priority: task.priority || 'medium',
      dueDate: task.dueDate ? format(parseISO(task.dueDate), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')
    });
    setShowAssignModal(true);
  };

  const handleAssignTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title || (!isAdmin && !auth.currentUser?.uid) || (isAdmin && newTask.assigneeIds.length === 0)) return;

    setIsSubmitting(true);
    try {
      const selectedUsers = allUsers.filter(u => newTask.assigneeIds.includes(u.id));
      const now = new Date();
      
      const taskData: any = {
        title: newTask.title,
        description: newTask.description,
        assigneeIds: isAdmin ? newTask.assigneeIds : [auth.currentUser?.uid || ''],
        assigneeNames: isAdmin ? selectedUsers.map(u => u.displayName || 'Unknown') : [userProfile.displayName || 'Unknown'],
        status: 'pending',
        category: newTask.category,
        priority: newTask.priority,
        assignedAt: now.toISOString(),
        dueDate: newTask.dueDate ? new Date(newTask.dueDate).toISOString() : null,
        createdBy: auth.currentUser?.uid,
        updatedAt: now.toISOString()
      };

      if (editingTask) {
        await updateDoc(doc(db, 'tasks', editingTask.id), taskData);
      } else {
        await addDoc(collection(db, 'tasks'), taskData);
      }

      setNewTask({ 
        title: '', 
        description: '', 
        assigneeIds: [],
        category: '',
        priority: 'medium',
        dueDate: format(new Date(), 'yyyy-MM-dd')
      });
      setEditingTask(null);
      setShowAssignModal(false);
    } catch (error) {
      console.error("Error saving task:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategory.name || !isAdmin) return;
    try {
      await addDoc(collection(db, 'categories'), {
        ...newCategory,
        createdAt: new Date().toISOString()
      });
      setNewCategory({ name: '', description: '', color: '#3b82f6' });
      setShowCategoryModal(false);
    } catch (error) {
      console.error("Category creation error:", error);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!isAdmin || !window.confirm("Delete this category?")) return;
    try {
      await deleteDoc(doc(db, 'categories', id));
    } catch (error) {
      console.error("Category delete error:", error);
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

    // Sort by order asc, then by assignedAt desc
    return list.sort((a, b) => {
      const orderA = a.order ?? 999;
      const orderB = b.order ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime();
    });
  }, [tasks, isAdmin, boardDateRange, boardCustomStart, boardCustomEnd]);

  // Analytics Calculations
  const [statsDateRange, setStatsDateRange] = useState<'today' | 'yesterday' | '30days' | 'custom'>('30days');
  const [customStatsStart, setCustomStatsStart] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [customStatsEnd, setCustomStatsEnd] = useState(format(new Date(), 'yyyy-MM-dd'));

  const analyticsData = useMemo(() => {
    if (!isAdmin) return null;

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
      const isCountable = task.status === 'completed' && 
                        task.isApproved === true;

      if (isCountable) {
        task.assigneeIds.forEach((uid, index) => {
          const name = task.assigneeNames[index] || 'Unknown';
          const stats = userStatsMap.get(uid) || { name, completed: 0, avgMinutes: 0, totalMinutes: 0, totalPause: 0, taskIds: [] };
          stats.completed += 1;
          // In multi-assignee, we might want to attribute full time to each or split it
          // For simplicity, attributing full time to each participant
          // stats.totalMinutes += task.durationMinutes || 0; 
          stats.taskIds.push(task.id);
          userStatsMap.set(uid, stats);
        });
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-slate-100 flex items-center gap-3">
            <Layout className="text-blue-600" />
            TEAM PERFORMANCE
          </h2>
          <p className="text-slate-500 text-sm font-medium">
            {isAdmin ? 'System assignments and efficiency reporting' : 'Your current workload and tasks'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl mr-2">
              <button 
                onClick={() => setView('list')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${view === 'list' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500'}`}
              >
                Board
              </button>
              <button 
                onClick={() => setView('report')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${view === 'report' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500'}`}
              >
                Report
              </button>
            </div>
          )}
          
          {((isAdmin && view === 'list') || !isAdmin) && (
            <div className="flex items-center gap-4">
              {isAdmin && view === 'list' && (
                <div className="flex items-center gap-4">
                  <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
                    {(['today', 'yesterday', '30days', 'custom'] as const).map(range => (
                      <button
                        key={range}
                        onClick={() => setBoardDateRange(range)}
                        className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${
                          boardDateRange === range ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {range === '30days' ? 'Last 30D' : range}
                      </button>
                    ))}
                  </div>

                  {boardDateRange === 'custom' && (
                    <motion.div 
                      initial={{ opacity: 0, x: -10 }} 
                      animate={{ opacity: 1, x: 0 }}
                      className="flex items-center gap-2"
                    >
                      <input 
                        type="date" 
                        value={boardCustomStart}
                        onChange={(e) => setBoardCustomStart(e.target.value)}
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-1.5 px-3 text-[10px] font-bold outline-none"
                      />
                      <span className="text-slate-400 text-[10px] font-black uppercase">To</span>
                      <input 
                        type="date" 
                        value={boardCustomEnd}
                        onChange={(e) => setBoardCustomEnd(e.target.value)}
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg py-1.5 px-3 text-[10px] font-bold outline-none"
                      />
                    </motion.div>
                  )}
                </div>
              )}
              {isAdmin && view === 'list' && (
                <button 
                  onClick={() => setShowCategoryModal(true)}
                  className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-slate-200 transition-all shadow-sm whitespace-nowrap"
                >
                  <Database size={16} />
                  Work Types
                </button>
              )}
              <button 
                onClick={() => {
                  setEditingTask(null);
                  setNewTask({
                    title: '',
                    description: '',
                    assigneeIds: isAdmin ? [] : [auth.currentUser?.uid || ''],
                    category: '',
                    priority: 'medium',
                    dueDate: format(new Date(), 'yyyy-MM-dd')
                  });
                  setShowAssignModal(true);
                }}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 dark:shadow-none whitespace-nowrap"
              >
                <Plus size={16} />
                {isAdmin ? 'Assign Work' : 'Add Task'}
              </button>
            </div>
          )}
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
                          'bg-blue-100 text-blue-600'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            task.isRejected ? 'bg-red-500' :
                            task.status === 'completed' ? (task.isApproved ? 'bg-green-500' : 'bg-slate-400') : 
                            task.status === 'in-progress' ? 'bg-amber-500 animate-pulse' : 
                            'bg-blue-500'
                          }`} />
                          {task.isRejected ? 'Rejected' : 
                           task.status === 'completed' ? (task.isApproved ? 'Completed' : 'Submitted') : 
                           task.status}
                        </div>
                        {task.category && (
                          <div className="text-[10px] font-black text-blue-600 uppercase tracking-tighter pl-1 flex items-center gap-1">
                            <Database size={10} />
                            {task.category}
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
                      <div className="flex items-center">
                        {task.assigneeNames.map((name, i) => (
                          <div 
                            key={i} 
                            className={`w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[10px] font-black text-blue-600 uppercase -ml-2 first:ml-0`}
                            title={name}
                          >
                            {name.charAt(0)}
                          </div>
                        ))}
                        <div className="ml-3 flex flex-col">
                          <span className="text-[10px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-tighter">
                            {task.assigneeNames.length} {task.assigneeNames.length > 1 ? 'Agents' : 'Agent'}
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
                  Efficiency Comparison By Staff
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
                  Rankings
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

                <div className="grid grid-cols-2 gap-4">
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
                    <label className="flex items-center gap-3 bg-slate-50 dark:bg-slate-800 p-4 rounded-2xl cursor-pointer hover:bg-slate-100 transition-colors">
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

                <div className="grid grid-cols-2 gap-4">
                  {isAdmin && (
                    <div className="col-span-2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Multiple Assignees</label>
                      <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                        {assignableUsers.map(u => (
                          <label key={u.id} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-white dark:hover:bg-slate-700 transition-colors">
                            <input 
                              type="checkbox"
                              checked={newTask.assigneeIds.includes(u.id)}
                              onChange={e => {
                                if (e.target.checked) {
                                  setNewTask({ ...newTask, assigneeIds: [...newTask.assigneeIds, u.id] });
                                } else {
                                  setNewTask({ ...newTask, assigneeIds: newTask.assigneeIds.filter(id => id !== u.id) });
                                }
                              }}
                              className="w-4 h-4 rounded text-blue-600"
                            />
                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase truncate">
                              {u.displayName}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Work Type</label>
                    <select 
                      value={newTask.category}
                      onChange={e => setNewTask({ ...newTask, category: e.target.value })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-blue-500/20 rounded-2xl py-4 px-6 text-sm font-bold focus:ring-4 focus:ring-blue-500/5 transition-all outline-none appearance-none"
                    >
                      <option value="">No Category</option>
                      {categories.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Priority Level</label>
                    <select 
                      value={newTask.priority}
                      onChange={e => setNewTask({ ...newTask, priority: e.target.value as any })}
                      className="w-full bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-blue-500/20 rounded-2xl py-4 px-6 text-sm font-bold focus:ring-4 focus:ring-blue-500/5 transition-all outline-none appearance-none"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
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

      {/* Category Manager Modal */}
      <AnimatePresence>
        {showCategoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCategoryModal(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[3rem] shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="p-10 pb-4 flex justify-between items-start">
                <div>
                  <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 uppercase tracking-tighter mb-2">Work Categories</h3>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Define standard work types for the team</p>
                </div>
                <button onClick={() => setShowCategoryModal(false)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <X size={24} />
                </button>
              </div>

              <div className="p-10 pt-4 space-y-8 overflow-y-auto max-h-[70vh]">
                <form onSubmit={handleCreateCategory} className="bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Name</label>
                      <input 
                        required
                        type="text" 
                        value={newCategory.name}
                        onChange={e => setNewCategory({ ...newCategory, name: e.target.value })}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl py-3 px-4 text-xs font-bold"
                        placeholder="e.g., Development"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase mb-2">Color</label>
                      <input 
                        type="color" 
                        value={newCategory.color}
                        onChange={e => setNewCategory({ ...newCategory, color: e.target.value })}
                        className="w-full h-10 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl px-1 py-1"
                      />
                    </div>
                  </div>
                  <button className="w-full bg-blue-600 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-700">
                    Add Work Type
                  </button>
                </form>

                <div className="space-y-3">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Existing Types</label>
                  {categories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between p-4 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl group transition-all hover:border-slate-300">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: cat.color }} />
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase">{cat.name}</span>
                      </div>
                      <button 
                        onClick={() => handleDeleteCategory(cat.id)}
                        className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
