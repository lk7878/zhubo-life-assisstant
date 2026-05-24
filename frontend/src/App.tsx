import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import AnchorListPage from './pages/AnchorListPage';
import AnchorDetailPage from './pages/AnchorDetailPage';
import AnchorFormPage from './pages/AnchorFormPage';
import NodeDetailPage from './pages/NodeDetailPage';
import LibraryPage from './pages/LibraryPage';
import LogsPage from './pages/LogsPage';
import LiveRecordsPage from './pages/LiveRecordsPage';
import TrainingsPage from './pages/TrainingsPage';
import SalariesPage from './pages/SalariesPage';
import ContractsPage from './pages/ContractsPage';
import AssetsPage from './pages/AssetsPage';
import UsersPage from './pages/UsersPage';
import DashboardPage from './pages/DashboardPage';

function App() {
  return (
    <ConfigProvider locale={zhCN}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AnchorListPage />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="anchor/new" element={<AnchorFormPage />} />
            <Route path="anchor/:id" element={<AnchorDetailPage />} />
            <Route path="anchor/:id/edit" element={<AnchorFormPage />} />
            <Route path="node/:id" element={<NodeDetailPage />} />
            <Route path="trainings" element={<TrainingsPage />} />
            <Route path="live-records" element={<LiveRecordsPage />} />
            <Route path="salaries" element={<SalariesPage />} />
            <Route path="contracts" element={<ContractsPage />} />
            <Route path="assets" element={<AssetsPage />} />
            <Route path="library" element={<LibraryPage />} />
            <Route path="logs" element={<LogsPage />} />
            <Route
              path="users"
              element={
                <ProtectedRoute roles={['admin']}>
                  <UsersPage />
                </ProtectedRoute>
              }
            />
          </Route>
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}

export default App;