import { Link, useLocation } from 'react-router-dom';
import { signOut, type User } from 'firebase/auth';
import { auth } from '../firebase';
import { Home, Store, MessageSquare, User as UserIcon, LogOut, LogIn } from 'lucide-react';

interface NavbarProps {
  user: User | null;
}

const Navbar = ({ user }: NavbarProps) => {
  const location = useLocation();
  
  // Dynamic profile path based on login status
  const profilePath = user ? `/profile/${user.uid}` : '/login';
  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/store', icon: Store, label: 'Store' },
    { path: '/forum', icon: MessageSquare, label: 'Forum' },
    { path: profilePath, icon: UserIcon, label: 'Profile' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 pb-safe pt-2 px-4 flex justify-around items-center md:top-0 md:bottom-auto md:border-b md:h-16 md:px-8 z-50">
      {/* Navigation Links */}
      <div className="flex justify-around flex-1 md:justify-start md:gap-8">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex flex-col items-center p-2 transition-colors ${
              isActive(item.path) ? 'text-blue-600' : 'text-slate-500 hover:text-blue-400'
            }`}
          >
            <item.icon size={24} strokeWidth={isActive(item.path) ? 2.5 : 2} />
            <span className="text-xs mt-1 font-medium">{item.label}</span>
          </Link>
        ))}
      </div>

      {/* User Info & Auth Action */}
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
              onClick={() => signOut(auth)}
              className="flex flex-col items-center p-2 text-slate-500 hover:text-red-600 transition-colors"
              title="Logout"
            >
              <LogOut size={24} />
              <span className="text-xs mt-1 font-medium">Logout</span>
            </button>
          </>
        ) : (
          <Link 
            to="/login"
            className="flex flex-col items-center p-2 text-slate-500 hover:text-blue-600 transition-colors"
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