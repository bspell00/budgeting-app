import { useSession } from 'next-auth/react';
import Dashboard from '../components/Dashboard';
import LandingPage from '../components/LandingPage';

export default function Home() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#86b686] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show landing page for unauthenticated users
  if (!session) {
    return <LandingPage />;
  }

  // Show dashboard for authenticated users
  return <Dashboard />;
}