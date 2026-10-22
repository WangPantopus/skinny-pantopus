// 21:00 — one real journey through the layers, from a county fact to a
// finished household task. The Ask Pantopus card waits behind
// NEXT_PUBLIC_HOME_ASK_READY until the public app builds carry its
// action cards and the privacy policy names AI processing.

import TimeMark from './TimeMark';
import styles from './home.module.css';

const ASK_READY = process.env.NEXT_PUBLIC_HOME_ASK_READY === 'true';

const JOURNEY = [
  { where: 'PLACE', what: 'Your county is EPA radon zone 1.' },
  { where: 'TODAY', what: '“Test for radon?” appears on the radon card.' },
  { where: 'TASK', what: '“Order a test kit,” assigned to Sam, due Saturday.' },
  { where: 'DONE', what: 'Sam checks it off. The household sees it.' },
];

export default function HowItFitsSection() {
  return (
    <section className={styles.nightSectionFirst} aria-labelledby="fits-title">
      <div className={`${styles.wrap} ${styles.stack32}`}>
        <div className={styles.head}>
          <TimeMark time="21:00 · Night" topic="How it fits together" icon="moon" night />
          <h2 id="fits-title" className={styles.h2}>Built around where you actually live.</h2>
          <p className={styles.lede}>
            Your place gives information its context. Your household gives responsibilities a home. People nearby give you
            reasons to get together. Pantopus keeps them connected, so learning something leads to doing something.
          </p>
        </div>

        <ol className={styles.journey}>
          {JOURNEY.map((step, i) => (
            <li key={step.where} className={i === JOURNEY.length - 1 ? styles.journeyDone : styles.journeyStep}>
              <span className={styles.journeyWhere}>
                <span className={styles.journeyNum}>{i + 1}</span>
                {step.where}
              </span>
              <span>{step.what}</span>
            </li>
          ))}
        </ol>

        {ASK_READY ? (
          <div className={styles.ask}>
            <div className={styles.askCopy}>
              <span className={styles.askTitle}>Ask about what’s in front of you.</span>
              <span style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--night-muted)' }}>
                Ask a question from the screen you’re on. Pantopus answers with its sources and suggests a next step.
                Nothing happens until you tap it.
              </span>
            </div>
            <div className={styles.askDemo} aria-label="An example question asked from a Place screen">
              <span className={styles.askContext}>Asking about: Place · example home</span>
              <span className={styles.askQuestion}>Should I worry about radon here?</span>
              <div className={styles.askAnswer}>
                <span>Your county is in EPA radon zone 1, the highest band. That’s county-wide. Only a test tells you about this home.</span>
                <span className={styles.askSource}>Source · EPA radon zones</span>
              </div>
              <div className={styles.askAction}>
                <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                  <span className={styles.rowLabel}>Suggested task</span>
                  <span style={{ fontWeight: 600 }}>Order a radon test kit · due Saturday</span>
                </span>
                <span className={styles.btn} style={{ minHeight: 44, fontSize: 14.5, padding: '0 18px' }} aria-hidden="true">Add task</span>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
