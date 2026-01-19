import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, ListMusic, FilePlus, Settings, Menu, X, Mic, Upload, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function NavBar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { t } = useTranslation();

  const navItems = [
    { href: '/tabs', label: t('nav.home'), icon: Home, color: 'from-blue-500 to-indigo-600' },
    { href: '/tabs/meetings', label: t('nav.meetings'), icon: ListMusic, color: 'from-green-500 to-emerald-600' },
    { href: '/tabs/record', label: t('nav.record'), icon: FilePlus, color: 'from-purple-500 to-pink-600' },
    { href: '/tabs/upload', label: t('nav.upload'), icon: Upload, color: 'from-pink-500 to-rose-600' },
    { href: '/tabs/prompts', label: t('nav.prompts') || 'Atelier Prompts', icon: Sparkles, color: 'from-yellow-500 to-orange-600' },
    { href: '/tabs/settings', label: t('nav.settings'), icon: Settings, color: 'from-orange-500 to-red-600' },
  ];

  return (
    <nav className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-b border-gray-200/50 dark:border-gray-700/50 shadow-lg md:hidden sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 flex items-center justify-center mr-3 shadow-lg">
                <Mic className="w-6 h-6 text-white" />
              </div>
              <span className="font-bold text-xl bg-gradient-to-r from-gray-900 to-blue-800 dark:from-white dark:to-blue-200 bg-clip-text text-transparent">
                Antislash Talk
              </span>
            </div>
          </div>
          <div className="-mr-2 flex">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              type="button"
              className="relative inline-flex items-center justify-center p-2 rounded-xl bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border border-gray-200/50 dark:border-gray-700/50 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white/80 dark:hover:bg-gray-800/80 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-lg"
              aria-controls="mobile-menu"
              aria-expanded={isMobileMenuOpen}
            >
              <span className="sr-only">Open main menu</span>
              {isMobileMenuOpen ? (
                <X className="block h-6 w-6" aria-hidden="true" />
              ) : (
                <Menu className="block h-6 w-6" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div id="mobile-menu" className="absolute top-full left-0 right-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-700/50 shadow-xl">
          <div className="px-2 pt-2 pb-3 space-y-2 sm:px-3">
            {navItems.map((item) => {
              const IconComponent = item.icon;

              return (
                <NavLink
                  key={item.href} // Changed key to href since label is translated
                  to={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) => {
                    const active = isActive; // Utiliser SEULEMENT notre logique custom
                    return `group flex items-center px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${active
                        ? 'bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 text-blue-700 dark:text-blue-300 shadow-md border border-blue-200/50 dark:border-blue-700/50'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50/80 dark:hover:bg-gray-800/50 hover:text-blue-600 dark:hover:text-blue-400'
                      }`;
                  }}
                >
                  {({ isActive }) => {
                    const active = isActive; // Utiliser SEULEMENT notre logique custom
                    return (
                      <>
                        <div className={`p-2 rounded-lg mr-3 transition-all duration-200 ${active
                            ? `bg-gradient-to-r ${item.color} shadow-lg`
                            : 'bg-gray-100 dark:bg-gray-700 group-hover:bg-gray-200 dark:group-hover:bg-gray-600'
                          }`}>
                          <IconComponent className={`w-5 h-5 ${active ? 'text-white' : 'text-gray-600 dark:text-gray-400 group-hover:text-blue-600 dark:group-hover:text-blue-400'
                            }`} />
                        </div>
                        <span className="font-medium">
                          {item.label}
                        </span>
                        {active && (
                          <div className="ml-auto w-2 h-2 rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 shadow-sm"></div>
                        )}
                      </>
                    );
                  }}
                </NavLink>
              );
            })}
          </div>

          {/* Quick Action in Mobile Menu */}
          <div className="px-4 py-3 border-t border-gray-200/50 dark:border-gray-700/50">
            <NavLink
              to="/tabs/record"
              onClick={() => setIsMobileMenuOpen(false)}
              className="w-full flex items-center justify-center px-4 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5"
            >
              <Mic className="w-5 h-5 mr-2" />
              {t('common.startRecording')}
            </NavLink>
          </div>
        </div>
      )}
    </nav>
  );
} 