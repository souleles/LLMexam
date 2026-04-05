import { useAuthContext } from '@/contexts/use-auth';
import { Navigate } from 'react-router-dom';

export default function ProtectedRoute({ children }: any) {
  const { authLoading, user } = useAuthContext();
  console.log({ user, authLoading });

  if (authLoading && !user) {
    return <div style={{ height: '100vh' }}></div>;
  }

  if (!user) {
    return <Navigate
      to='/login'
      replace
    />;
  }

  return children;
}
