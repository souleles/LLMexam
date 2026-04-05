import { useAuthContext } from '@/contexts/use-auth';
import { Navigate } from 'react-router-dom';

export default function UnprotectedRoute({ children }: any) {
  const { authLoading, user } = useAuthContext();

  if (authLoading && !user) {
    return <div style={{ height: '100vh' }}></div>;
  }

  if (user) {
    return <Navigate
      to='/'
      replace
    />;
  }

  return children;
}
