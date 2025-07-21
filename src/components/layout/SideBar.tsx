import { Link, useLocation } from 'react-router-dom';
import { Home, ListMusic, FilePlus, Settings } from 'lucide-react';

export default function SideBar() {
  const location = useLocation();

  const navItems = [
    { href: '/tabs', label: 'Home', icon: Home },
    { href: '/tabs/meetings', label: 'Meetings', icon: ListMusic },
    { href: '/tabs/record', label: 'Record', icon: FilePlus },
    { href: '/tabs/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 flex-shrink-0 bg-white dark:bg-gray-800 shadow-md hidden md:block">
      <div className="flex items-center justify-center h-16">
        <p className="font-bold text-xl text-gray-900 dark:text-white">Talk-2-Web</p>
      </div>
      <nav className="mt-5">
        {navItems.map((item) => (
          <Link
            key={item.label}
            to={item.href}
            className={`flex items-center px-6 py-3 text-sm font-medium ${
              location.pathname === item.href
                ? 'bg-gray-900 text-white'
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
          >
            <item.icon className="mr-3 h-6 w-6" />
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
} 