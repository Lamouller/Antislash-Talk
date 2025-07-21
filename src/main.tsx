import React from 'react';
import ReactDOM from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './index.css';

import RootLayout from './pages/_layout';
import TabsLayout from './pages/(tabs)/_layout';
import AuthLayout from './pages/auth/_layout';
import ReportLayout from './pages/report/_layout';

import HomeScreen from './pages/index';
import AuthIndex from './pages/auth';
import LoginScreen from './pages/auth/login';
import RegisterScreen from './pages/auth/register';
import ForgotPasswordScreen from './pages/auth/forgot-password';

import TabsIndex from './pages/(tabs)';
import MeetingsScreen from './pages/(tabs)/meetings';
import RecordScreen from './pages/(tabs)/record';
import SettingsScreen from './pages/(tabs)/settings';
import MeetingDetailPage from './pages/(tabs)/meeting/[id]';

import ReportIndexScreen from './pages/report';
import GenerateReportScreen from './pages/report/generate';
import ViewReportScreen from './pages/report/view';

import NotFoundScreen from './pages/+not-found';

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <HomeScreen /> },
      {
        path: 'auth',
        element: <AuthLayout />,
        children: [
          { index: true, element: <AuthIndex /> },
          { path: 'login', element: <LoginScreen /> },
          { path: 'register', element: <RegisterScreen /> },
          { path: 'forgot-password', element: <ForgotPasswordScreen /> },
        ],
      },
      {
        path: 'tabs',
        element: <TabsLayout />,
        children: [
          { index: true, element: <TabsIndex /> },
          { path: 'meetings', element: <MeetingsScreen /> },
          { path: 'record', element: <RecordScreen /> },
          { path: 'settings', element: <SettingsScreen /> },
          { path: 'meeting/:id', element: <MeetingDetailPage /> },
        ],
      },
      {
        path: 'report',
        element: <ReportLayout />,
        children: [
          { index: true, element: <ReportIndexScreen /> },
          { path: 'generate', element: <GenerateReportScreen /> },
          { path: 'view', element: <ViewReportScreen /> },
        ],
      },
      { path: '*', element: <NotFoundScreen /> },
    ],
  },
]);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
