# Research-backed changes for f9-curator-chip

- Change the chip label from 'Pantopus curator' to 'From Pantopus'. Put the source on its own caption line, 'Source: Clark Public Utilities'. The overflow item reads 'Mute posts from Pantopus' [trust]
- 'Why am I seeing this?' expands in place into lines generated from post.origin and the source feed. Leave out 'doesn't count as neighborhood activity' until de-curation ships [trust]
- Link the source line to the publisher's own page [trust]
- Keep the inline mute toggle, at least 44pt tall [a11y]
- (research contradiction, topic trust-provenance-privacy: where facts co) v1: The chip label is 'Pantopus curator', even though the same prompt says 'curator' is internal vocabulary. | research: NN/g heuristic #2 says to use the users' words, not internal jargon. The iOS privacy-label study found unfamiliar terms stop people understanding what a label means. | do: Label the chip 'From Pantopus' (or 'Posted by Pantopus'), keep 'Source: Clark Public Utilities' as a separate caption line, and word the overflow item 'Mute posts from Pantopus'.
