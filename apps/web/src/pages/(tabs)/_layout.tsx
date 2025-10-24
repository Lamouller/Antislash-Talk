import { Outlet } from 'react-router-dom';
import NavBar from '../../components/layout/NavBar';
import SideBar from '../../components/layout/SideBar';

export default function TabsLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-gray-900 dark:via-slate-800 dark:to-gray-900">
      <SideBar />
      <div className="md:ml-64 flex flex-col">
        <NavBar />
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  );
}