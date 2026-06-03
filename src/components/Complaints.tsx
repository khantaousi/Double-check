import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile } from '../types';

export function Complaints({ userProfile, user }: { userProfile: UserProfile | null, user: any }) {
  const [complaintText, setComplaintText] = useState('');
  const [complaints, setComplaints] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [revealedIds, setRevealedIds] = useState<Record<string, boolean>>({});

  const isSuperAdmin = user?.email === 'khantaousi@gmail.com';

  useEffect(() => {
    const q = query(collection(db, 'complaints'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setComplaints(data);
    }, (error) => {
      console.warn("Complaints snapshot error:", error);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!complaintText.trim()) return;
    
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'complaints'), {
        text: complaintText,
        createdAt: new Date().toISOString(),
        // Hidden identity fields
        submittedByEmail: user?.email || 'unknown',
        submittedByName: userProfile?.displayName || 'unknown'
      });
      setComplaintText('');
      setSuccessMsg('Your feedback has been submitted anonymously. Thank you.');
      setTimeout(() => setSuccessMsg(''), 5000);
    } catch (error) {
      console.error("Error submitting complaint:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!isSuperAdmin) return;
    if (window.confirm('Are you sure you want to delete this complaint?')) {
      try {
        await deleteDoc(doc(db, 'complaints', id));
      } catch (error) {
        console.error("Error deleting complaint:", error);
      }
    }
  };

  return (
    <div className="space-y-8">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm relative overflow-hidden">
        <h3 className="text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tighter mb-2">Anonymous Feedback</h3>
        <p className="text-sm text-slate-500 mb-6 font-medium">Have a complaint or suggestion? Submit it here. Users will not see who submitted the complaint, and regular administrators will also see it as anonymous. Your identity is kept secretly hidden.</p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            value={complaintText}
            onChange={(e) => setComplaintText(e.target.value)}
            placeholder="Write your feedback or complaint here..."
            className="w-full h-32 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-medium text-sm"
            required
          />
          <button
            type="submit"
            disabled={isSubmitting || !complaintText.trim()}
            className="bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 px-6 py-3 rounded-xl font-bold text-sm tracking-wide shadow-sm hover:bg-slate-800 dark:hover:bg-slate-200 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {isSubmitting ? 'Submitting...' : 'Submit Anonymously'}
          </button>
          
          {successMsg && (
            <p className="text-sm text-green-600 dark:text-green-400 font-bold mt-2">{successMsg}</p>
          )}
        </form>
      </div>

      <div className="bg-white dark:bg-slate-900 p-8 rounded-3xl border border-slate-200/60 dark:border-slate-800/80 shadow-sm mt-8 relative overflow-hidden">
        <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tighter mb-6">Recent Feedback</h3>
        {complaints.length === 0 ? (
          <p className="text-sm text-slate-500 font-medium text-center py-8">No feedback submitted yet.</p>
        ) : (
          <div className="space-y-4">
            {complaints.map(c => (
              <div key={c.id} className="p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap text-sm leading-relaxed mb-4">{c.text}</p>
                <div className="flex justify-between items-center text-xs font-bold font-mono">
                  <span className="text-slate-400 dark:text-slate-500">{new Date(c.createdAt).toLocaleDateString()} {new Date(c.createdAt).toLocaleTimeString()}</span>
                  <div className="flex items-center gap-4">
                    {isSuperAdmin ? (
                      revealedIds[c.id] ? (
                        <span 
                          onClick={() => setRevealedIds(prev => ({...prev, [c.id]: false}))}
                          className="text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded cursor-pointer select-none"
                        >
                          Hidden Identity: {c.submittedByName} ({c.submittedByEmail})
                        </span>
                      ) : (
                        <span 
                          onClick={() => setRevealedIds(prev => ({...prev, [c.id]: true}))}
                          className="text-slate-500 dark:text-slate-400 bg-slate-200/50 dark:bg-slate-700/50 px-2 py-1 rounded cursor-default select-none"
                        >
                          Anonymous User
                        </span>
                      )
                    ) : (
                      <span className="text-slate-500 dark:text-slate-400 bg-slate-200/50 dark:bg-slate-700/50 px-2 py-1 rounded">Anonymous User</span>
                    )}
                    {isSuperAdmin && (
                      <button 
                        onClick={() => handleDelete(c.id)}
                        className="text-red-500 hover:text-red-700 transition-colors bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
