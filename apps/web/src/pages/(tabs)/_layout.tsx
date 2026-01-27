import { Outlet } from 'react-router-dom';
import NavBar from '../../components/layout/NavBar';
import SideBar from '../../components/layout/SideBar';

export default function TabsLayout() {
  return (
    <div className="min-h-screen min-h-screen-safe bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-slate-800 dark:to-gray-900">
      {/* Desktop Sidebar */}
      <SideBar />
      
      {/* Main content area */}
      <div className="md:ml-64 flex flex-col min-h-screen">
        {/* Mobile Navigation with Safe Area */}
        <NavBar />
        
        {/* Main content with safe area margins */}
        <main className="flex-1 px-safe">
          <Outlet />
        </main>
        
        {/* Bottom safe area spacer for iOS home indicator */}
        <div className="md:hidden h-[env(safe-area-inset-bottom,0px)] bg-transparent" />
      </div>
    </div>
  );
}