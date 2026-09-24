# Research-backed changes for f6-home-basics-rows

- 'Not set' in text.secondary (text.strong on sunken), never text.muted [a11y]
- The move-in date accepts past and near-future dates, with suggested fixes rather than blocking [dates]
- Restoring a synced dismissal is a visible 'Show mover checklist again' row; dismissals are stored server-side [onboarding]
- A dismissed row uses inline undo that doesn't expire; attach host screenshots [a11y, prompting]
- (research contradiction, topic accessibility-inclusive: WCAG 2.2 AA (in) v1: When the move-in date is unset, the value reads 'Not set' in text.muted. | research: 2.54:1 fails WCAG 1.4.3. 'Not set' is information: it is the gate for the whole mover experience. | do: Write 'Not set' in text.secondary (or text.strong on a sunken row) and keep the helper line. Show emptiness with the words, not with faint colour.
