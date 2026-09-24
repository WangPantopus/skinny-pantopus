# SourceCaption

The provenance line under a reading: the mark, its legend word, the source, the scope and the age.

**Provide:** `mark` (a ProvenanceMark kind), `legend` (the word, printed once per surface), `source`, `scope` and `asOf`. The line is caption 12/16 in `app-text-secondary`; the legend word is `app-text-strong` at weight 500. Links in it are `color-primary-700`.

**Rules**
- Mark and word travel together the first time they appear on a surface; after that the mark stands alone.
- The source is named as the public knows it ("Washington Secretary of State"), then the scope, then the age.
- Never a semantic hue and never a tint: this line reports, it does not warn.

**Relates to:** `SourceNote` is the plain source-and-date caption for a public-record reading. SourceCaption is the version that carries provenance. Use SourceNote where there is no mark to show, and SourceCaption wherever the reading has one.

Source: Foundations board 00a (the Pantopus Foundations 00a canvas), component 00a-02. Drawn from the house style; no code source yet, so `tools/design-system` will not regenerate this card.