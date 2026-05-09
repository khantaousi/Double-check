import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { UserProfile } from '../types';
import { User as FirebaseUser } from 'firebase/auth';
import { ShieldCheck } from 'lucide-react';

const WelcomeScreen = ({ onComplete, userProfile, user }: { 
  onComplete: () => void, 
  userProfile: UserProfile | null, 
  user: FirebaseUser | null 
}) => {
  const isAdmin = userProfile?.role === 'admin' || user?.email === 'khantaousi@gmail.com';
  const name = isAdmin ? "CHIEF" : (userProfile?.displayName || user?.email?.split('@')[0] || "USER");
  const greetingText = `WELCOME ${name}`;

  useEffect(() => {
    const timer = setTimeout(onComplete, 3000);
    return () => {
      clearTimeout(timer);
    };
  }, [onComplete]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-50"
    >
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="mb-8"
      >
        <ShieldCheck className="w-16 h-16 text-blue-600" />
      </motion.div>

      <div className="flex overflow-hidden">
        {greetingText.split("").map((char, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              delay: 0.1 + i * 0.04,
              duration: 0.6,
              ease: "easeOut"
            }}
            className={`text-6xl font-black tracking-tight text-slate-900 uppercase ${char === ' ' ? 'w-4' : ''}`}
          >
            {char}
          </motion.span>
        ))}
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.7, y: [0, -10, 0] }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
        className="mt-6 text-slate-500 text-lg uppercase tracking-widest font-medium"
      >
        Initializing System Access
      </motion.p>
    </motion.div>
  );
};
export default WelcomeScreen;
