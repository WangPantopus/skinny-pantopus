# Research-backed changes for f10-mail-piece-photo

- Zoom buttons, or double-tap cycling 1x/2x/4x. Chrome never auto-hides while VoiceOver, TalkBack, Switch Control or Full Keyboard Access is on [a11y]
- 'Delete this photo' confirm names what survives ('The bill and its amount stay'); buttons 'Delete photo' / 'Keep it'; no default focus [capture]
- A member without finance access sees that a piece arrived, not the photo or the amount [capture]
- Convert HEIC to JPEG on web; works in landscape [capture, a11y]
- (research contradiction, topic accessibility-inclusive: WCAG 2.2 AA (in) v1: '1x fit, double-tap to 2x, pinch to 4x.' The header and bottom panel auto-hide on the first zoom or tap and return on a single tap. | research: WCAG 2.5.1 (A): pinch-only 4x needs a single-pointer alternative (the map +/- example). Under VoiceOver or TalkBack a single tap moves focus rather than activating, so auto-hidden chrome, including 'Delete this photo', becomes unreachable. Apple HIG says to offer onscreen alternatives to gestures. | do: Add zoom buttons, or make double-tap cycle 1x, 2x, 4x. Never auto-hide chrome while a screen reader, Switch Control or Full Keyboard Access is running, and keep the chrome in the accessibility tree with its own 'Show controls' action.
