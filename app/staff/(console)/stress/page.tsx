import { StressTest } from '@/components/staff/StressTest';
import { stressHomes } from '@/lib/earlyWarning';

export default function StressTestPage() {
  const today = new Date();
  return <StressTest homes={stressHomes(today)} today={today.toISOString()} />;
}
