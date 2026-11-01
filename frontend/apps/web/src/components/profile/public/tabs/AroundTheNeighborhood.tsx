import type { ReactNode } from 'react';
import { CalendarDays, HandHeart, Lightbulb } from 'lucide-react';
import type * as api from '@pantopus/api';

type Contributions = api.users.ProfileContributions;

const count = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0);

/** Whether the read has anything to show: a section only appears with at least one count above zero. */
export function hasContributions(contributions: Partial<Contributions> | null | undefined): boolean {
  return Boolean(contributions)
    && (count(contributions?.support_trains_helped) > 0 || count(contributions?.plans_hosted) > 0 || count(contributions?.helpful_marks) > 0);
}

function Row({ icon, iconClassName, children }: { icon: ReactNode; iconClassName: string; children: ReactNode }) {
  return (
    <li className="min-h-[3.5rem] px-4 py-2.5 flex items-center gap-3">
      <span aria-hidden="true" className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${iconClassName}`}>
        {icon}
      </span>
      <span className="min-w-0 text-[0.9375rem] leading-5 text-app [overflow-wrap:anywhere]">{children}</span>
    </li>
  );
}

/**
 * About's "Around the neighborhood": what the person has done for neighbors, as the server counts it for everyone who
 * can open the profile (Support Trains they helped on, plans they hosted, Helpful marks on their posts). Only counts
 * above zero; nothing when the read has none.
 */
export default function AroundTheNeighborhood({ firstName, contributions }: { firstName: string; contributions: Partial<Contributions> | null | undefined }) {
  if (!hasContributions(contributions)) return null;
  const trains = count(contributions?.support_trains_helped);
  const plans = count(contributions?.plans_hosted);
  const helpful = count(contributions?.helpful_marks);
  const iconClass = 'w-[1.0625rem] h-[1.0625rem]';

  return (
    <section>
      <h3 className="mb-2.5 text-[1.0625rem] leading-[1.375rem] font-semibold text-app">Around the neighborhood</h3>
      <ul className="rounded-2xl border border-app bg-surface divide-y divide-app overflow-hidden">
        {trains > 0 && (
          <Row icon={<HandHeart className={iconClass} />} iconClassName="bg-app-home-bg text-app-home">
            Helped on <strong className="font-semibold">{trains} {trains === 1 ? 'Support Train' : 'Support Trains'}</strong>
          </Row>
        )}
        {plans > 0 && (
          <Row
            icon={<CalendarDays className={iconClass} />}
            iconClassName="bg-[var(--color-cat-plan-walk-tint)] text-[var(--color-cat-plan-walk)]"
          >
            Hosted <strong className="font-semibold">{plans} {plans === 1 ? 'plan' : 'plans'}</strong>
          </Row>
        )}
        {helpful > 0 && (
          <Row icon={<Lightbulb className={iconClass} />} iconClassName="bg-amber-50 text-amber-700">
            Neighbors marked {firstName}&rsquo;s posts helpful{' '}
            <strong className="font-semibold">{helpful === 1 ? 'once' : `${helpful} times`}</strong>
          </Row>
        )}
      </ul>
    </section>
  );
}
