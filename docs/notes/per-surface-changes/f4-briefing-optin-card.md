# Research-backed changes for f4-briefing-optin-card

- Yes on either row fires the OS dialog directly, with no primer [onboarding, notifications]
- The two asks are list rows. Time chips are at least 44pt (iOS) / 48dp and 44px (web), with selection shown by a check plus fill, not colour alone [notifications, a11y]
- Amber plus 'Open settings' appears only when a row is ON in-app and the OS blocks delivery. If the person declined at the OS prompt, collapse the card and offer the widget once [notifications]
- Readable silence: 'Only when something needs you. Checked 6:00 PM · nothing needs you tonight', shown only when every check succeeded [notifications, widgets]
- The evening row states 'Pickup comes with the evening briefing (6:00 PM)'; the morning row states 'Date reminders at 7:00 AM' [dates]
- 'Saving' / 'Saved' / 'Couldn't save — Retry' are live-region messages [a11y]
- A persistent 'No thanks' alongside 'Not now', stored server-side, with a way back through settings [onboarding]
- Use HOME A fixtures (resolves the 2416/2418 NE Ingle Rd drift) [prompting]
- (research contradiction, topic notifications-permissions: push and perm) v1: The 'OS notifications denied' state shows an amber permission line with 'Open settings' inside the card on Today, with the widget row promoted above it. | research: Android: respect a denial, don't make people "feel pressured to change their mind", and "Don't link to system settings in an effort to convince the user to change their decision". Stating that something the person switched on cannot be delivered is honest; repeating an amber call to action at someone who declined is pressure. | do: Use amber plus 'Open settings' only when a briefing row is ON in-app and the OS blocks delivery. If the person declined at the OS prompt, collapse the card (as the 'asked and declined' state already does), or show one neutral text.secondary line once, and offer the widget once.
