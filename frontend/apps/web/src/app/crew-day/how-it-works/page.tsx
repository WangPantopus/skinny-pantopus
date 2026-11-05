import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { launchFeatures } from '@/lib/featureFlags';
import CrewDayInfoPage from '@/components/crew-day/CrewDayInfoPage';

// "How Crew Day works", linked from every invitation's footer (docs/product/crew-day-build/01-spec.md §1).

export const metadata: Metadata = {
  title: 'How Crew Day works | Pantopus',
  description: 'A local crew comes to your street on one day. Your home gets its own price, and you pay once the work is done.',
};

export default function HowCrewDayWorksPage() {
  if (!launchFeatures.crewDay) notFound();
  return (
    <CrewDayInfoPage
      title="How Crew Day works"
      intro="A local crew picks one street and one day, and each home on it can book its own visit. Pantopus organizes the day. The crew does the work."
      numbered
      rows={[
        {
          title: 'A crew picks your street',
          body: 'A local business with a published Pantopus page sets the date, an arrival window and its prices. Pantopus approves every Crew Day before its link works.',
        },
        {
          title: 'You see your own price',
          body: "Your price comes from your home and the crew's price list, never from how many neighbors join. When a home needs a look first, the crew confirms the price and you approve it before anything is booked.",
        },
        {
          title: "Pay once it's done",
          body: 'Your card is saved when you book. Nothing is charged until the crew marks your home done, with photos. We charge it 24 hours later unless you tell us something needs attention, or right away when you tap "Everything looks good".',
        },
        {
          title: 'Plans can change',
          body: "Cancelling is free until 48 hours before the arrival window. After that, ask the crew: they can release your home at no charge. If rain moves the day, the crew offers new dates at the same price, and you pick one or cancel at no charge. If you don't answer by the deadline, we won't book a new date for you.",
        },
        {
          title: "If something's wrong",
          body: 'Tap "Something needs attention" and your charge waits. Pantopus support owns the problem until it\'s fixed, and we reply within one business day.',
        },
      ]}
      closing="Nothing changes without your yes: no added work, no new price and no repeat booking."
      other={{ href: '/crew-day/who-sees-what', label: 'Who sees what' }}
    />
  );
}
