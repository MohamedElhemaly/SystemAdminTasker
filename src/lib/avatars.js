export const BUILTIN_AVATARS = [
  { id: 'avatar-1', name: 'Blue Executive', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=BlueExec', color: '#3b82f6' },
  { id: 'avatar-2', name: 'Emerald Engineer', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=EmeraldEng', color: '#10b981' },
  { id: 'avatar-3', name: 'Purple Architect', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=PurpleArch', color: '#8b5cf6' },
  { id: 'avatar-4', name: 'Amber Analyst', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=AmberAnalyst', color: '#f59e0b' },
  { id: 'avatar-5', name: 'Pink Designer', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=PinkDesign', color: '#ec4899' },
  { id: 'avatar-6', name: 'Cyan SysAdmin', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=CyanAdmin', color: '#06b6d4' },
  { id: 'avatar-7', name: 'Indigo Manager', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=IndigoMgr', color: '#6366f1' },
  { id: 'avatar-8', name: 'Rose Reviewer', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=RoseRev', color: '#f43f5e' },
  { id: 'avatar-9', name: 'Teal Lead', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=TealLead', color: '#14b8a6' },
  { id: 'avatar-10', name: 'Violet Consultant', url: 'https://api.dicebear.com/7.x/bottts/svg?seed=VioletCons', color: '#7c3aed' }
];

export const getAvatarUrl = (avatarId, fullName = 'User') => {
  const found = BUILTIN_AVATARS.find(a => a.id === avatarId);
  if (found) return found.url;
  // Fallback SVG avatar
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(fullName)}`;
};
