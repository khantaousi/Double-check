import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile } from '../types';
import { User as FirebaseUser } from 'firebase/auth';
import { ShieldCheck, Gift } from 'lucide-react';

const WelcomeScreen = ({ onComplete, userProfile, user }: { 
  onComplete: () => void, 
  userProfile: UserProfile | null, 
  user: FirebaseUser | null 
}) => {
  const isAdmin = userProfile?.role === 'admin' || user?.email === 'khantaousi@gmail.com';
  const name = isAdmin ? "CHIEF" : (userProfile?.displayName || user?.email?.split('@')[0] || "USER");
  
  let isBirthdayToday = false;
  if (userProfile?.birthday) {
    const parts = userProfile.birthday.split('-');
    if (parts.length === 3) {
      const now = new Date();
      const month = parseInt(parts[1], 10);
      const day = parseInt(parts[2], 10);
      if (now.getMonth() + 1 === month && now.getDate() === day) {
        isBirthdayToday = true;
      }
    }
  }

  const greetingText = `WELCOME ${name}`;

  const onCompleteRef = React.useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    const timer = setTimeout(() => {
      onCompleteRef.current();
    }, isBirthdayToday ? 5000 : 3000);
    return () => {
      clearTimeout(timer);
    };
  }, [isBirthdayToday]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[250] flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 overflow-hidden transition-colors duration-300"
    >
      <AnimatePresence>
        {isBirthdayToday ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center z-10"
          >
            <motion.div
              animate={{ 
                rotate: [0, 10, -10, 10, 0],
                scale: [1, 1.1, 1]
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="mb-8 p-6 bg-amber-100 dark:bg-amber-950/40 rounded-full shadow-lg shadow-amber-500/20"
            >
              <Gift className="w-20 h-20 text-amber-600 dark:text-amber-500" />
            </motion.div>
            
            <motion.h1 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-5xl md:text-7xl font-black text-amber-600 dark:text-amber-500 mb-4 text-center tracking-tight"
            >
              Happy Birthday!
            </motion.h1>
            
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-2xl md:text-4xl font-extrabold text-slate-800 dark:text-slate-100 text-center tracking-tight"
            >
              {name}
            </motion.p>
            
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="mt-8 px-6 py-2 bg-amber-100 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/30 rounded-full"
            >
              <p className="text-amber-800 dark:text-amber-400 font-bold text-sm tracking-widest uppercase">Have a wonderful day!</p>
            </motion.div>
          </motion.div>
        ) : (
          <motion.div className="flex flex-col items-center z-10">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="mb-8"
            >
              <ShieldCheck className="w-16 h-16 text-blue-600 dark:text-blue-500" />
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
                  className={`text-6xl font-black tracking-tight text-slate-900 dark:text-white uppercase ${char === ' ' ? 'w-4' : ''}`}
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
              className="mt-6 text-slate-500 dark:text-slate-400 text-lg uppercase tracking-widest font-medium"
            >
              Initializing System Access
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
      
      {isBirthdayToday && (
         <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {[...Array(20)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-3 h-3 bg-amber-400 rounded-sm"
                initial={{ 
                  x: Math.random() * window.innerWidth, 
                  y: -20,
                  rotate: 0,
                  opacity: 1
                }}
                animate={{ 
                  y: window.innerHeight + 20,
                  rotate: 360,
                  opacity: 0
                }}
                transition={{ 
                  duration: 2 + Math.random() * 3,
                  repeat: Infinity,
                  delay: Math.random() * 2,
                  ease: "linear"
                }}
              />
            ))}
         </div>
      )}
    </motion.div>
  );
};
export default WelcomeScreen;
