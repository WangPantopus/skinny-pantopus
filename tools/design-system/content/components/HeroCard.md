"Today's pulse": the card that floats what matters now, in an all-clear or alert mood.

**Provide:** `title` (the one reassuring or urgent line), `chip` (`{ label, icon }`: success in all-clear, warning in alert), `mainIcon`, optional `variant` (`allclear` default, `alert`), `nudge` (`{ icon, text, onClick? }`: interactive only with a handler) and `onOpen` (makes the title row expand to the full pulse).

All-clear uses the home tint, alert the warning tint; urgency is carried by the chip and glyph, never a red flood or a left border. Headline 17/23 semibold. Source: `frontend/apps/web/src/components/archetypes/place/HeroCard.tsx`.
