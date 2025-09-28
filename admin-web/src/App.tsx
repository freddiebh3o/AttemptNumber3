// admin-web/src/App.tsx
import { Outlet } from 'react-router-dom';
import TopLoader from './components/feedback/TopLoader';

export default function App() {
  return (
    <>
      <TopLoader />
      <Outlet />
    </>
  );
}
