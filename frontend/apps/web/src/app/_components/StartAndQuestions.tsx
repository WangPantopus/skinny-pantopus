// 22:00 and 22:15 — how to begin, and the questions people ask first.

import { ANDROID_PLAY_STORE_URL, IOS_APP_STORE_URL } from '@pantopus/utils';
import TimeMark from './TimeMark';
import styles from './home.module.css';

const STORES_LIVE = !!(IOS_APP_STORE_URL && ANDROID_PLAY_STORE_URL);

const STEPS = [
  { title: 'Look up your place.', body: 'No account needed.' },
  { title: 'Save it and set up your home.', body: 'Tasks, documents and your pickup day.' },
  { title: 'Bring someone in.', body: 'A household member, a plan, a question on Pulse.' },
];

const QUESTIONS = [
  { q: 'Do I have to own my home?', a: 'No. Renters, owners and people sharing a home can all use it. Some details depend on your role and verification.' },
  { q: 'Can I try it without an account?', a: 'Yes. Look up any U.S. address. You need an account to save a place and use household and community features.' },
  { q: 'Do I need to verify first?', a: 'No. You can save a place and set up a private home first. Some features need a verified address.' },
  { q: 'What if few neighbors have joined?', a: 'Your place, Today and household tools work right away. Nearby and Plans grow as people join.' },
  { q: 'Is the same information everywhere?', a: 'No. Coverage depends on the source, and Pantopus shows where something is county-wide or missing.' },
  { q: 'Does verifying confirm ownership?', a: 'No. Address verification and ownership are separate checks.' },
  { q: 'Is it free?', a: 'Yes. Everything on this page is free to use.' },
  {
    q: 'Where can I get the app?',
    a: STORES_LIVE
      ? 'On the App Store and Google Play. You can also start on the web, right here.'
      : 'The iPhone and Android apps are in early access. You can start on the web today.',
  },
];

export default function StartAndQuestions() {
  return (
    <>
      <section className={styles.nightSection} aria-labelledby="start-title">
        <div className={styles.wrap} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <TimeMark time="22:00" topic="Getting started" night />
          <h2 id="start-title" className={styles.h2Small}>Start small. Make it yours.</h2>
          <ol className={styles.steps}>
            {STEPS.map((s, i) => (
              <li key={s.title} className={styles.step}>
                <span className={styles.stepNum} aria-hidden="true">{i + 1}</span>
                <span className={styles.stepText}>
                  <strong>{s.title}</strong>
                  {s.body}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={styles.nightSection} aria-labelledby="questions-title">
        <div className={styles.wrap} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <TimeMark time="22:15" topic="Questions" night />
          <h2 id="questions-title" className={styles.h2Small}>A few things you might be wondering.</h2>
          <dl className={styles.faq}>
            {QUESTIONS.map((item) => (
              <div key={item.q} className={styles.faqItem}>
                <dt>{item.q}</dt>
                <dd>{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </>
  );
}
