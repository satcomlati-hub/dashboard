import { auth } from '@/lib/auth';
import AnalyticsClientPage from './AnalyticsClientPage';

export default async function AnalyticsPage() {
  const session = await auth();
  const isAdmin = session?.user?.role === 'admin';

  return <AnalyticsClientPage isAdmin={isAdmin} />;
}
