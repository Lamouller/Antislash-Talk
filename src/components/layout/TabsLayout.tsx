
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Home, ListMusic, FilePlus, Settings } from 'lucide-react';

const navItems = [
  { path: '/', label: 'Home', icon: Home },
  { path: '/meetings', label: 'Meetings', icon: ListMusic },
  { path: '/record', label: 'Record', icon: FilePlus },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function TabsLayout() {
  const location = useLocation();

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-900">
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <nav className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
        <div className="flex justify-around max-w-md mx-auto">
          {navItems.map(({ path, label, icon: Icon }) => {
            const isActive = location.pathname === path;
            return (
              <Link
                key={path}
                to={path}
                className={`flex flex-col items-center justify-center w-full pt-2 pb-1 text-sm font-medium transition-colors ${
                  isActive
                    ? 'text-indigo-600'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                <Icon size={24} />
                <span>{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
} 