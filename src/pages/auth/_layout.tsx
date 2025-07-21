import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="flex-1 justify-center items-center bg-gray-100 dark:bg-gray-900">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-lg shadow-md dark:bg-gray-800">
        <Outlet />
      </div>
    </div>
  );
}