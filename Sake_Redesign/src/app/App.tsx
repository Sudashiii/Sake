import { RouterProvider } from 'react-router';
import { router } from './routes';
import { ShelvesProvider } from './lib/shelves-context';

export default function App() {
  return (
    <ShelvesProvider>
      <RouterProvider router={router} />
    </ShelvesProvider>
  );
}