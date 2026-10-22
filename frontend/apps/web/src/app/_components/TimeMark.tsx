import styles from './home.module.css';

type Icon = 'dawn' | 'sun' | 'golden' | 'moon' | 'none';

// The hour a section stands for. Scrolling the page moves through one
// day, so each section opens with its time and what it is about.
export default function TimeMark({ time, topic, icon = 'none', night = false }: { time: string; topic: string; icon?: Icon; night?: boolean }) {
  return (
    <div className={night ? styles.markRowNight : styles.markRow}>
      <span className={night ? styles.markNight : styles.mark}>
        {icon === 'none' ? null : (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.4} aria-hidden="true">
            {icon === 'dawn' ? (
              <>
                <circle cx="8" cy="10" r="3.2" />
                <path d="M1.5 13.5H14.5M8 2.5V4.5M3 5.2L4.3 6.5M13 5.2L11.7 6.5" />
              </>
            ) : icon === 'sun' ? (
              <>
                <circle cx="8" cy="8" r="3.2" />
                <path d="M8 1V2.8M8 13.2V15M1 8H2.8M13.2 8H15M3 3L4.2 4.2M11.8 11.8L13 13M3 13L4.2 11.8M11.8 4.2L13 3" />
              </>
            ) : icon === 'golden' ? (
              <>
                <path d="M4.5 11A3.5 3.5 0 0 1 11.5 11" />
                <path d="M1.5 11H14.5M8 3.5V5.5M3.2 6L4.5 7.2M12.8 6L11.5 7.2" />
              </>
            ) : (
              <path d="M13 9.5A5.5 5.5 0 1 1 6.5 3A4.5 4.5 0 0 0 13 9.5Z" />
            )}
          </svg>
        )}
        {time}
      </span>
      <span>{topic}</span>
    </div>
  );
}
