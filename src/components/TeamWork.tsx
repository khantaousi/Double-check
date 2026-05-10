import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, TeamTask } from '../types';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, query, where, onSnapshot, updateDoc, doc, deleteDoc, orderBy, getDocs, writeBatch } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/errors';
import { CheckCircle2, Clock, Plus, UserPlus, Trash2, Calendar, Layout, User, Play, BarChart3, TrendingUp, Timer, Database, Edit, CheckCheck, X } from 'lucide-react';
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
  const [view, setView] = useState<'list' | 'analytics'>('list');
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assigneeId: '',
    order: 1,
    isEveryday: false,
    scheduledDate: format(new Date(), 'yyyy-MM-dd')
  });
  const [dateFilter, setDateFilter] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTask, setEditingTask] = useState<TeamTask | null>(null);

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

    // Cleanup logic: Auto-remove tasks older than 30 days (excluding everyday tasks)
    if (isAdmin) {
      const cleanupOldTasks = async () => {
        const thirtyDaysAgo = subDays(new Date(), 30);
        const oldQuery = query(
          collection(db, 'tasks'), 
          where('assignedAt', '<', thirtyDaysAgo.toISOString()),
          where('isEveryday', '==', false)
        );
        const oldDocs = await getDocs(oldQuery);
        if (!oldDocs.empty) {
          const batch = writeBatch(db);
          oldDocs.docs.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      };
      cleanupOldTasks();
    }

    return () => unsubscribe();
  }, [isAdmin]);

  const handleOpenEditModal = (task: TeamTask) => {
    setEditingTask(task);
    setNewTask({
      title: task.title,
      description: task.description || '',
      assigneeId: task.assigneeId,
      order: task.order || 1,
      isEveryday: task.isEveryday || false,
      scheduledDate: format(parseISO(task.assignedAt), 'yyyy-MM-dd')
    });
    setShowAssignModal(true);
  };

  const handleAssignTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title || (!isAdmin && !auth.currentUser?.uid) || (isAdmin && !newTask.assigneeId)) return;

    setIsSubmitting(true);
    try {
      const selectedUser = isAdmin ? allUsers.find(u => u.id === newTask.assigneeId) : userProfile;
      const scheduledDateTime = new Date(newTask.scheduledDate);
      const now = new Date();
      
      // If daily, we use current time but mark as everyday
      // If custom date, we use that date
      if (format(scheduledDateTime, 'yyyy-MM-dd') !== format(now, 'yyyy-MM-dd')) {
        scheduledDateTime.setHours(9, 0, 0, 0);
      }

      const taskData: any = {
        title: newTask.title,
        description: newTask.description,
        assigneeId: isAdmin ? newTask.assigneeId : (auth.currentUser?.uid || ''),
        assigneeName: selectedUser?.displayName || 'Unknown',
        status: 'pending',
        assignedAt: newTask.isEveryday ? now.toISOString() : scheduledDateTime.toISOString(),
        createdBy: auth.currentUser?.uid,
        order: newTask.order,
        isEveryday: newTask.isEveryday || false,
      };

      // Self-assignment logic
      if (!isAdmin) {
        taskData.isSelfAssigned = true;
        taskData.isApproved = false;
      }

      if (editingTask) {
        try {
          await updateDoc(doc(db, 'tasks', editingTask.id), {
            ...taskData,
            updatedAt: now.toISOString()
          });
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `tasks/${editingTask.id}`);
        }
      } else {
        try {
          await addDoc(collection(db, 'tasks'), taskData);
        } catch (error) {
          handleFirestoreError(error, OperationType.CREATE, 'tasks');
        }
      }

      setNewTask({ 
        title: '', 
        description: '', 
        assigneeId: '', 
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

  const handleCompleteTask = async (task: TeamTask) => {
    const now = new Date();
    const startTimeStr = task.startedAt || task.assignedAt;
    const duration = differenceInMinutes(now, parseISO(startTimeStr));

    try {
      await updateDoc(doc(db, 'tasks', task.id), {
        status: 'completed',
        completedAt: now.toISOString(),
        durationMinutes: duration
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
    if (isAdmin) {
      list = tasks.filter(t => 
        t.isEveryday || format(parseISO(t.assignedAt), 'yyyy-MM-dd') === dateFilter
      );
    } else {
      // Users see their tasks for today, pending tasks from past, or everyday tasks
      const today = format(new Date(), 'yyyy-MM-dd');
      list = tasks.filter(t => 
        t.isEveryday ||
        t.status !== 'completed' || 
        format(parseISO(t.assignedAt), 'yyyy-MM-dd') === today
      );
    }

    // Sort by order asc, then by assignedAt desc
    return list.sort((a, b) => {
      const orderA = a.order ?? 999;
      const orderB = b.order ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime();
    });
  }, [tasks, isAdmin, dateFilter]);

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
      if (statsDateRange === '30days') return true; // We already clean up older than 30 days
      if (statsDateRange === 'custom') {
        return taskDate >= customStatsStart && taskDate <= customStatsEnd;
      }
      return true;
    });

    const userStatsMap = new Map<string, { name: string, completed: number, avgMinutes: number, totalMinutes: number }>();
    
    filteredForStats.forEach(task => {
      // Only count completed tasks
      // All completed tasks MUST be approved to show in stats
      const isCountable = task.status === 'completed' && 
                        task.durationMinutes !== undefined &&
                        task.isApproved === true;

      if (isCountable) {
        const stats = userStatsMap.get(task.assigneeId) || { name: task.assigneeName, completed: 0, avgMinutes: 0, totalMinutes: 0 };
        stats.completed += 1;
        stats.totalMinutes += task.durationMinutes;
        stats.avgMinutes = Math.round(stats.totalMinutes / stats.completed);
        userStatsMap.set(task.assigneeId, stats);
      }
    });

    return Array.from(userStatsMap.values()).sort((a, b) => b.completed - a.completed);
  }, [tasks, isAdmin, statsDateRange, customStatsStart, customStatsEnd]);

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
                onClick={() => setView('analytics')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${view === 'analytics' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500'}`}
              >
                Stats
              </button>
            </div>
          )}
          
          {((isAdmin && view === 'list') || !isAdmin) && (
            <div className="flex items-center gap-2">
              {isAdmin && (
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                  <input 
                    type="date" 
                    value={dateFilter}
                    onChange={(e) => setDateFilter(e.target.value)}
                    className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl py-2 pl-9 pr-4 text-xs font-bold focus:ring-2 focus:ring-blue-500/20 outline-none"
                  />
                </div>
              )}
              <button 
                onClick={() => {
                  setEditingTask(null);
                  setNewTask({
                    title: '',
                    description: '',
                    assigneeId: isAdmin ? '' : (auth.currentUser?.uid || ''),
                    order: 1,
                    isEveryday: false,
                    scheduledDate: format(new Date(), 'yyyy-MM-dd')
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
                    className={`p-6 rounded-[2rem] border transition-all relative overflow-hidden ${
                      task.status === 'completed' 
                        ? 'bg-slate-50/50 dark:bg-slate-800/30 border-slate-100 dark:border-slate-800 opacity-80' 
                        : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-xl shadow-slate-100/50 dark:shadow-none'
                    }`}
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex flex-col gap-1">
                        <div className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 w-fit ${
                          task.isRejected ? 'bg-red-100 text-red-600' :
                          task.status === 'completed' ? (task.isApproved ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-600') : 
                          task.status === 'in-progress' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            task.isRejected ? 'bg-red-500' :
                            task.status === 'completed' ? (task.isApproved ? 'bg-green-500' : 'bg-slate-400') : 
                            task.status === 'in-progress' ? 'bg-amber-500 animate-pulse' : 'bg-blue-500'
                          }`} />
                          {task.isRejected ? 'Rejected' : 
                           task.status === 'completed' ? (task.isApproved ? 'Completed & Approved' : 'Pending Approval') : 
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
                        {task.status === 'pending' && !isAdmin && (
                          <button 
                            onClick={() => handleStartTask(task.id)}
                            className="bg-blue-600 text-white px-4 py-2.5 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 dark:shadow-none flex items-center gap-2 text-[10px] font-black uppercase"
                            title="Start Task"
                          >
                            <Play size={14} fill="currentColor" />
                            Start
                          </button>
                        )}
                        {task.status === 'in-progress' && !isAdmin && (
                          <button 
                            onClick={() => handleCompleteTask(task)}
                            className="bg-green-600 text-white px-4 py-2.5 rounded-xl hover:bg-green-700 transition-all shadow-lg shadow-green-200 dark:shadow-none flex items-center gap-2 text-[10px] font-black uppercase"
                            title="Submit Task"
                          >
                            <CheckCircle2 size={16} />
                            Submit
                          </button>
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
            key="analytics"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="space-y-6"
          >
            {/* Stats Filters */}
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

            {/* Top Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-2xl text-blue-600">
                    <CheckCircle2 size={24} />
                  </div>
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Completed</span>
                </div>
                <div className="text-3xl font-black text-slate-800 dark:text-slate-100">
                  {analyticsData?.reduce((acc, curr) => acc + curr.completed, 0)}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-amber-100 dark:bg-amber-900/30 rounded-2xl text-amber-600">
                    <Timer size={24} />
                  </div>
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Avg Time</span>
                </div>
                <div className="text-3xl font-black text-slate-800 dark:text-slate-100">
                  {analyticsData?.length ? Math.round(analyticsData.reduce((acc, curr) => acc + curr.avgMinutes, 0) / analyticsData.length) : 0}
                  <span className="text-sm font-bold text-slate-400 ml-2">min</span>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-2xl text-indigo-600">
                    <Play size={24} />
                  </div>
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">At Work</span>
                </div>
                <div className="text-3xl font-black text-slate-800 dark:text-slate-100">
                  {tasks.filter(t => t.status === 'in-progress').length}
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2rem] p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 bg-violet-100 dark:bg-violet-900/30 rounded-2xl text-violet-600">
                    <Database size={24} />
                  </div>
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
                    <div key={staff.name} className="flex items-center justify-between">
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
                      <div className="text-right">
                        <p className="text-xs font-black text-blue-600">{staff.avgMinutes}m</p>
                        <p className="text-[8px] font-bold text-slate-400 uppercase italic">AVG TIME</p>
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
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 px-1">Assignee</label>
                      <select 
                        required
                        value={newTask.assigneeId}
                        onChange={e => setNewTask({ ...newTask, assigneeId: e.target.value })}
                        className="w-full bg-slate-50 dark:bg-slate-800 border border-transparent focus:border-blue-500/20 rounded-2xl py-4 px-6 text-sm font-bold focus:ring-4 focus:ring-blue-500/5 transition-all outline-none appearance-none"
                      >
                        <option value="">Select Staff Member</option>
                        {assignableUsers.map(u => (
                          <option key={u.id} value={u.id}>{u.displayName} ({u.email.split('@')[0]})</option>
                        ))}
                      </select>
                    </div>
                  )}
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
