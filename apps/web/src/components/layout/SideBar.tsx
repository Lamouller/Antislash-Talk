import { useEffect, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Home, ListMusic, FilePlus, Settings, LogOut, User, Mic, Sparkles, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { useTranslation } from 'react-i18next';

export default function SideBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<any>(null);
  const { t } = useTranslation();

  const navItems = [
    { href: '/tabs', label: t('nav.home'), icon: Home, color: 'from-blue-500 to-indigo-600', exact: true },
    { href: '/tabs/meetings', label: t('nav.meetings'), icon: ListMusic, color: 'from-green-500 to-emerald-600', exact: false },
    { href: '/tabs/record', label: t('nav.record'), icon: FilePlus, color: 'from-purple-500 to-pink-600', exact: true },
    { href: '/tabs/upload', label: t('nav.upload'), icon: Upload, color: 'from-pink-500 to-rose-600', exact: true },
    { href: '/tabs/prompts', label: t('nav.prompts') || 'Atelier Prompts', icon: Sparkles, color: 'from-yellow-500 to-orange-600', exact: true },
    { href: '/tabs/settings', label: t('nav.settings'), icon: Settings, color: 'from-orange-500 to-red-600', exact: true },
  ];

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    }
    getUser();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth/login');
  };

  return (
    <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 pl-safe">
      <div className="flex flex-col flex-grow bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-r border-gray-200/50 dark:border-gray-700/50 shadow-xl overflow-y-auto pt-safe pb-safe">
        {/* Logo Section with safe area */}
        <div className="flex items-center flex-shrink-0 px-6 py-6 border-b border-gray-200/50 dark:border-gray-700/50">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center mr-3 shadow-lg">
            <Mic className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-gray-900 to-blue-800 dark:from-white dark:to-blue-200 bg-clip-text text-transparent">
              Antislash Talk
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">{t('nav.subtitle')}</p>
          </div>
        </div>

        {/* Quick Record Button */}
        <div className="px-6 py-4">
          <NavLink to="/tabs/record">
            <Button className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5 rounded-xl">
              <Mic className="w-5 h-5 mr-2" />
              {t('common.startRecording')}
            </Button>
          </NavLink>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 pb-4 space-y-2">
          {navItems.map((item) => {
            const IconComponent = item.icon;
            
            // Custom active logic: check if current path matches
            const isItemActive = item.exact 
              ? location.pathname === item.href
              : location.pathname.startsWith(item.href);

            return (
              <NavLink
                key={item.href}
                to={item.href}
                end={item.exact}
                className={() => {
                  return `group flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${isItemActive
                    ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 text-blue-700 dark:text-blue-300 shadow-md border border-blue-200/50 dark:border-blue-700/50'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50/80 dark:hover:bg-gray-800/50 hover:text-blue-600 dark:hover:text-blue-400'
                    }`;
                }}
              >
                    <>
                  <div className={`p-2 rounded-lg mr-3 transition-all duration-200 ${isItemActive
                        ? `bg-gradient-to-r ${item.color} shadow-lg`
                        : 'bg-gray-100 dark:bg-gray-700 group-hover:bg-gray-200 dark:group-hover:bg-gray-600'
                        }`}>
                    <IconComponent className={`w-5 h-5 ${isItemActive ? 'text-white' : 'text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                          }`} />
                      </div>
                      <span className="font-medium flex-1">
                        {item.label}
                      </span>
                  {isItemActive && (
                        <div className="w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 shadow-sm"></div>
                      )}
                    </>
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom Section - User Info */}
        <div className="flex-shrink-0 p-4 border-t border-gray-200/50 dark:border-gray-700/50">
          {user && (
            <div className="group relative bg-gray-50/50 dark:bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-200/50 dark:border-gray-700/50 p-4 mb-4 hover:bg-white/80 dark:hover:bg-gray-800/80 transition-all duration-200">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-green-500 to-emerald-600 flex items-center justify-center shadow-lg">
                  <User className="w-5 h-5 text-white" />
                </div>
                <div className="ml-3 flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {user.user_metadata?.full_name || user.email?.split('@')[0] || t('common.user')}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {user.email}
                  </p>
                </div>
              </div>

              {/* Premium Badge */}
              <div className="mt-3 flex items-center justify-between">
                <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 text-xs font-medium text-white shadow-sm">
                  <Sparkles className="w-3 h-3 mr-1" />
                  {t('common.community')}
                </div>
                <button
                  onClick={handleSignOut}
                  className="p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200"
                  title={t('settings.logout')}
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}