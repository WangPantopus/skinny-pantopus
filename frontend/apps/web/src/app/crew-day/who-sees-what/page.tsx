import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { launchFeatures } from '@/lib/featureFlags';
import CrewDayInfoPage from '@/components/crew-day/CrewDayInfoPage';

// "Who sees what", linked from every invitation's footer: the privacy rules of 01-spec.md §1 rule 7, in plain words.

export const metadata: Metadata = {
  title: 'Who sees what on a Crew Day | Pantopus',
  description: 'Neighbors see how many homes booked, never which ones. The crew sees your address only on the day.',
};

export default function CrewDayWhoSeesWhatPage() {
  if (!launchFeatures.crewDay) notFound();
  return (
    <CrewDayInfoPage
      title="Who sees what"
      intro="Booking a Crew Day never publishes your address or adds you to a group chat."
      rows={[
        {
          title: 'Anyone with the link',
          body: "The street, the date, the crew and its prices, and how many homes booked. Never addresses or names.",
        },
        {
          title: 'Your neighbors and the organizer',
          body: 'How many homes booked and how many spots are left. Never which homes, or who.',
        },
        {
          title: 'The crew',
          body: 'Until 6 PM the evening before, your home as "Home 3 · Two stories" and its price. From then through the end of the day, your address, your first name and your note for the crew. A home waiting on a price check shows its address to the crew right away, so the crew can look at it.',
        },
        {
          title: 'Photos',
          body: 'Photos of the finished work and of a problem are seen by you, the crew and Pantopus support only.',
        },
        {
          title: 'Pantopus support',
          body: 'Everything about the Crew Day, so we can help when something goes wrong.',
        },
      ]}
      closing="Your note for the crew is deleted a week after the job."
      other={{ href: '/crew-day/how-it-works', label: 'How Crew Day works' }}
    />
  );
}
