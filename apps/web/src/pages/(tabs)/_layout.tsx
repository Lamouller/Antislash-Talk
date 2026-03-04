import { Outlet } from 'react-router-dom';
import NavBar from '../../components/layout/NavBar';
import SideBar from '../../components/layout/SideBar';

export default function TabsLayout() {
  return (
    <div className="min-h-screen min-h-screen-safe bg-[#F5F5F7]">
      {/* iOS overscroll background - extends beyond viewport to cover bounce area */}
      <div
        className="fixed inset-x-0 -top-[200px] h-[300px] bg-[#F5F5F7] pointer-events-none z-30 md:hidden"
        aria-hidden="true"
      />
      
      {/* Desktop Sidebar */}
      <SideBar />
      
      {/* Main content area */}
      <div className="md:ml-64 flex flex-col h-screen overflow-hidden">
        {/* Mobile Navigation with Safe Area - Fixed position */}
        <NavBar />
        
        {/* Spacer for fixed top bar on mobile (h-12 = 3rem) */}
        <div
          className="md:hidden flex-shrink-0"
          style={{ height: 'calc(env(safe-area-inset-top, 0px) + 3rem)' }}
        />

        {/* Main content with safe area margins and bottom padding for tab bar */}
        <main className="flex-1 px-safe pb-28 md:pb-0 overflow-y-auto overscroll-none">
          <Outlet />
        </main>
      </div>
    </div>
  );
}