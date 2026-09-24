# Research-backed changes for f1-your-places

- Empty state: 'No places yet' plus an inline '+ Add a place' [onboarding]
- A removed row collapses to 'Removed · Undo', which stays until the user leaves the screen [a11y]
- The scope chip ('Saved place · Only you' / 'Your household') opens the control that changes it [trust]
- 'Synced 3 items from your other device' is a role=status message [onboarding]
- Place labels wrap and never ellipsise at AX sizes; attach host screenshots [a11y, prompting]
- (research contradiction, topic claude-design-prompting: how to prompt C) v1: Extension prompts (this one and the other EXTEND_EXISTING surfaces) say 'this already exists ... open it, keep everything, and change only what is listed', but only 5 of 59 prompts mention attaching anything. | research: NN/g 2025: output matched real designs far better when Figma links or mockups were supplied, and otherwise defaulted to a generic look. Claude Design supports screenshot uploads and web capture. Figma recommends attaching frames. | do: Add an ATTACH line to every extension prompt: the current host screenshots on each platform (web via web capture) plus the specimen sheet. Reword to 'Reproduce the attached host exactly; change only: …'.
