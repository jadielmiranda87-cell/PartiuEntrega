import { useContext } from 'react';
import { AuthContext } from '@/contexts/AuthContext';

export function useAppAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAppAuth must be used within AuthProvider');
  return ctx;
}
