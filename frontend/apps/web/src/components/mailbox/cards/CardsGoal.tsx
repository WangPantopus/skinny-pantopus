// ============================================================
// The shared goal (travelling card Part 8, the founder's D3) on /cards: a small copy of the journey map with the
// states every travelling card has reached in gold, and "All cards this Christmas: 31 of 50 states." No list of cards,
// no ranking. A server component: the outlines never reach the visitor's script.
// ============================================================

import type { CardJourneyGoal } from '@pantopus/api';
import { journeyMapSvg } from './journeyMap';
import styles from './PublicCards.module.css';

export default function CardsGoal({ goal }: { goal: CardJourneyGoal }) {
  return (
    <div className={styles.goal} data-testid="cardsGoal">
      <div className={styles.goalMap} aria-hidden="true" dangerouslySetInnerHTML={{ __html: journeyMapSvg({ stops: [], state_codes: goal.state_codes }, { labels: false }) }} />
      <p className={styles.goalLine}>{goal.line}</p>
    </div>
  );
}
