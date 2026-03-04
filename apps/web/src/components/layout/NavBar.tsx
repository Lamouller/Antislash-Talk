import { NavLink, useLocation } from 'react-router-dom';
import { Home, FileText, Mic, Upload, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function NavBar() {
  const { t } = useTranslation();
  const location = useLocation();

  // Derive a simple page title from the current route
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/tabs' || path === '/tabs/') return t('nav.home');
    if (path.startsWith('/tabs/meetings') || path.startsWith('/tabs/meeting')) return t('nav.meetings');
    if (path === '/tabs/record') return t('nav.record');
    if (path === '/tabs/upload') return t('nav.upload');
    if (path === '/tabs/settings') return t('nav.settings');
    if (path === '/tabs/prompts') return t('nav.prompts') || 'Atelier Prompts';
    return 'Antislash Talk';
  };

  const tabItems = [
    { href: '/tabs', label: t('nav.home'), icon: Home, exact: true },
    { href: '/tabs/meetings', label: t('nav.meetings'), icon: FileText, exact: false },
    { href: '/tabs/record', label: t('nav.record'), icon: Mic, exact: true, isCenter: true },
    { href: '/tabs/upload', label: t('nav.upload'), icon: Upload, exact: true },
    { href: '/tabs/settings', label: t('nav.settings'), icon: Settings, exact: true },
  ];

  return (
    <>
      {/* Top bar - simplified, just the page title (mobile only) */}
      <nav
        className="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 md:hidden fixed top-0 left-0 right-0 z-40"
        style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
      >
        <div
          className="flex items-center justify-center h-12"
          style={{
            paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
            paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
          }}
        >
          <span className="font-semibold text-base text-black">
            {getPageTitle()}
          </span>
        </div>
      </nav>

      {/* Bottom tab bar (mobile only) */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="bg-white/80 backdrop-blur-xl border-t border-gray-200/50">
          <div
            className="flex items-end justify-around px-2 pt-1 pb-1"
            style={{
              paddingLeft: 'max(0.25rem, env(safe-area-inset-left, 0px))',
              paddingRight: 'max(0.25rem, env(safe-area-inset-right, 0px))',
            }}
          >
            {tabItems.map((item) => {
              const IconComponent = item.icon;

              // Active state logic matching SideBar
              const isActive = item.exact
                ? location.pathname === item.href
                : location.pathname.startsWith(item.href);

              if (item.isCenter) {
                // Center Record button - accentuated, raised
                return (
                  <NavLink
                    key={item.href}
                    to={item.href}
                    className="flex flex-col items-center justify-center -translate-y-3 transition-all duration-200"
                  >
                    <div
                      className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg transition-all duration-200 ${
                        isActive
                          ? 'bg-black shadow-black/20 scale-105'
                          : 'bg-black shadow-black/15'
                      }`}
                    >
                      <IconComponent className="w-6 h-6 text-white" />
                    </div>
                    <span
                      className={`text-[10px] font-medium mt-1 transition-all duration-200 ${
                        isActive ? 'text-black' : 'text-gray-400'
                      }`}
                    >
                      {item.label}
                    </span>
                  </NavLink>
                );
              }

              // Standard tab item
              return (
                <NavLink
                  key={item.href}
                  to={item.href}
                  end={item.exact}
                  className="flex flex-col items-center justify-center py-1.5 px-1 min-w-[56px] transition-all duration-200"
                >
                  <IconComponent
                    className={`w-5 h-5 transition-all duration-200 ${
                      isActive ? 'text-black' : 'text-gray-400'
                    }`}
                  />
                  <span
                    className={`text-[10px] font-medium mt-0.5 transition-all duration-200 ${
                      isActive ? 'text-black' : 'text-gray-400'
                    }`}
                  >
                    {item.label}
                  </span>
                  {/* Active dot indicator */}
                  {isActive && (
                    <div className="w-1 h-1 rounded-full bg-black mt-0.5 transition-all duration-200" />
                  )}
                </NavLink>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
