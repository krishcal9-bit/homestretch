import Link from 'next/link';
import { IsoHouse } from '@/components/illustrations/IsoHouse';
import { ReadyCount } from '@/components/staff/ReadyCount';
import { monthName } from '@/lib/format';
import { loadFamilies, loadHomes } from '@/lib/staffData';
import { homeCounts, homeInsight } from '@/lib/staffLogic';

// Each home carries the isometric house (static, brass door). On a desktop pointer, hovering the row lifts
// the house 2px (160ms); nothing on touch, nothing with reduced motion.
const LIFT =
  'inline-flex shrink-0 transition-transform duration-[160ms] ease-[var(--ease-out)] [@media(hover:hover)_and_(pointer:fine)_and_(prefers-reduced-motion:no-preference)]:group-hover:[transform:translateY(-2px)]';

export default async function HomesPage() {
  const [homes, families] = await Promise.all([loadHomes(), loadFamilies()]);
  const rows = homes.map((h) => ({ h, ...homeCounts(h, families) }));
  const lead = rows.find((r) => r.projected >= 3) ?? rows.slice().sort((a, b) => b.projected - a.projected)[0];

  return (
    <>
      <h1 className="t-title">Homes</h1>
      <p className="mt-1 text-[15px] text-ink-2">
        <span className="tnum">{homes.length}</span> upcoming homes. Counts include eligible families whose household fits the bedrooms.
      </p>
      {lead && lead.projected > 0 && (
        <p className="mt-6 border-l-2 border-pine pl-3 text-[20px] leading-[28px]" data-testid="homes-insight">
          {homeInsight(lead.h, families)}
        </p>
      )}
      {homes.length === 0 ? (
        <div className="panel mt-8 py-12 text-center text-[15px] text-ink-2">No homes yet. Add upcoming builds to see who could be ready for them.</div>
      ) : (
        <table className="mt-8 w-full border-collapse text-left text-[15px]">
          <thead>
            <tr className="border-b border-line text-[13px] text-ink-2">
              <th scope="col" className="py-2 pl-[84px] pr-3 font-medium">Address</th>
              <th scope="col" className="px-3 py-2 font-medium">City</th>
              <th scope="col" className="px-3 py-2 text-right font-medium">Bedrooms</th>
              <th scope="col" className="px-3 py-2 font-medium">Completion</th>
              <th scope="col" className="px-3 py-2 font-medium">Status</th>
              <th scope="col" className="px-3 py-2 font-medium">Families ready by completion</th>
              <th scope="col" className="px-3 py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ h, projected, readyNow }) => (
              <tr key={h.id} className="group border-b border-line" data-testid="home-row" data-home={h.id} data-ready-count={projected} data-ready-now={readyNow}>
                <td className="whitespace-nowrap px-3 py-2 font-medium">
                  <div className="flex items-center gap-4">
                    <span className={LIFT}>
                      <IsoHouse size={56} doorBrass={false} />
                    </span>
                    {h.address}
                  </div>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-ink-2">{h.city}</td>
                <td className="tnum px-3 py-3 text-right">{h.bedrooms}</td>
                <td className="tnum whitespace-nowrap px-3 py-3">{monthName(h.completion, 'en', true)}</td>
                <td className="px-3 py-3 text-ink-2">{h.status}</td>
                <td className="px-3 py-3">
                  <ReadyCount projected={projected} readyNow={readyNow} />
                </td>
                <td className="px-3 py-1 text-right">
                  <Link href={`/staff/match?home=${h.id}`} className="inline-flex min-h-[44px] items-center whitespace-nowrap rounded-[8px] px-3 text-[15px] font-medium text-pine hover:bg-pine-soft">
                    Match families
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
