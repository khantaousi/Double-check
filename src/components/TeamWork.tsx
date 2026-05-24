import React, { useState, useEffect, useMemo } from 'react';
import { UserProfile, TeamTask } from '../types';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, query, where, onSnapshot, updateDoc, doc, deleteDoc, orderBy, getDocs, writeBatch } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../lib/errors';
import { cleanObject, getBSTISOString, formatBST } from '../lib/utils';
import { CheckCircle2, Clock, Plus, UserPlus, Trash2, Calendar, Layout, User, Play, Pause, BarChart3, TrendingUp, Timer, Database, Edit, CheckCheck, X, Bell, ChevronDown, ChevronUp, History, Download, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, differenceInMinutes, parseISO, subDays } from 'date-fns';
import { TaskHistoryEntry, AppNotification } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { generateRankingsExcel } from '../lib/excel';
import { LiveTenureTracker } from './LiveTenureTracker';

interface TeamWorkProps {
  userProfile: UserProfile;
  allUsers: UserProfile[];
}

export const TeamWork: React.FC<TeamWorkProps> = ({ userProfile, allUsers }) => {
  const [tasks, setTasks] = useState<TeamTask[]>([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [view, setView] = useState<'list' | 'report'>('list');
  const [showFilters, setShowFilters] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    assigneeIds: [] as string[],
    order: 1,
    isEveryday: false,
    scheduledDate: formatBST(new Date(), 'yyyy-MM-dd')
  });
  const [boardDateRange, setBoardDateRange] = useState<'today' | 'yesterday' | '30days' | 'custom'>('today');
  const [boardCustomStart, setBoardCustomStart] = useState(formatBST(new Date(), 'yyyy-MM-dd'));
  const [boardCustomEnd, setBoardCustomEnd] = useState(formatBST(new Date(), 'yyyy-MM-dd'));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingTask, setEditingTask] = useState<TeamTask | null>(null);

  const [statusFilter, setStatusFilter] = useState<'all' | TeamTask['status'] | 'needs-verification'>('all');
  const [selectedBoardAgentId, setSelectedBoardAgentId] = useState<string>('all');
  const [selectedReportAgentId, setSelectedReportAgentId] = useState<string>('all');
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const isAdmin = userProfile?.role === 'admin';
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    // Session tracking subscription
    return onSnapshot(collection(db, 'sessions'), (snapshot) => {
      setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      const errText = error instanceof Error ? error.message : String(error);
      if (errText.includes('Quota limit exceeded') || errText.includes('quota')) {
        console.warn('TeamWork sessions: Quota Exceeded. Skipping log.');
      } else {
        console.error("TeamWork sessions error:", error);
      }
    });
  }, []);

  const formatDurationHelper = (totalSecs: number) => {
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;
    return `${hours} hour, ${minutes} Minute, ${secs} Second`;
  };

  useEffect(() => {
    if (!auth.currentUser?.uid) return;
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('createdAt', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AppNotification[]);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'notifications');
    });
  }, []);

  const sendNotification = async (notif: Omit<AppNotification, 'id' | 'isRead' | 'createdAt'>) => {
    try {
      await addDoc(collection(db, 'notifications'), cleanObject({
        ...notif,
        isRead: false,
        createdAt: getBSTISOString()
      }));
    } catch (error) {
      console.error("Error sending notification:", error);
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.isRead);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    unread.forEach(n => {
      if (n.id) batch.update(doc(db, 'notifications', n.id), { isRead: true });
    });
    await batch.commit();
  };

  const createHistoryEntry = (status: TaskHistoryEntry['status'], note?: string): TaskHistoryEntry => ({
    status,
    timestamp: getBSTISOString(),
    performerId: auth.currentUser?.uid || 'system',
    performerName: userProfile.displayName || 'System',
    note
  });

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
      handleFirestoreError(error, OperationType.LIST, 'tasks');
    });

    return () => unsubscribe();
  }, [isAdmin]);

  const [purgeStartDate, setPurgeStartDate] = useState(formatBST(subDays(new Date(), 90), 'yyyy-MM-dd'));
  const [purgeEndDate, setPurgeEndDate] = useState(formatBST(subDays(new Date(), 30), 'yyyy-MM-dd'));
  const [isPurging, setIsPurging] = useState(false);
  const [editIsApproved, setEditIsApproved] = useState(false);
  const [editIsRejected, setEditIsRejected] = useState(false);

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
        where('assignedAt', '>=', getBSTISOString(startISO)),
        where('assignedAt', '<=', getBSTISOString(endISO))
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
    setEditIsApproved(task.isApproved || false);
    setEditIsRejected(task.isRejected || false);
    setNewTask({
      title: task.title,
      description: task.description || '',
      assigneeIds: [task.assigneeId],
      order: task.order || 1,
      isEveryday: task.isEveryday || false,
      scheduledDate: formatBST(parseISO(task.assignedAt), 'yyyy-MM-dd')
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
      if (formatBST(scheduledDateTime, 'yyyy-MM-dd') !== formatBST(now, 'yyyy-MM-dd')) {
        scheduledDateTime.setHours(9, 0, 0, 0);
      }

      if (editingTask) {
        // Edit is always single task
        const selectedUser = allUsers.find(u => u.id === effectiveAssigneeIds[0]) || userProfile;
        const newHistory = [...(editingTask.history || []), createHistoryEntry('created', 'Task Protocol Updated')];
        const taskData = cleanObject({
          title: newTask.title || '',
          description: newTask.description || '',
          assigneeId: effectiveAssigneeIds[0],
          assigneeName: selectedUser.displayName || 'Unknown',
          assignedAt: newTask.isEveryday ? (editingTask.assignedAt || getBSTISOString(now)) : getBSTISOString(scheduledDateTime),
          order: newTask.order || 0,
          isEveryday: newTask.isEveryday || false,
          isApproved: isAdmin && editingTask.status === 'completed' ? editIsApproved : editingTask.isApproved,
          isRejected: isAdmin && editingTask.status === 'completed' ? editIsRejected : editingTask.isRejected,
          updatedAt: getBSTISOString(now),
          history: newHistory
        });

        if (isAdmin && editingTask.status === 'completed') {
          if (editIsApproved && !editingTask.isApproved) {
            taskData.approvedAt = getBSTISOString(now);
            taskData.approvedBy = userProfile.name;
          }
          if (editIsRejected && !editingTask.isRejected) {
            taskData.rejectedAt = getBSTISOString(now);
            taskData.rejectedBy = userProfile.name;
          }
        }
        
        try {
          await updateDoc(doc(db, 'tasks', editingTask.id), cleanObject(taskData));
          if (editingTask.assigneeId !== effectiveAssigneeIds[0]) {
            sendNotification({
              userId: effectiveAssigneeIds[0],
              title: 'New Task Protocol',
              message: `You have been assigned a new protocol: ${newTask.title}`,
              type: 'task_assigned',
              taskId: editingTask.id
            });
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `tasks/${editingTask.id}`);
        }
      } else {
        // Creation can be multiple
        const batch = writeBatch(db);
        
        effectiveAssigneeIds.forEach(uid => {
          const selectedUser = allUsers.find(u => u.id === uid) || userProfile;
          const taskId = doc(collection(db, 'tasks')).id;
          const taskData = cleanObject({
            title: newTask.title || '',
            description: newTask.description || '',
            assigneeId: uid,
            assigneeName: selectedUser.displayName || 'Unknown',
            status: 'pending',
            assignedAt: newTask.isEveryday ? getBSTISOString(now) : getBSTISOString(scheduledDateTime),
            createdBy: auth.currentUser?.uid || 'system',
            order: newTask.order || 0,
            isEveryday: newTask.isEveryday || false,
            history: [createHistoryEntry('created')]
          });

          if (!isAdmin) {
            taskData.isSelfAssigned = true;
            taskData.isApproved = false;
          }

          batch.set(doc(db, 'tasks', taskId), cleanObject(taskData));

          // Notifications
          if (isAdmin) {
            sendNotification({
              userId: uid,
              title: 'New Unit Assignment',
              message: `New mission protocol assigned: ${newTask.title}`,
              type: 'task_assigned',
              taskId: taskId
            });
          }
        });

        await batch.commit();
      }

      setNewTask({ 
        title: '', 
        description: '', 
        assigneeIds: [], 
        order: (newTask.order || 0) + 1,
        isEveryday: false,
        scheduledDate: formatBST(new Date(), 'yyyy-MM-dd')
      });
      setEditingTask(null);
      setShowAssignModal(false);
    } catch (error) {
      console.error("Error saving task:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveTask = async (task: TeamTask) => {
    try {
      const now = new Date();
      const newHistory = [...(task.history || []), createHistoryEntry('approved')];
      await updateDoc(doc(db, 'tasks', task.id), cleanObject({
        isApproved: true,
        isRejected: false,
        approvedBy: auth.currentUser?.uid || 'admin',
        approvedAt: getBSTISOString(now),
        updatedAt: getBSTISOString(now),
        history: newHistory
      }));
      // Notify Agent
      sendNotification({
        userId: task.assigneeId,
        title: 'Task Verified',
        message: `Your protocol "${task.title}" has been verified and approved.`,
        type: 'task_approved',
        taskId: task.id
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${task.id}`);
    }
  };

  const handleRejectTask = async (task: TeamTask) => {
    if (!window.confirm("Are you sure you want to reject this task?")) return;
    try {
      const now = new Date();
      const newHistory = [...(task.history || []), createHistoryEntry('rejected')];
      await updateDoc(doc(db, 'tasks', task.id), cleanObject({
        isRejected: true,
        isApproved: false,
        rejectedBy: auth.currentUser?.uid || 'admin',
        rejectedAt: getBSTISOString(now),
        updatedAt: getBSTISOString(now),
        history: newHistory
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${task.id}`);
    }
  };

  const handleStartTask = async (task: TeamTask) => {
    try {
      const now = new Date();
      const newHistory = [...(task.history || []), createHistoryEntry('in-progress')];
      await updateDoc(doc(db, 'tasks', task.id), cleanObject({
        status: 'in-progress',
        startedAt: getBSTISOString(now),
        updatedAt: getBSTISOString(now),
        history: newHistory
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${task.id}`);
    }
  };

  const handlePauseTask = async (task: TeamTask) => {
    try {
      const now = new Date();
      const newHistory = [...(task.history || []), createHistoryEntry('paused')];
      await updateDoc(doc(db, 'tasks', task.id), cleanObject({
        status: 'paused',
        lastPausedAt: getBSTISOString(now),
        updatedAt: getBSTISOString(now),
        history: newHistory
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${task.id}`);
    }
  };

  const handleResumeTask = async (task: TeamTask) => {
    try {
      const now = new Date();
      const pauseDuration = task.lastPausedAt ? differenceInMinutes(now, parseISO(task.lastPausedAt)) : 0;
      const totalPause = (task.totalPauseMinutes || 0) + pauseDuration;
      const newHistory = [...(task.history || []), createHistoryEntry('in-progress', `Resumed after ${pauseDuration}m pause`)];

      await updateDoc(doc(db, 'tasks', task.id), cleanObject({
        status: 'in-progress',
        resumedAt: getBSTISOString(now),
        totalPauseMinutes: totalPause,
        updatedAt: getBSTISOString(now),
        history: newHistory
      }));
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${task.id}`);
    }
  };

  const handleCompleteTask = async (task: TeamTask) => {
    const now = new Date();
    const startTimeStr = task.startedAt || task.assignedAt;
    const rawDuration = differenceInMinutes(now, parseISO(startTimeStr));
    const effectiveDuration = Math.max(0, rawDuration - (task.totalPauseMinutes || 0));
    const newHistory = [...(task.history || []), createHistoryEntry('completed')];

    try {
      await updateDoc(doc(db, 'tasks', task.id), cleanObject({
        status: 'completed',
        completedAt: getBSTISOString(now),
        durationMinutes: effectiveDuration,
        updatedAt: getBSTISOString(now),
        history: newHistory
      }));

      // Notify Admins
      if (task.isSelfAssigned) {
        allUsers.filter(u => u.role === 'admin').forEach(admin => {
          if (admin.id) {
            sendNotification({
              userId: admin.id,
              title: 'Critical: Approval Required',
              message: `User ${task.assigneeName} completed self-assigned task: ${task.title}`,
              type: 'task_needs_approval',
              taskId: task.id
            });
          }
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `tasks/${task.id}`);
    }
  };

  const handleResentTask = async (task: TeamTask) => {
    if (!window.confirm("Are you sure you want to resend this task to the user for correction?")) return;
    try {
      const now = new Date();
      const newHistory = [...(task.history || []), createHistoryEntry('resent', 'Task sent back to user for correction')];
      
      // Revert to paused state so user can resume when ready
      await updateDoc(doc(db, 'tasks', task.id), cleanObject({
        status: 'paused',
        completedAt: null,
        durationMinutes: null,
        isApproved: false,
        isRejected: false,
        lastPausedAt: getBSTISOString(now),
        updatedAt: getBSTISOString(now),
        history: newHistory
      }));

      sendNotification({
        userId: task.assigneeId,
        title: 'Task Resent',
        message: `Your protocol "${task.title}" has been sent back for correction.`,
        type: 'task_resent',
        taskId: task.id
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

  // Maintenance: Reset daily tasks for a new day and archive completions
  // Also auto-submits any tasks started but not completed yesterday
  useEffect(() => {
    if (!tasks || tasks.length === 0) return;
    
    const maintenance = async () => {
      const todayStr = formatBST(new Date(), 'yyyy-MM-dd');
      
      const batch = writeBatch(db);
      let writeCount = 0;

      for (const t of tasks) {
        if (t.isHistorySnapshot) continue;

        const taskDate = formatBST(parseISO(t.assignedAt), 'yyyy-MM-dd');
        if (taskDate === todayStr) continue;

        // Case A & B: Unfinished tasks (started but not completed) or completed daily tasks from yesterday/past
        const isUnfinished = t.status === 'in-progress' || t.status === 'paused';
        const isCompletedDaily = t.isEveryday && t.status === 'completed';

        if (isUnfinished) {
          // Calculate auto-completed/submitted details at end of its day (23:59:59 Bangladesh Time)
          const endOfTaskDayStr = taskDate + 'T23:59:59.999+06:00';
          const startTimeStr = t.startedAt || t.assignedAt;
          const rawDuration = differenceInMinutes(parseISO(endOfTaskDayStr), parseISO(startTimeStr));
          const durationMinutes = Math.max(0, rawDuration - (t.totalPauseMinutes || 0));
          
          const newHistory = [...(t.history || []), {
            status: 'completed' as const,
            timestamp: getBSTISOString(),
            performerId: 'system-auto',
            performerName: 'Auto-Submit System',
            note: 'Automated midnight auto-submit for unfinished task'
          }];

          if (t.isEveryday) {
            // Daily task - Archive completion snap and reset master to pending for today
            const archiveId = doc(collection(db, 'tasks')).id;
            const archiveData = {
              ...t,
              id: archiveId,
              isEveryday: false,
              isHistorySnapshot: true,
              status: 'completed' as const,
              completedAt: endOfTaskDayStr,
              durationMinutes,
              updatedAt: getBSTISOString(),
              history: newHistory
            };
            batch.set(doc(db, 'tasks', archiveId), cleanObject(archiveData));

            batch.update(doc(db, 'tasks', t.id), cleanObject({
              status: 'pending',
              startedAt: null,
              completedAt: null,
              durationMinutes: null,
              totalPauseMinutes: 0,
              lastPausedAt: null,
              resumedAt: null,
              isApproved: false,
              isRejected: false,
              assignedAt: getBSTISOString(),
              history: [{
                status: 'created',
                timestamp: getBSTISOString(),
                performerId: 'system-auto',
                performerName: 'Auto-Submit System',
                note: 'Automated Daily Cycle Reset after Midnight Auto-Submit'
              }]
            }));
            writeCount += 2;
          } else {
            // General task - Just auto-complete/submit it
            batch.update(doc(db, 'tasks', t.id), cleanObject({
              status: 'completed',
              completedAt: endOfTaskDayStr,
              durationMinutes,
              updatedAt: getBSTISOString(),
              history: newHistory
            }));
            writeCount += 1;
          }
        } else if (isCompletedDaily) {
          // Archive old completed daily task and reset master
          const archiveId = doc(collection(db, 'tasks')).id;
          const archiveData = {
            ...t,
            id: archiveId,
            isEveryday: false,
            isHistorySnapshot: true,
            status: 'completed' as const,
            updatedAt: getBSTISOString()
          };
          batch.set(doc(db, 'tasks', archiveId), cleanObject(archiveData));

          batch.update(doc(db, 'tasks', t.id), cleanObject({
            status: 'pending',
            startedAt: null,
            completedAt: null,
            durationMinutes: null,
            totalPauseMinutes: 0,
            lastPausedAt: null,
            resumedAt: null,
            isApproved: false,
            isRejected: false,
            assignedAt: getBSTISOString(),
            history: [{
              status: 'created',
              timestamp: getBSTISOString(),
              performerId: 'system-auto',
              performerName: 'Auto-Submit System',
              note: 'Automated Daily Cycle Reset'
            }]
          }));
          writeCount += 2;
        } else if (t.isEveryday && t.status === 'pending') {
          // Case C: Update date of pending daily task so it shows on today's board
          batch.update(doc(db, 'tasks', t.id), {
            assignedAt: getBSTISOString()
          });
          writeCount += 1;
        }
      }

      if (writeCount === 0) return;
      
      try {
        await batch.commit();
      } catch (err) {
        console.error("Maintenance failed:", err);
        handleFirestoreError(err, OperationType.WRITE, 'tasks/batch-maintenance');
      }
    };

    maintenance();
  }, [tasks, isAdmin]);

  const filteredTasks = useMemo(() => {
    let list = [];
    const todayStr = formatBST(new Date(), 'yyyy-MM-dd');
    const yesterdayStr = formatBST(subDays(new Date(), 1), 'yyyy-MM-dd');

    if (isAdmin) {
      list = tasks.filter(t => {
        // Agent filtering (Overview)
        if (selectedBoardAgentId !== 'all' && t.assigneeId !== selectedBoardAgentId) return false;

        // If it's a history snapshot, we check its completion date
        if (t.isHistorySnapshot) {
          if (!t.completedAt) return false;
          const compDate = formatBST(parseISO(t.completedAt), 'yyyy-MM-dd');

          if (boardDateRange === 'today') return compDate === todayStr;
          if (boardDateRange === 'yesterday') return compDate === yesterdayStr;
          if (boardDateRange === '30days') {
            const thirtyDaysAgo = formatBST(subDays(new Date(), 30), 'yyyy-MM-dd');
            return compDate >= thirtyDaysAgo;
          }
          if (boardDateRange === 'custom') return compDate >= boardCustomStart && compDate <= boardCustomEnd;
          return false;
        }
        
        // Regular tasks (Everyday or assigned in range)
        if (t.isEveryday) return true;
        
        const taskDate = formatBST(parseISO(t.assignedAt), 'yyyy-MM-dd');
        
        if (boardDateRange === 'today') return taskDate === todayStr;
        if (boardDateRange === 'yesterday') return taskDate === yesterdayStr;
        if (boardDateRange === '30days') {
          const thirtyDaysAgo = formatBST(subDays(new Date(), 30), 'yyyy-MM-dd');
          return taskDate >= thirtyDaysAgo;
        }
        if (boardDateRange === 'custom') return taskDate >= boardCustomStart && taskDate <= boardCustomEnd;
        return false;
      });
    } else {
      // Users see:
      // 1. Their current everyday tasks (reset or in-progress)
      // 2. Tasks not yet approved
      // 3. Their completed history snapshots for today (to see progress)
      list = tasks.filter(t => {
        if (t.assigneeId !== userProfile.id) return false;

        if (t.isHistorySnapshot) {
          if (!t.completedAt) return false;
          const compDate = formatBST(parseISO(t.completedAt), 'yyyy-MM-dd');
          // Show today's archives to the user so they know they finished it
          return compDate === todayStr;
        }

        return t.isEveryday || (t.status !== 'completed' || !t.isApproved);
      });
    }

    // Filter by status if not 'all'
    if (statusFilter === 'needs-verification') {
      list = list.filter(t => t.status === 'completed' && !t.isApproved && !t.isRejected);
    } else if (statusFilter !== 'all') {
      list = list.filter(t => t.status === statusFilter);
    }

    // Sort by status priority first (In-Progress > Pending/Paused > Completed)
    // Then by order asc, then by assignedAt desc
    const statusPriority: Record<string, number> = {
      'in-progress': 1,
      'pending': 2,
      'paused': 2,
      'completed': 3
    };

    return list.sort((a, b) => {
      const weightA = statusPriority[a.status] || 99;
      const weightB = statusPriority[b.status] || 99;
      
      if (weightA !== weightB) return weightA - weightB;

      const orderA = a.order ?? 999;
      const orderB = b.order ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime();
    });
  }, [tasks, isAdmin, boardDateRange, boardCustomStart, boardCustomEnd, statusFilter, selectedBoardAgentId]);

  // Analytics Calculations
  const [statsDateRange, setStatsDateRange] = useState<'today' | 'yesterday' | '30days' | 'custom'>('30days');
  const [customStatsStart, setCustomStatsStart] = useState(formatBST(subDays(new Date(), 7), 'yyyy-MM-dd'));
  const [customStatsEnd, setCustomStatsEnd] = useState(formatBST(new Date(), 'yyyy-MM-dd'));

  const analyticsData = useMemo(() => {
    const currentUid = auth.currentUser?.uid;
    const now = new Date();
    const todayStr = formatBST(now, 'yyyy-MM-dd');
    const yesterdayStr = formatBST(subDays(now, 1), 'yyyy-MM-dd');

    const filteredForStats = tasks.filter(t => {
      const taskDate = formatBST(parseISO(t.assignedAt), 'yyyy-MM-dd');
      
      // Date filtering
      let dateMatch = true;
      if (statsDateRange === 'today') dateMatch = taskDate === todayStr;
      else if (statsDateRange === 'yesterday') dateMatch = taskDate === yesterdayStr;
      else if (statsDateRange === '30days') dateMatch = true; 
      else if (statsDateRange === 'custom') {
        dateMatch = taskDate >= customStatsStart && taskDate <= customStatsEnd;
      }

      // Agent filtering
      const agentMatch = selectedReportAgentId === 'all' || t.assigneeId === selectedReportAgentId;

      return dateMatch && agentMatch;
    });

    const statsMap = new Map<string, { 
      date: string, 
      name: string, 
      assigneeId: string, 
      completed: number, 
      avgMinutes: number, 
      totalMinutes: number, 
      totalPause: number, 
      taskIds: string[], 
      completedTasks: { 
        title: string, 
        duration: number, 
        date: string,
        startedAt: string,
        completedAt: string
      }[] 
    }>();
    
    filteredForStats.forEach(task => {
      // Only count completed tasks
      // All completed tasks MUST be approved to show in stats
      const isCountable = task.status === 'completed' && 
                        task.durationMinutes !== undefined &&
                        task.isApproved === true;

      if (isCountable) {
        const compDate = formatBST(parseISO(task.completedAt || task.assignedAt), 'yyyy-MM-dd');
        const key = `${compDate}_${task.assigneeId}`;
        
        const stats = statsMap.get(key) || { 
          date: compDate, 
          name: task.assigneeName, 
          assigneeId: task.assigneeId,
          completed: 0, 
          avgMinutes: 0, 
          totalMinutes: 0, 
          totalPause: 0, 
          taskIds: [], 
          completedTasks: [] 
        };
        stats.completed += 1;
        stats.totalMinutes += (task.durationMinutes || 0);
        stats.totalPause += (task.totalPauseMinutes || 0);
        stats.avgMinutes = Math.round(stats.totalMinutes / stats.completed);
        stats.taskIds.push(task.id);
        stats.completedTasks.push({
          title: task.title,
          duration: task.durationMinutes || 0,
          date: formatBST(parseISO(task.completedAt || task.assignedAt), 'MMM dd, HH:mm'),
          startedAt: task.startedAt ? formatBST(parseISO(task.startedAt), 'hh:mm:ss a') : 'N/A',
          completedAt: task.completedAt ? formatBST(parseISO(task.completedAt), 'hh:mm:ss a') : 'N/A'
        });
        statsMap.set(key, stats);
      }
    });

    return Array.from(statsMap.values()).sort((a, b) => {
      // Sort by date DESC, then by completed DESC
      if (b.date !== a.date) return b.date.localeCompare(a.date);
      return b.completed - a.completed;
    });
  }, [tasks, isAdmin, statsDateRange, customStatsStart, customStatsEnd, selectedReportAgentId]);

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
  const assignableUsers = (allUsers || []).filter(u => u.isActive);

  return (
    <div className="space-y-5 pb-20 relative">
      {/* Background Decor */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500/5 dark:bg-blue-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
      <div className="absolute bottom-0 right-1/4 w-64 h-64 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none -z-10" />

      {/* Header Section */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 mb-12 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl p-10 rounded-[3.5rem] border border-white/40 dark:border-slate-800 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
        
        <div className="flex items-center gap-8 relative z-10">
          <div className="flex flex-col items-center gap-2">
            <div className="w-14 h-20 bg-gradient-to-b from-blue-500 to-blue-700 rounded-[2.5rem] flex items-center justify-center text-white shadow-[0_20px_40px_-10px_rgba(37,99,235,0.4)] border border-white/10 relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <Layout className="w-7 h-7 relative z-10 drop-shadow-md" strokeWidth={2.5} />
            </div>
          </div>
          <div>
            <h2 className="text-4xl font-black text-slate-900 dark:text-white uppercase tracking-tighter leading-none mb-3">Team Work</h2>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)] animate-pulse" />
              <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.25em] leading-none opacity-80">
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

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border ${
              showFilters 
                ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/60 text-blue-600' 
                : 'bg-slate-100/80 dark:bg-slate-800/80 border-white/10 dark:border-slate-700/30 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            <SlidersHorizontal size={12} strokeWidth={2.5} />
            <span>Filter</span>
            {showFilters ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
          </button>

          {showFilters && (
            <>
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
                {isAdmin && (
                  <button
                    onClick={() => setStatusFilter('needs-verification')}
                    className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap flex items-center gap-2 relative ${
                      statusFilter === 'needs-verification' ? 'bg-white dark:bg-slate-700 shadow-[0_4px_12px_rgba(0,0,0,0.05)] text-red-600' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                  >
                    Verification
                    {tasks.filter(t => t.status === 'completed' && !t.isApproved && !t.isRejected).length > 0 && (
                      <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    )}
                  </button>
                )}
              </div>
              
              {isAdmin && view === 'list' && (
                <div className="flex bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-sm p-1.5 rounded-2xl border border-white/20 dark:border-slate-700/30">
                  <div className="relative group min-w-[160px]">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-focus-within:text-blue-500 transition-colors" size={12} />
                    <select 
                      value={selectedBoardAgentId}
                      onChange={(e) => setSelectedBoardAgentId(e.target.value)}
                      className="w-full bg-transparent pl-8 pr-8 py-2 text-[9px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 outline-none appearance-none cursor-pointer"
                    >
                      <option value="all">All Personnel</option>
                      {assignableUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.displayName}</option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <ChevronDown size={10} />
                    </div>
                  </div>
                </div>
              )}

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
            </>
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
                scheduledDate: formatBST(new Date(), 'yyyy-MM-dd')
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
                    className={`p-8 rounded-[3rem] border transition-all relative overflow-hidden group cursor-pointer ${
                      task.status === 'completed' 
                        ? 'bg-slate-50/60 dark:bg-slate-800/20 shadow-inner dark:shadow-none border-slate-100 dark:border-slate-800/50 grayscale-[0.2] opacity-80' 
                        : 'bg-white dark:bg-slate-900 border-slate-200/50 dark:border-slate-800 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.06)] dark:shadow-none hover:shadow-[0_48px_80px_-24px_rgba(37,99,235,0.15)] hover:border-blue-300 dark:hover:border-blue-700'
                    }`}
                  >
                    <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none group-hover:opacity-10 transition-opacity">
                      <Layout size={90} className="text-blue-600 rotate-12" />
                    </div>

                    <div className="flex justify-between items-start mb-8 relative z-10">
                      <div className="flex flex-col gap-2.5">
                        <div className={`px-4 py-2 rounded-2xl text-[9px] font-black uppercase tracking-[0.15em] flex items-center gap-2.5 w-fit shadow-sm border whitespace-nowrap ${
                          task.isRejected ? 'bg-red-50 text-red-600 border-red-100' :
                          task.status === 'completed' ? (task.isApproved ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-slate-50 text-slate-500 border-slate-100') : 
                          task.status === 'in-progress' ? 'bg-blue-50 text-blue-600 border-blue-100' : 
                          task.status === 'paused' ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-indigo-50 text-indigo-600 border-indigo-100'
                        }`}>
                          <div className={`w-2 h-2 rounded-full ${
                            task.isRejected ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)]' :
                            task.status === 'completed' ? (task.isApproved ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-400') : 
                            task.status === 'in-progress' ? 'bg-blue-500 shadow-[0_0_10px_rgba(37,99,235,0.5)] animate-pulse' : 
                            task.status === 'paused' ? 'bg-slate-400' : 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]'
                          }`} />
                          <span>
                            {task.isRejected ? 'Access Denied' : 
                             task.status === 'completed' ? (task.isApproved ? 'Verified / Cleared' : 'Awaiting Review') : 
                             task.status.replace('-', ' ')}
                          </span>
                          {task.isEveryday && <span className="ml-1 px-2 py-0.5 bg-black/5 dark:bg-white/10 rounded-lg text-[8px] font-black text-slate-500">DAILY</span>}
                        </div>
                        {task.order !== undefined && (
                          <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest pl-1 opacity-80 flex items-center gap-2">
                             <div className="w-1 h-1 rounded-full bg-slate-300" />
                             PRTY-LVL: <span className="text-slate-900 dark:text-slate-200">{task.order}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-3">
                        <div className="text-[10px] font-black text-slate-400 bg-slate-50 dark:bg-slate-800/50 px-3 py-1.5 rounded-xl border border-slate-100 dark:border-slate-800 uppercase tracking-widest leading-none shadow-sm">
                          {formatBST(
                            task.status === 'completed' && task.completedAt 
                              ? parseISO(task.completedAt) 
                              : (task.isEveryday ? new Date() : parseISO(task.assignedAt)), 
                            'MMM dd'
                          )}
                        </div>
                        {isAdmin && (
                          <div className="flex items-center gap-1 bg-white dark:bg-slate-800 shadow-sm p-1 rounded-xl border border-slate-100 dark:border-slate-700/50">
                            <button 
                              onClick={() => handleOpenEditModal(task)}
                              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 rounded-lg transition-all"
                              title="Edit Task"
                            >
                              <Edit size={12} />
                            </button>
                            <div className="w-px h-3 bg-slate-100 dark:bg-slate-700 mx-0.5" />
                            <button 
                              onClick={() => handleDeleteTask(task.id)}
                              className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-slate-700 rounded-lg transition-all"
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

                    <div className="flex flex-wrap items-center justify-between pt-8 border-t border-slate-100 dark:border-slate-800/50 relative z-10 gap-x-4 gap-y-6">
                      <div className="flex items-center gap-4 shrink-0">
                        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-[12px] font-black text-white uppercase shadow-lg shadow-blue-500/20 border border-white/20">
                          {task.assigneeName.charAt(0)}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black text-slate-900 dark:text-slate-100 uppercase tracking-tight leading-none mb-1">
                            {task.assigneeName}
                          </span>
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest opacity-70">
                            UNIT: {task.assigneeId.slice(0, 6)}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 ml-auto">
                        {isAdmin && task.status === 'completed' && !task.isApproved && (
                          <div className="flex flex-wrap items-center gap-2">
                            {!task.isRejected && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleApproveTask(task); }}
                                className="bg-emerald-600 text-white min-w-[90px] h-11 px-4 rounded-2xl text-[10px] font-black uppercase tracking-wider hover:bg-emerald-700 transition-all shadow-[0_12px_24px_-8px_rgba(16,185,129,0.5)] flex items-center justify-center gap-2 active:scale-95 border border-emerald-500"
                                title="Verify Task"
                              >
                                <CheckCheck size={14} />
                                Verify
                              </button>
                            )}
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleResentTask(task); }}
                              className="bg-amber-500 text-white min-w-[90px] h-11 px-4 rounded-2xl text-[10px] font-black uppercase tracking-wider hover:bg-amber-600 transition-all shadow-[0_12px_24px_-8px_rgba(245,158,11,0.5)] flex items-center justify-center gap-2 active:scale-95 border border-amber-400"
                              title="Resent Task"
                            >
                              <RotateCcw size={14} />
                              Resent
                            </button>
                            {!task.isRejected && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleRejectTask(task); }}
                                className="bg-white dark:bg-slate-800 text-red-500 min-w-[90px] h-11 px-4 rounded-2xl text-[10px] font-black uppercase tracking-wider hover:bg-red-50 dark:hover:bg-red-900/10 transition-all border border-red-100 dark:border-red-900/30 flex items-center justify-center gap-2 active:scale-95"
                                title="Reject Task"
                              >
                                <X size={14} />
                                Reject
                              </button>
                            )}
                          </div>
                        )}
                        {(task.status === 'pending' || task.status === 'paused') && (task.assigneeId === auth.currentUser?.uid || isAdmin) && (
                          <button 
                            onClick={() => task.status === 'paused' ? handleResumeTask(task) : handleStartTask(task)}
                            className="bg-blue-600 text-white min-w-[140px] h-11 px-6 rounded-2xl hover:bg-blue-700 transition-all shadow-[0_12px_24px_-8px_rgba(37,99,235,0.5)] flex items-center justify-center gap-2.5 text-[10px] font-black uppercase tracking-wider active:scale-95"
                          >
                            <Play size={14} fill="currentColor" />
                            {task.status === 'paused' ? 'Resume Ops' : 'Initiate Unit'}
                          </button>
                        )}
                        {task.status === 'in-progress' && (task.assigneeId === auth.currentUser?.uid || isAdmin) && (
                          <div className="flex flex-wrap items-center gap-3">
                             <button 
                              onClick={() => handlePauseTask(task)}
                              className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 min-w-[90px] h-11 px-4 rounded-2xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-800 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-wider"
                              title="Pause Task"
                            >
                              <Pause size={14} fill="currentColor" />
                              Hold
                            </button>
                            <button 
                              onClick={() => handleCompleteTask(task)}
                              className="bg-emerald-600 text-white min-w-[120px] h-11 px-5 rounded-2xl hover:bg-emerald-700 transition-all shadow-[0_12px_24px_-8px_rgba(16,185,129,0.5)] flex items-center justify-center gap-2.5 text-[10px] font-black uppercase tracking-wider active:scale-95"
                              title="Submit Task"
                            >
                              <CheckCircle2 size={16} />
                              Complete
                            </button>
                          </div>
                        )}
                        {task.status === 'completed' && (
                          <div className="flex flex-col items-end gap-1 px-2">
                            <div className="text-[12px] font-black text-emerald-600 flex items-center gap-1.5 leading-none">
                              <Timer size={12} className="opacity-70" />
                              {task.durationMinutes}m
                            </div>
                            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest opacity-60">
                              ACTIVE TIME
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
                            Started: <span className="text-slate-500 dark:text-slate-300 font-bold">{formatBST(parseISO(task.startedAt), 'hh:mm:ss a')}</span>
                          </div>
                        )}
                        {task.completedAt && (
                          <div className="text-[8px] font-black text-emerald-500/80 uppercase flex items-center gap-1.5 tracking-widest">
                            <CheckCircle2 size={10} className="text-emerald-500/50" /> 
                            Finished: <span className="text-emerald-600 dark:text-emerald-400 font-bold">{formatBST(parseISO(task.completedAt), 'hh:mm:ss a')}</span>
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
            <div className="flex flex-wrap items-center gap-6 bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl -mr-10 -mt-10" />
              
              <div className="flex flex-col gap-2">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 opacity-60">Time Horizon</span>
                <div className="flex bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-sm p-1.5 rounded-2xl border border-white/20 dark:border-slate-700/30">
                  {(['today', 'yesterday', '30days', 'custom'] as const).map(range => (
                    <button 
                      key={range}
                      onClick={() => setStatsDateRange(range)}
                      className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap tracking-widest ${statsDateRange === range ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}
                    >
                      {range === '30days' ? 'Aggregate' : range}
                    </button>
                  ))}
                </div>
              </div>

              {isAdmin && (
                <div className="flex flex-col gap-2 min-w-[200px]">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 opacity-60">Agent Filter</span>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none group-focus-within:text-blue-500 transition-colors" size={14} />
                    <select 
                      value={selectedReportAgentId}
                      onChange={(e) => setSelectedReportAgentId(e.target.value)}
                      className="w-full bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-sm pl-11 pr-10 py-3 rounded-2xl border border-white/20 dark:border-slate-700/30 text-[10px] font-black uppercase tracking-widest text-slate-700 dark:text-slate-200 outline-none focus:ring-4 focus:ring-blue-500/10 appearance-none cursor-pointer hover:bg-white dark:hover:bg-slate-700 transition-all"
                    >
                      <option value="all" className="font-black">All Personnel</option>
                      {assignableUsers.map(u => (
                        <option key={u.id} value={u.id} className="font-black">{u.displayName}</option>
                      ))}
                    </select>
                    {selectedReportAgentId !== 'all' && (
                      <button 
                        onClick={() => setSelectedReportAgentId('all')}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-red-500 transition-colors p-1"
                        title="Clear Filter"
                      >
                        <X size={12} strokeWidth={3} />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {statsDateRange === 'custom' && (
                <div className="flex flex-col gap-2">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1 opacity-60">Custom Parameters</span>
                  <div className="flex items-center gap-3 bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur-sm p-1.5 rounded-2xl border border-white/20 dark:border-slate-700/30">
                    <input 
                      type="date" 
                      value={customStatsStart}
                      onChange={(e) => setCustomStatsStart(e.target.value)}
                      className="bg-white/80 dark:bg-slate-900/80 border-none rounded-xl py-2 px-4 text-[9px] font-black outline-none w-32"
                    />
                    <span className="text-slate-400 font-black text-[9px] uppercase tracking-widest opacity-50">to</span>
                    <input 
                      type="date" 
                      value={customStatsEnd}
                      onChange={(e) => setCustomStatsEnd(e.target.value)}
                      className="bg-white/80 dark:bg-slate-900/80 border-none rounded-xl py-2 px-4 text-[9px] font-black outline-none w-32"
                    />
                  </div>
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

            {/* Performance Chart & Rankings */}
            <div className="flex flex-col gap-8">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-10">
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
                      <Bar dataKey="completed" name="Work Score" radius={[8, 8, 0, 0]}>
                        {(analyticsData || []).map((_, index) => (
                          <Cell key={`cell-score-${index}`} fill={index === 0 ? '#10B981' : '#E2E8F0'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] p-10">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 uppercase tracking-widest flex items-center gap-3">
                    <TrendingUp className="text-green-600" size={18} />
                    {isAdmin ? 'Team Performance Rankings' : 'Personal Performance Rank'}
                  </h3>
                  {isAdmin && analyticsData && analyticsData.length > 0 && (
                    <button 
                      onClick={() => generateRankingsExcel(analyticsData, sessions)}
                      className="px-4 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-all flex items-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-sm"
                      title="Download Ranking Report"
                    >
                      <Download size={14} />
                      Excel Report
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {(analyticsData || []).map((staff, idx) => (
                    <div key={`${staff.date}_${staff.assigneeId}`} className="flex flex-col gap-4 group bg-slate-50/50 dark:bg-slate-800/20 p-5 rounded-3xl border border-transparent hover:border-slate-100 dark:hover:border-slate-800 transition-all">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex flex-col items-center">
                            <span className="text-[8px] font-black text-blue-600 uppercase tracking-tighter mb-1">{staff.date}</span>
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-black ${
                              idx === 0 ? 'bg-amber-100 text-amber-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                            }`}>
                              {idx + 1}
                            </div>
                          </div>
                          <div>
                            <p className="text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-tighter">{staff.name}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">{staff.completed} Tasks Executed</p>
                            {(() => {
                              const matchingSession = sessions.find(s => s.id === `${staff.assigneeId}_${staff.date}`);
                              if (matchingSession) {
                                return (
                                  <div className="flex flex-col gap-0.5 mt-1 border-t border-slate-100 dark:border-slate-800/50 pt-1.5 min-w-[200px]">
                                    <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase flex items-center gap-1">
                                      <span className="inline-block w-1 h-1 rounded-full bg-blue-500"></span>
                                      First Login: <span className="font-extrabold text-[#1858ff] dark:text-blue-400">{matchingSession.firstLogin ? formatBST(parseISO(matchingSession.firstLogin), 'hh:mm:ss a') : 'N/A'}</span>
                                    </p>
                                    <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase flex items-center gap-1">
                                      <span className="inline-block w-1 h-1 rounded-full bg-red-400"></span>
                                      Last Logout: <span className="font-extrabold text-red-500 dark:text-red-400">
                                        {matchingSession.lastLogout 
                                          ? formatBST(parseISO(matchingSession.lastLogout), 'hh:mm:ss a') 
                                          : (matchingSession.lastActive 
                                            ? `${formatBST(parseISO(matchingSession.lastActive), 'hh:mm:ss a')} (Active)`
                                            : 'N/A'
                                          )}
                                      </span>
                                    </p>
                                    <p className="text-[8px] font-bold text-slate-400 dark:text-slate-500 uppercase flex items-center gap-1">
                                      <span className="inline-block w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></span>
                                      Active Time: <span className="font-extrabold text-emerald-600 dark:text-emerald-400">{formatDurationHelper(matchingSession.totalDurationSeconds || 0)}</span>
                                    </p>
                                  </div>
                                );
                              } else {
                                return (
                                  <div className="mt-1 border-t border-slate-100 dark:border-slate-800/50 pt-1.5">
                                    <p className="text-[8px] font-bold text-slate-300 dark:text-slate-600 uppercase italic">No session recorded today</p>
                                  </div>
                                );
                              }
                            })()}
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

                        {/* Completed Tasks List */}
                        <div className="mt-2 space-y-3 pl-11">
                          <p className="text-[8px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Work History & Status Log</p>
                          {staff.completedTasks.map((t, tIdx) => {
                            const originalTask = tasks.find(task => task.title === t.title && task.assigneeName === staff.name);
                            const historyKey = `${staff.date}-${staff.assigneeId}-${tIdx}`;
                            const isHistoryExpanded = expandedHistoryId === historyKey;
                            
                            return (
                              <div key={tIdx} className="flex flex-col gap-2 py-2 border-l-2 border-slate-100 dark:border-slate-800 pl-4 bg-white/30 dark:bg-slate-900/30 rounded-r-2xl">
                                <div className="flex items-start justify-between gap-4">
                                  <div className="flex flex-col min-w-0">
                                    <span className="text-[10px] font-black text-slate-600 dark:text-slate-300 uppercase leading-tight truncate">
                                      {t.title}
                                    </span>
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
                                      {t.date}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className="text-[9px] font-black text-blue-500/80 bg-blue-50 dark:bg-blue-900/20 px-2 py-0.5 rounded-md whitespace-nowrap">
                                      {t.duration}m
                                    </span>
                                    {originalTask?.history && (
                                      <button 
                                        onClick={() => setExpandedHistoryId(isHistoryExpanded ? null : historyKey)}
                                        className="p-1 text-slate-400 hover:text-blue-500 transition-colors"
                                      >
                                        {isHistoryExpanded ? <ChevronUp size={14} /> : <History size={14} />}
                                      </button>
                                    )}
                                  </div>
                                </div>

                                {/* Expanded History Log */}
                                <AnimatePresence>
                                  {isHistoryExpanded && originalTask?.history && (
                                    <motion.div 
                                      initial={{ height: 0, opacity: 0 }}
                                      animate={{ height: 'auto', opacity: 1 }}
                                      exit={{ height: 0, opacity: 0 }}
                                      className="overflow-hidden"
                                    >
                                      <div className="space-y-3 pt-3 mt-3 border-t border-slate-100 dark:border-slate-800">
                                        {(originalTask.history || []).map((h, i) => (
                                          <div key={i} className="flex items-start gap-3">
                                            <div className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${
                                              h.status === 'completed' ? 'bg-emerald-500' :
                                              h.status === 'in-progress' ? 'bg-blue-500' :
                                              h.status === 'paused' ? 'bg-slate-400' :
                                              h.status === 'approved' ? 'bg-emerald-600' :
                                              h.status === 'rejected' ? 'bg-red-500' : 
                                              h.status === 'resent' ? 'bg-amber-500' : 'bg-indigo-500'
                                            }`} />
                                            <div className="flex flex-col">
                                              <div className="flex items-center gap-2">
                                                <span className="text-[9px] font-black text-slate-700 dark:text-slate-200 uppercase tracking-widest">{h.status.replace('-', ' ')}</span>
                                                <span className="text-[7px] font-bold text-slate-300 dark:text-slate-600 uppercase italic">{formatBST(parseISO(h.timestamp), 'HH:mm:ss')}</span>
                                              </div>
                                              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">By {h.performerName} {h.note ? `• ${h.note}` : ''}</p>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            );
                          })}
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

      {/* Re-entry logic for history logging color support */}
      <style dangerouslySetInnerHTML={{ __html: `
        .h-resent { background-color: #f59e0b; }
      `}} />

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
              className="relative w-full max-w-lg bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl rounded-[2.5rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.2)] flex flex-col max-h-[90vh] overflow-y-auto border border-white/20 dark:border-slate-800 no-scrollbar"
            >
              <div className="p-8 pb-4 flex justify-between items-start">
                <div>
                  <h3 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter mb-1 leading-none">
                    {editingTask ? 'Edit Task' : isAdmin ? 'Assign Task' : 'New Task'}
                  </h3>
                  <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] opacity-60">
                    {editingTask ? 'Adjusting parameters' : 'Strategic allocation'}
                  </p>
                </div>
                <button 
                  onClick={() => setShowAssignModal(false)}
                  className="p-2.5 bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-xl transition-all active:scale-90"
                >
                  <X size={18} strokeWidth={3} />
                </button>
              </div>

              <form onSubmit={handleAssignTask} className="p-8 pt-2 space-y-5">
                <div className="space-y-1.5">
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Task Designation</label>
                  <input 
                    required
                    type="text" 
                    placeholder="Brief description of work..."
                    value={newTask.title}
                    onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                    className="w-full bg-slate-100/50 dark:bg-slate-800/50 border-2 border-transparent focus:border-blue-500/20 rounded-xl py-3.5 px-6 text-sm font-bold focus:bg-white dark:focus:bg-slate-800 transition-all outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {isAdmin && (
                    <div className="md:col-span-2 space-y-1.5">
                      <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Deployment Target</label>
                      <div className="grid grid-cols-2 gap-2.5 max-h-44 overflow-y-auto p-4 bg-slate-100/50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 no-scrollbar">
                        {assignableUsers.map(u => (
                          <label key={u.id} className={`flex items-center gap-3 p-2.5 rounded-xl transition-all cursor-pointer border-2 ${
                            newTask.assigneeIds.includes(u.id || '') 
                            ? 'bg-white dark:bg-slate-700 border-blue-500/20 ring-4 ring-blue-500/5 shadow-sm' 
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
                  
                  <div className={`space-y-1.5 ${newTask.isEveryday ? 'opacity-30 pointer-events-none' : ''}`}>
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Launch Date</label>
                    <input 
                      type="date" 
                      disabled={newTask.isEveryday}
                      value={newTask.scheduledDate}
                      onChange={e => setNewTask({ ...newTask, scheduledDate: e.target.value })}
                      className="w-full bg-slate-100/50 dark:bg-slate-800/50 border-2 border-transparent focus:border-blue-500/20 rounded-xl py-3.5 px-6 text-xs font-bold outline-none"
                    />
                  </div>
                  
                  <div className="flex flex-col justify-end">
                    <label className={`flex items-center gap-4 p-3.5 rounded-xl cursor-pointer transition-all border-2 h-[48px] ${
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
                            scheduledDate: isDaily ? formatBST(new Date(), 'yyyy-MM-dd') : newTask.scheduledDate
                          });
                        }}
                        className="hidden"
                      />
                      <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-all ${
                        newTask.isEveryday ? 'bg-blue-600 border-blue-600' : 'border-slate-300 dark:border-slate-600'
                      }`}>
                        {newTask.isEveryday && <CheckCheck size={12} className="text-white" strokeWidth={4} />}
                      </div>
                      <span className="text-[9px] font-black text-slate-800 dark:text-slate-300 uppercase tracking-widest">Daily Cycle</span>
                    </label>
                  </div>

                  {isAdmin && editingTask?.status === 'completed' && (
                    <div className="md:col-span-2 pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-2 gap-3">
                      <div 
                        onClick={() => {
                          setEditIsApproved(!editIsApproved);
                          if (!editIsApproved) setEditIsRejected(false);
                        }}
                        className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                          editIsApproved 
                          ? 'bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-500/20' 
                          : 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-100/50 dark:border-emerald-900/20 text-emerald-600'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <CheckCheck size={16} />
                          <span className="text-[9px] font-black uppercase tracking-widest">Approved</span>
                        </div>
                        <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center ${editIsApproved ? 'bg-white border-white' : 'border-emerald-200'}`}>
                          {editIsApproved && <CheckCheck size={12} className="text-emerald-500" strokeWidth={4} />}
                        </div>
                      </div>

                      <div 
                        onClick={() => {
                          setEditIsRejected(!editIsRejected);
                          if (!editIsRejected) setEditIsApproved(false);
                        }}
                        className={`flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer ${
                          editIsRejected 
                          ? 'bg-red-500 text-white border-red-400 shadow-lg shadow-red-500/20' 
                          : 'bg-red-50/50 dark:bg-red-900/10 border-red-100/50 dark:border-red-900/20 text-red-600'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <X size={16} />
                          <span className="text-[9px] font-black uppercase tracking-widest">Rejected</span>
                        </div>
                        <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center ${editIsRejected ? 'bg-white border-white' : 'border-red-200'}`}>
                          {editIsRejected && <X size={12} className="text-red-500" strokeWidth={4} />}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                  <div className="space-y-1.5">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Queue Priority</label>
                    <input 
                      type="number" 
                      min="1"
                      value={newTask.order}
                      onChange={e => setNewTask({ ...newTask, order: parseInt(e.target.value) || 1 })}
                      className="w-full bg-slate-100/50 dark:bg-slate-800/50 border-2 border-transparent focus:border-blue-500/20 rounded-xl py-3.5 px-6 text-xs font-bold outline-none"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => setShowAssignModal(false)}
                      className="flex-1 bg-slate-100 dark:bg-slate-800 h-12 text-slate-500 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all hover:bg-slate-200 dark:hover:bg-slate-700"
                    >
                      Abort
                    </button>
                    <button 
                      disabled={isSubmitting}
                      className="flex-[2] bg-blue-600 h-12 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all hover:bg-blue-700 shadow-lg shadow-blue-500/20 disabled:opacity-50 active:scale-95"
                    >
                      {isSubmitting ? 'Syncing...' : editingTask ? 'Update' : 'Assign'}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Operational Context</label>
                  <textarea 
                    placeholder="Specific parameters for execution..."
                    value={newTask.description}
                    onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                    className="w-full bg-slate-100/50 dark:bg-slate-800/50 border-2 border-transparent focus:border-blue-500/20 rounded-2xl py-4 px-6 text-xs font-bold focus:bg-white dark:focus:bg-slate-800 transition-all outline-none h-28 resize-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
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
