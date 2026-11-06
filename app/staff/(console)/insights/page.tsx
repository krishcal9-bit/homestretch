import { Insights } from '@/components/staff/Insights';
import { loadFamilies, loadHomes } from '@/lib/staffData';

export default async function InsightsPage() {
  const [homes, families] = await Promise.all([loadHomes(), loadFamilies()]);
  return (
    <Insights
      homes={homes}
      families={families.map((f) => ({ profile: f.profile, eligible: f.eligible, monthsToReady: f.result.monthsToReady, blockerType: f.blockerType }))}
    />
  );
}
