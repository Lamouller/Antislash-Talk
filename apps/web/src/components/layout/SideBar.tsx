import { useEffect, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Home, ListMusic, Mic, Settings, LogOut, User, Sparkles, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import { useTranslation } from 'react-i18next';

export default function SideBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<any>(null);
  const { t } = useTranslation();

  const navItems = [
    { href: '/tabs', label: t('nav.home'), icon: Home, exact: true },
    { href: '/tabs/meetings', label: t('nav.meetings'), icon: ListMusic, exact: false },
    { href: '/tabs/record', label: t('nav.record'), icon: Mic, exact: true },
    { href: '/tabs/upload', label: t('nav.upload'), icon: Upload, exact: true },
    { href: '/tabs/prompts', label: t('nav.prompts') || 'Atelier Prompts', icon: Sparkles, exact: true },
    { href: '/tabs/settings', label: t('nav.settings'), icon: Settings, exact: true },
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
      <div className="flex flex-col flex-grow bg-white/20 backdrop-blur-xl border-r border-gray-300/30 overflow-y-auto pt-safe pb-safe">
        {/* Logo Section with safe area */}
        <div className="flex items-center flex-shrink-0 px-6 py-6 border-b border-gray-300/30">
          <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center mr-3 shadow-lg shadow-black/10">
            <Mic className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-black">
              Antislash Talk
            </h1>
            <p className="text-sm text-gray-500">{t('nav.subtitle')}</p>
          </div>
        </div>

        {/* Quick Record Button */}
        <div className="px-6 py-4">
          <NavLink to="/tabs/record">
            <Button className="w-full bg-black text-white shadow-lg shadow-black/10 hover:bg-gray-800 active:scale-[0.98] transition-all duration-200 rounded-xl">
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
                    ? 'bg-black text-white shadow-lg shadow-black/10'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-black'
                    }`;
                }}
              >
                    <>
                  <div className={`p-2 rounded-lg mr-3 transition-all duration-200 ${isItemActive
                        ? 'bg-white/20'
                        : 'bg-gray-100/80 group-hover:bg-gray-200'
                        }`}>
                    <IconComponent className={`w-5 h-5 ${isItemActive ? 'text-white' : 'text-gray-600 group-hover:text-black'
                          }`} />
                      </div>
                      <span className="font-medium flex-1">
                        {item.label}
                      </span>
                  {isItemActive && (
                        <div className="w-2 h-2 rounded-full bg-white shadow-sm"></div>
                      )}
                    </>
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom Section - User Info */}
        <div className="flex-shrink-0 p-4 border-t border-gray-300/30">
          {user && (
            <div className="group relative bg-white/20 backdrop-blur-sm rounded-xl border border-gray-300/30 p-4 mb-4 hover:bg-white/40 transition-all duration-200">
              <div className="flex items-center">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <User className="w-5 h-5 text-gray-600" />
                </div>
                <div className="ml-3 flex-1 min-w-0">
                  <p className="text-sm font-medium text-black truncate">
                    {user.user_metadata?.full_name || user.email?.split('@')[0] || t('common.user')}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {user.email}
                  </p>
                </div>
              </div>

              {/* Badge */}
              <div className="mt-3 flex items-center justify-between">
                <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-gray-100 border border-gray-200 text-xs font-medium text-gray-700">
                  <Sparkles className="w-3 h-3 mr-1" />
                  {t('common.community')}
                </div>
                <button
                  onClick={handleSignOut}
                  className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50 transition-all duration-200"
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
