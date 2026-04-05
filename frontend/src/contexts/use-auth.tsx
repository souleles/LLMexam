import { useLogoutProfile } from '@/hooks/use-logout';
import { useGetProfile } from '@/hooks/use-profile';
import { useQueryClient } from '@tanstack/react-query';
import * as jose from 'jose';
import { createContext, useContext } from 'react';
import { useNavigate } from 'react-router-dom';

type AuthContent = {
  user: { username: string } | undefined;
  login: (a: string) => void;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  authLoading: boolean;
}

export const AuthContext = createContext<AuthContent>({
  user: undefined,
  login: () => { },
  logout: () => Promise.resolve(),
  isAuthenticated: false,
  authLoading: true,
});

export const AuthProvider = ({ children }: any) => {
  const { data: user, isLoading, refetch } = useGetProfile();
  const { mutateAsync: logoutUser } = useLogoutProfile();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const login = async (access_token: string) => {
    try {
      const decodedToken = jose.decodeJwt(access_token || '');
      console.log(decodedToken);

      const userInfo = decodedToken.userInfo;
      queryClient.setQueryData(['profile'], () => userInfo);
      // refetch();
      navigate('/', { replace: true });
    } catch (error) {
      console.error(error);
    }
  };

  const logout = async () => {
    try {
      await logoutUser();
    } catch (error) {
      console.error(error);
    }
  };

  const isAuthenticated = !!user;

  return (
    <AuthContext.Provider
      value={{ user: user, login, logout, isAuthenticated, authLoading: isLoading }}
    >
      {children}
    </AuthContext.Provider>
  );
};

AuthProvider.context = AuthContext;

export const useAuthContext = () => useContext(AuthContext);
