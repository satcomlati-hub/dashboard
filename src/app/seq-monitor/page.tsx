import { auth } from '@/lib/auth';
import SeqMonitor from '@/components/seq/SeqMonitor';

export const dynamic = 'force-dynamic';

export default async function SeqMonitorPage() {
  const session = await auth();
  const isAdmin = session?.user?.role === 'admin';

  return (
    <div className="container mx-auto py-6">
      <SeqMonitor isAdmin={isAdmin} />
    </div>
  );
}
