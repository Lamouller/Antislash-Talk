import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, ListMusic, FilePlus, Settings, Menu, X, Mic, Upload, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function NavBar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { t } = useTranslation();

  const navItems = [
    { href: '/tabs', label: t('nav.home'), icon: Home },
    { href: '/tabs/meetings', label: t('nav.meetings'), icon: ListMusic },
    { href: '/tabs/record', label: t('nav.record'), icon: FilePlus },
    { href: '/tabs/upload', label: t('nav.upload'), icon: Upload },
    { href: '/tabs/prompts', label: t('nav.prompts') || 'Atelier Prompts', icon: Sparkles },
    { href: '/tabs/settings', label: t('nav.settings'), icon: Settings },
  ];

  return (
    <nav
      className="bg-white/80 backdrop-blur-xl border-b border-gray-300/30 shadow-lg shadow-black/5 md:hidden fixed top-0 left-0 right-0 z-50"
      style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" style={{ paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))', paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))' }}>
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center">
              <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center mr-3 shadow-lg shadow-black/10">
                <Mic className="w-6 h-6 text-white" />
              </div>
              <span className="font-bold text-xl text-black">
                Antislash Talk
              </span>
            </div>
          </div>
          <div className="-mr-2 flex">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              type="button"
              className="relative inline-flex items-center justify-center p-2 rounded-xl bg-white/20 backdrop-blur-sm border border-gray-300/30 text-gray-600 hover:text-black hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black/20 focus:ring-offset-2 transition-all duration-200 shadow-sm"
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
        <div id="mobile-menu" className="absolute top-full left-0 right-0 bg-white/90 backdrop-blur-xl border border-gray-300/30 rounded-b-2xl shadow-2xl shadow-black/10">
          <div className="px-2 pt-2 pb-3 space-y-2 sm:px-3">
            {navItems.map((item) => {
              const IconComponent = item.icon;

              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={({ isActive }) => {
                    const active = isActive;
                    return `group flex items-center px-4 py-3 rounded-xl text-base font-medium transition-all duration-200 ${active
                        ? 'bg-black text-white shadow-lg shadow-black/10'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-black'
                      }`;
                  }}
                >
                  {({ isActive }) => {
                    const active = isActive;
                    return (
                      <>
                        <div className={`p-2 rounded-lg mr-3 transition-all duration-200 ${active
                            ? 'bg-white/20'
                            : 'bg-gray-100/80 group-hover:bg-gray-200'
                          }`}>
                          <IconComponent className={`w-5 h-5 ${active ? 'text-white' : 'text-gray-600 group-hover:text-black'
                            }`} />
                        </div>
                        <span className="font-medium">
                          {item.label}
                        </span>
                        {active && (
                          <div className="ml-auto w-2 h-2 rounded-full bg-white shadow-sm"></div>
                        )}
                      </>
                    );
                  }}
                </NavLink>
              );
            })}
          </div>

          {/* Quick Action in Mobile Menu */}
          <div className="px-4 py-3 border-t border-gray-300/30">
            <NavLink
              to="/tabs/record"
              onClick={() => setIsMobileMenuOpen(false)}
              className="w-full flex items-center justify-center px-4 py-3 rounded-xl bg-black text-white font-medium shadow-lg shadow-black/10 hover:bg-gray-800 active:scale-[0.98] transition-all duration-200"
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
