import { createBrowserRouter } from 'react-router';
import { Layout } from './components/layout';
import { LibraryPage } from './pages/library';
import { SearchPage } from './pages/search';
import { QueuePage } from './pages/queue';
import { TrashPage } from './pages/trash';
import { ArchivedPage } from './pages/archived';
import { StatsPage } from './pages/stats';
import { ConnectPage } from './pages/connect';
import { LoginPage } from './pages/login';

export const router = createBrowserRouter([
  {
    path: '/login',
    Component: LoginPage,
  },
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, Component: LibraryPage },
      { path: 'search', Component: SearchPage },
      { path: 'queue', Component: QueuePage },
      { path: 'stats', Component: StatsPage },
      { path: 'archived', Component: ArchivedPage },
      { path: 'trash', Component: TrashPage },
      { path: 'connect', Component: ConnectPage },
    ],
  },
]);