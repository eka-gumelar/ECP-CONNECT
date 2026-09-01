'use client';

import { useAuth } from '@/components/AuthProvider';
import AuthScreen from '@/components/AuthScreen';
import ChatApp from '@/components/ChatApp';

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return <ChatApp />;
}
