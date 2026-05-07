
export const getInitials = (name?: string | null) => {
  if (!name) return '?';
  const trimmed = name.trim();
  if (trimmed.length === 0) return '?';
  return trimmed.charAt(0).toUpperCase();
};

export const getAvatarColor = (name?: string | null) => {
  if (!name) return 'bg-slate-500';
  const colors = [
    'bg-blue-500',
    'bg-emerald-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-indigo-500',
    'bg-violet-500',
    'bg-cyan-500',
    'bg-orange-500',
  ];
  
  // A simple hash to keep the color consistent for the same name
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};
