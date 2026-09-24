# Research-backed changes for f9-nearby-cells-map

- Print the bucket label in each cell ('0', '1–5', '6–15', '16+') or use a texture; the ramp alone fails 3:1 [a11y]
- Add +/- and pan buttons and a 'List cells' view (name, bucket, lock state) [a11y]
- Sparkline summary: '14 neighbor posts in 30 days. 3 Pantopus posts not counted.' Sparkline takes a required data prop [a11y, dataviz]
- The locked tier states only its requirement; no blurred or fogged map as a carrot [share]
- The radius never grows without a tap [competitive]
- (research contradiction, topic accessibility-inclusive: WCAG 2.2 AA (in) v1: Cells are shaded on a 4-step ramp (primary.100/200/300/500) for posts-in-30-days buckets, with a legend. The map is the primary navigation and has no list alternative. | research: Adjacent ramp steps are 1.16, 1.26 and 1.66:1, and primary.100 against white is 1.15:1. The bucket is conveyed only by lightness, which fails WCAG 1.4.11 and 1.4.1. The map needs drag and pinch alternatives (2.5.1, 2.5.7). | do: Print the bucket label in each cell ('0', '1–5', '6–15', '16+'), or add a pattern or density-dot texture. Add +/- and pan buttons and a 'List cells' view that shows cell name, bucket and lock state. Give the sparkline a text summary.
