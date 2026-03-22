// Navbar.tsx
import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { signOut, type User } from 'firebase/auth';
import { auth } from '../firebase';
import { Home, Store, MessageSquare, User as UserIcon, LogOut, LogIn, Bell } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext';

interface NavbarProps {
  user: User | null;
}

const Navbar = ({ user }: NavbarProps) => {
  const location = useLocation();
  const { userData, userPosts, userGroups } = useNotifications();

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  // Compute Unread Badges
  const { hasNewReplies, hasNewGroupMessages } = useMemo(() => {
    if (!userData || !user) return { hasNewReplies: false, hasNewGroupMessages: false };

    // 1. Check for replies to MY posts
    const unreadPost = userPosts.some(post => {
      const updatedTime = post.lastUpdated?.toMillis() || post.createdAt?.toMillis() || 0;
      const readTime = userData[`last_read_post_${post.id}`]?.toMillis() || 0;
      
      // Ensure the last person to update it wasn't the current user
      const isNotMe = post.lastUpdatedBy && post.lastUpdatedBy !== user.uid;

      // Unread IF: Updated after it was last read AND updater is not the current user.
      // Removed the `prevLogin` check so notifications persist across sessions!
      return isNotMe && updatedTime > readTime;
    });

    // 2. Check for new messages in MY groups
    const unreadGroup = userGroups.some(group => {
      const updatedTime = group.lastUpdated?.toMillis() || 0;
      const readTime = userData[`last_read_group_${group.id}`]?.toMillis() || 0;
      const isNotMe = group.lastUpdatedBy !== user.uid;

      return updatedTime > readTime && isNotMe;
    });

    return { hasNewReplies: unreadPost, hasNewGroupMessages: unreadGroup };
  }, [userData, userPosts, userGroups, user]);

  const profilePath = user ? `/profile/${user.uid}` : '/login';
  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/', icon: Home, label: 'Home', hasBadge: false },
    { path: '/forum', icon: MessageSquare, label: 'Forum', hasBadge: hasNewReplies, badgeColor: 'bg-blue-600' },
    { path: profilePath, icon: UserIcon, label: 'Profile', hasBadge: hasNewGroupMessages, badgeColor: 'bg-emerald-600' },
    { path: '/store', icon: Store, label: 'Store', hasBadge: false },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 pb-safe pt-2 px-4 flex justify-around items-center md:top-0 md:bottom-auto md:border-b md:h-16 md:px-8 z-50">
      <div className="flex justify-around flex-1 md:justify-start md:gap-8">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`relative flex flex-col items-center p-2 transition-colors ${
              isActive(item.path) ? 'text-indigo-600' : 'text-slate-500 hover:text-indigo-400'
            }`}
          >
            <item.icon size={24} strokeWidth={isActive(item.path) ? 2.5 : 2} />
            
            {/* Enhanced Notification Badge */}
            {item.hasBadge && (
              <div className="absolute top-1 right-1 sm:right-2 flex items-center justify-center">
                <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping ${item.badgeColor}`} />
                <div className={`relative flex items-center justify-center w-4 h-4 rounded-full border-2 border-white shadow-sm ${item.badgeColor}`}>
                  <Bell size={8} className="text-white fill-white" />
                </div>
              </div>
            )}
            
            <span className="text-xs mt-1 font-medium">{item.label}</span>
          </Link>
        ))}
      </div>

      <div className="md:absolute md:right-8 flex items-center gap-3">
        {user ? (
          <>
            <div className="hidden sm:flex flex-col items-end mr-2">
              <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold">Logged in</span>
              <span className="text-sm font-semibold text-slate-700">
                {user.displayName || user.email?.split('@')[0]}
              </span>
            </div>
            
            <button 
              onClick={handleLogout}
              className="flex flex-col items-center p-2 text-slate-500 hover:text-rose-600 transition-colors"
              title="Logout"
            >
              <LogOut size={24} />
              <span className="text-xs mt-1 font-medium">Logout</span>
            </button>
          </>
        ) : (
          <Link 
            to="/login"
            className="flex flex-col items-center p-2 text-slate-500 hover:text-indigo-600 transition-colors"
          >
            <LogIn size={24} />
            <span className="text-xs mt-1 font-medium">Login</span>
          </Link>
        )}
      </div>
    </nav>
  );
};

export default Navbar;