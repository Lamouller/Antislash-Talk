import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="w-full h-full">
      <Outlet />
    </div>
  );
}