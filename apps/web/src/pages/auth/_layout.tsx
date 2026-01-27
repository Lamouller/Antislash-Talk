import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="w-full min-h-screen safe-area-all">
      <Outlet />
    </div>
  );
}