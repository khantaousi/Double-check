import React from 'react';

interface BirthdayBalloonsProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

/**
 * BirthdayBalloons Component
 * Floats festive multi-colored balloons above a birthday celebrant's profile picture / avatar,
 * replicating Google's signature birthday celebration balloon animation.
 */
export function BirthdayBalloons({ className = '', size = 'md' }: BirthdayBalloonsProps) {
  const isSm = size === 'sm';
  const isLg = size === 'lg';

  // Scale factors
  const scaleClass = isSm ? 'scale-75 -top-6' : isLg ? 'scale-110 -top-10' : '-top-8';

  return (
    <div 
      className={`pointer-events-none select-none absolute left-1/2 -translate-x-1/2 ${scaleClass} z-20 flex items-center justify-center ${className}`}
      aria-hidden="true"
    >
      <div className="relative w-12 h-10 flex justify-center">
        {/* Red Balloon - Left Float */}
        <div 
          className="absolute -left-2 top-0 animate-balloon-float-1 origin-bottom"
          style={{ animationDuration: '3.2s', animationIterationCount: 'infinite' }}
        >
          {/* Balloon Body */}
          <div className="w-4.5 h-5.5 rounded-[50%_50%_50%_50%/60%_60%_40%_40%] bg-gradient-to-tr from-rose-600 via-rose-500 to-pink-300 shadow-[0_2px_6px_rgba(225,29,72,0.4)] relative">
            {/* Highlight glare */}
            <div className="absolute top-1 left-1 w-1.5 h-2 bg-white/70 rounded-full rotate-[-30deg] blur-[0.3px]" />
            {/* Knot */}
            <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-0.5 bg-rose-700 rounded-xs" />
          </div>
          {/* String */}
          <svg className="w-2 h-4 overflow-visible -mt-0.5 mx-auto" viewBox="0 0 8 16" fill="none">
            <path d="M4 0 C2 5, 6 10, 4 16" stroke="rgba(148, 163, 184, 0.7)" strokeWidth="0.8" />
          </svg>
        </div>

        {/* Yellow/Gold Balloon - Center Floating Highest */}
        <div 
          className="absolute left-3.5 -top-2 animate-balloon-float-2 origin-bottom"
          style={{ animationDuration: '2.8s', animationIterationCount: 'infinite' }}
        >
          <div className="w-5 h-6 rounded-[50%_50%_50%_50%/60%_60%_40%_40%] bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-200 shadow-[0_2px_6px_rgba(245,158,11,0.45)] relative">
            <div className="absolute top-1 left-1 w-1.5 h-2 bg-white/80 rounded-full rotate-[-30deg] blur-[0.3px]" />
            <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-0.5 bg-amber-600 rounded-xs" />
          </div>
          <svg className="w-2 h-4 overflow-visible -mt-0.5 mx-auto" viewBox="0 0 8 16" fill="none">
            <path d="M4 0 C5 5, 3 11, 4 16" stroke="rgba(148, 163, 184, 0.7)" strokeWidth="0.8" />
          </svg>
        </div>

        {/* Blue / Teal Balloon - Right Float */}
        <div 
          className="absolute left-8 top-0.5 animate-balloon-float-3 origin-bottom"
          style={{ animationDuration: '3.6s', animationIterationCount: 'infinite' }}
        >
          <div className="w-4 h-5 rounded-[50%_50%_50%_50%/60%_60%_40%_40%] bg-gradient-to-tr from-blue-600 via-sky-400 to-cyan-200 shadow-[0_2px_6px_rgba(37,99,235,0.4)] relative">
            <div className="absolute top-0.5 left-0.5 w-1 h-1.5 bg-white/70 rounded-full rotate-[-30deg] blur-[0.3px]" />
            <div className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-0.5 bg-blue-700 rounded-xs" />
          </div>
          <svg className="w-2 h-4 overflow-visible -mt-0.5 mx-auto" viewBox="0 0 8 16" fill="none">
            <path d="M4 0 C3 5, 5 10, 3 16" stroke="rgba(148, 163, 184, 0.7)" strokeWidth="0.8" />
          </svg>
        </div>

        {/* Floating Confetti / Sparkle Particle */}
        <span className="absolute -top-1.5 left-1 w-1 h-1 bg-yellow-400 rounded-full animate-ping opacity-75" />
        <span className="absolute -top-3 right-1 w-1 h-1 bg-pink-400 rounded-full animate-pulse opacity-90" />
      </div>
    </div>
  );
}
