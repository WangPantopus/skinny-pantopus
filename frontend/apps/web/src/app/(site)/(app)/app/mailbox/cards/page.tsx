import SendCardFlow from '@/components/mailbox/cards/SendCardFlow';

/**
 * Send a Christmas card (launch keys holiday_cards + mailbox; the middleware turns this page away while either is
 * off). One card a day; once it's sent, this page shows today's card. ?design= comes from a public card page or from a
 * button under one of the assistant's replies: that picture is already chosen. ?to= comes from "Send them a card" on a card on the table: that
 * person is already chosen (launch key card_table).
 */
export default async function SendChristmasCardPage({ searchParams }: { searchParams: Promise<{ design?: string | string[]; to?: string | string[]; again?: string | string[]; thanks?: string | string[] }> }) {
  const { design, to, again, thanks } = await searchParams;
  // ?again= comes from "Send this card to someone else" in Sent (mail-cards-experience Part 6): that picture, skipping
  // Pick a card.
  if (typeof again === 'string') return <SendCardFlow chosenDesign={again} sendAgain />;
  // ?thanks=1 comes with ?to= from "Send a thank-you card" on an opened Christmas card (Wave 5): the thank-you shelf.
  return <SendCardFlow chosenDesign={typeof design === 'string' ? design : null} chosenPerson={typeof to === 'string' ? to : null} thanks={thanks === '1'} />;
}
