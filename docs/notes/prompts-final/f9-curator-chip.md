# From Pantopus chip + 'Why am I seeing this?'
id: f9-curator-chip · platforms: web/ios/android · isNew: False · artboards: 19

Use the Pantopus house style pasted above and the Foundations components (boards 00a–00d), by exact name.

SCREEN: Nearby post card and post detail, Pantopus-authored variant · f9-curator-chip

TYPE: EXTENSION of the existing designed screens "Nearby feed post card" and "Post detail", plus the "Pulse card" and the "map card". The Pulse and map cards share this data but not the card component. This screen already exists in the Pantopus design system. The attached screenshot is exact. Keep everything and change only what is listed.
1. On posts Pantopus wrote, a "From Pantopus" chip replaces the whole identity block.
2. A Source line goes under the body.
3. The overflow menu gains "Why am I seeing this?", which expands in place.
4. Muting writes to the existing Feed preferences and hides Pantopus posts in the Nearby feed, on the Nearby map and on the Pulse card.
Report and neighbor posts are unchanged.

ATTACH: the Nearby feed with a neighbor card and a system card (web 1440, web 390, iOS, Android) · post detail with the overflow menu open (web and iOS) · the Pulse card on the Today tab · the Nearby map card callout · Feed preferences.

PLATFORMS & VIEWPORTS: Web 1440x900 (left sidebar) and 390x844 (bottom tab bar). iOS 393x852 (native list; the overflow is a pull-down menu from the ••• button). Android 412x915 (Material 3 cards; the overflow is a dropdown menu).

WHERE IT LIVES & HOW PEOPLE ARRIVE: Nearby tab → feed card → post detail. The same variant appears on:
- the Pulse card on the Today tab (if the attached screenshot shows it on another tab, follow the screenshot and note it);
- the Nearby map card callout;
- Saved posts;
- a post opened from a notification deep link.
The explainer opens from the overflow item "Why am I seeing this?" or from a tap on the chip (44pt hit area). No journey in the flow spec hands anything to this card, so it must stand alone.

WHO AND WHEN: Mon 19 Oct 2026, 6:10 PM. Maya Chen at HOME A scrolls Nearby after last night's wind and sees a power-outage post. She wants to know whether a neighbor wrote it and, if not, whether she can hide posts like it.

THE ONE JOB: Let a reader tell at a glance that Pantopus, not a neighbor, posted this, and understand exactly what muting hides.

FIRST FIVE SECONDS: First the "From Pantopus" chip where a face would be, then the body, then the Source line. The card itself has no primary action. Inside the explainer, the one action is the "Show Pantopus posts" toggle.

CONTENT (fixture deltas only). Draw a real feed with the three card kinds stacked, not one card alone.
- Neighbor card, unchanged: avatar, "Marcus R. · Vancouver, WA · 4h", "Anyone else lose power around 164th? Ours came back at 11.", "6 replies". This is the same header format f9-privacy-mirror quotes. If the attached feed uses a different header format, keep the screenshot's format and record it on Notes.
- Pantopus card:
  - identity slot: chip "From Pantopus" · "2h";
  - body: "Clark Public Utilities reports 412 customers without power near NE 164th Ave after last night's wind. As of 4:05 PM, their estimate for power back is 8:30 PM tonight.";
  - SourceCaption: "Source: Clark Public Utilities · NE 164th Ave area · as of 4:05 PM ↗", linking to the publisher's own outage page;
  - overflow: "Report" · "Mute posts from Pantopus" · "Why am I seeing this?".
- System card: "Online or mail voter registration for Nov 3 must arrive by Oct 26 in Washington." Keep its existing treatment.
- Explainer: heading "Why am I seeing this?", then four lines:
  1. "Pantopus posted this."
  2. "It came from Clark Public Utilities."
  3. "No neighbor wrote it or chose it for you."
  4. "It doesn't count as neighborhood activity in Nearby."
  Then the toggle row "Show Pantopus posts" (on) with the caption "In the Nearby feed, on the Nearby map and on the Pulse card in Today.", the text link "Report this post", and "Hide" to collapse. Line 4 is shown only when Pantopus posts are actually left out of neighborhood counts. That exclusion is planned for the same F9 release, so draw the four-line version in the main frames, and beside it draw a three-line inset of the version without line 4, which ships if the exclusion is not live.
- Post detail (densest):
  - a 16:9 photo captioned "Photo: Clark Public Utilities";
  - the headline "Crews working to restore power along NE 164th Ave and nearby streets after overnight wind";
  - topic chips "Power" · "Weather";
  - the SourceCaption;
  - the overflow menu open.
- Worst case: the source "Washington State Department of Transportation" wraps to two lines, and a 6-line body truncates with the existing "More".

LAYOUT & VISUALIZATION
The Pantopus row has no avatar-plus-name shape. The chip replaces the whole identity block. Draw no avatar circle, no initials disc, no reserved 40px slot and no empty space where a face would be.

Chip (the origin chip):
- neutral pill geometry, the same as ScopeChip and StatusChip: 24pt tall, 44pt hit area;
- light mode: surface.sunken fill, label 13/18 in text.strong;
- a leading 12pt Pantopus mark glyph and a trailing 12pt chevron-down that shows it expands;
- the glyph is the Pantopus mark, never a tick, shield or star, so the chip cannot read as a verified or endorsed badge;
- it sits on the byline baseline and reads as a label, not a person;
- it never uses the ChoiceChip selected look (primary.50 fill with a primary.700 label), so it can't be mistaken for a selected topic filter;
- dark mode: dark raised fill with a 1px outline in dark text.secondary (3:1 or better against the card), label in dark text primary at 4.5:1 or better. Do not use the dark sunken token, because it equals the dark base and the pill would lose its edge.

The SourceCaption goes under the body, in text.secondary with its external-link glyph. It carries no ProvenanceMark on post captions, because the chip already states who posted and a filled mark could read as an endorsement. It stays separate from the chip, because who posted and where the fact came from are two different facts.

The explainer expands inline under the chip and pushes the body down. It is four lines, a toggle row at least 44pt tall and one link. That doesn't warrant a sheet, and a sheet would cover the post it explains.

Variants:
- Pulse card: the chip takes the avatar position, left of the title. When muted, the Pantopus item is absent from the Pulse card and the remaining items close up.
- Map card callout: the chip, a one-line title and the SourceCaption. When muted, Pantopus pins are absent from the Nearby map.
- No record of who posted (older cached copies): the body and the time only. No chip, no name, no placeholder identity.
- Media failed: the image box keeps its 16:9 size and shows "Photo didn't load · Retry".

INTERACTION, MOTION & HAPTICS
- Tapping the chip or the overflow item toggles the explainer. It expands over 200ms and the chevron rotates. Under Reduce Motion it cross-fades.
- Muting from the feed: "Mute posts from Pantopus" in the overflow, or turning the toggle off, saves to Feed preferences. The card then collapses in place to InlineUndo, and other Pantopus cards fade out of the feed behind it over 200ms. Directly under InlineUndo sits the caption "Turn them back on in Feed preferences." with "Feed preferences" as a link to the existing screen.
- If the save fails after a feed-card mute, the card and the other Pantopus cards return, and InlineErrorRow (save failed) sits in the card's slot above the restored card.
- Muting from post detail: the post stays visible. The toggle row turns off, and InlineUndo "Posts from Pantopus are hidden · Undo" appears under it. The feed is re-filtered when the person goes back. If the save fails here, the toggle returns to on and InlineErrorRow sits under it.
- Undo stays until the person leaves Nearby or the detail screen.
- One light haptic tick when the mute is confirmed, and no other haptics.
- "Report" and "Report this post" open the existing report flow.
- On web, Escape collapses the explainer.
- Every action is a tap; nothing depends on swipe, long-press or hover.

FOUNDATIONS COMPONENTS USED: SourceCaption (dated static, with the external-link glyph because a URL exists; "Source:" prefix and no ProvenanceMark, recorded on Notes) · InlineUndo (removed-row variant: "Posts from Pantopus are hidden · Undo") · InlineErrorRow (save-failed variant, value preserved) · OfflineNotice · WarmingSkeleton (row skeleton). The chip text is the glossary term "From Pantopus". The chip itself is a proposed contract addition (see Notes).

ACCESSIBILITY
- Card reading order: chip → time → body → Source → actions.
- Chip: label "From Pantopus, not a neighbor", hint "Shows why you're seeing this", button trait, expanded/collapsed state.
- The Source link reads "Source: Clark Public Utilities, NE 164th Ave area, as of 4:05 PM, opens their website".
- When the chip opens the explainer, focus stays on the chip and the content is announced politely. When the overflow item opens it, focus moves into the explainer's heading.
- Toggle: label "Show Pantopus posts in the Nearby feed, on the Nearby map and on the Pulse card", with the native switch state.
- The mute confirmation and the error are live regions.
- Targets: 44pt on iOS, 48dp on Android, 44px on web.
- The chip is told apart by its shape, glyph and words, not by colour.
- At AX5, the chip and time stack, and the explainer lines wrap without truncating.

COPY: every string above, plus:
- Mute failed: "We couldn't hide posts from Pantopus. Your feed hasn't changed. Retry".
- Reported: "You reported this post. We'll review it within 7 days, by Mon 26 Oct."
- Offline, under the disabled toggle, under Report and under the overflow's "Mute posts from Pantopus": "Changing this needs a connection."
- Already muted, when the post is opened from a link: the toggle shows off, with the caption "Pantopus posts are hidden in Nearby and on Today."

EDGE CASES
- Long source names wrap to two lines. A 6-line body truncates.
- Several Pantopus posts in a row each carry the chip, and one mute removes them all behind one undo.
- No Pantopus posts: nothing changes.
- Cold feed skeletons draw no avatar slot on any card. Avatar space appears only once the app knows a neighbor posted. Slow media reserves only the image box.
- Offline: the toggle, Report and the overflow's "Mute posts from Pantopus" are disabled, each with its reason.
- Cached rows with no record of who posted show no chip.
- A household member and an owner see the same card.

INSTEAD OF
- Instead of an avatar, initials disc or logo circle, put the "From Pantopus" chip where the identity block goes — because an avatar-plus-name shape reads as a person.
- Instead of a primary-tinted chip, draw the neutral pill with the Pantopus mark and a chevron — because a tinted chip reads as a selected filter or an endorsement badge.
- Instead of "Pantopus curator", write "From Pantopus" — because "curator" is internal vocabulary (NN/g heuristic 2).
- Instead of a sheet or modal, expand the explanation in place — so the post being explained stays visible.
- Instead of a guessed byline when the app doesn't know who posted, draw no identity at all — because a placeholder could make a Pantopus post look like a neighbor's.
- Instead of the source in a tooltip or chip, draw a SourceCaption with its scope, as-of time and a link to the publisher — so a reader can check the fact.
- Instead of a mute that only closes the menu, save it to Feed preferences and show InlineUndo — because a mute that doesn't persist reappears on the next load and reads as broken.
- Instead of an explainer line the code doesn't enforce, generate each line from who posted, the source and the exclusion from counts — because every line must be literally true.

DONE WHEN
- In the three-card frame, a reader can tell which card a neighbor wrote without reading the body.
- The chip never reads as a person, a selected filter or an endorsement, in light or dark.
- Every explainer line is literally true, and the control sits beside it.
- The toggle's caption says exactly where muting hides posts, and the muted Pulse and map variants match it.
- Muting takes one tap, with undo and a failure path, from the feed and from detail.
- Cached rows with no record of who posted show neither a chip nor a byline.
- The Source line names the authority, scope and as-of time.
- The Pulse and map variants match the card.

ARTBOARDS
1. f9-curator-chip · web-1440 · 01-feed-three-kinds · light — neighbor, Pantopus and system cards stacked.
2. f9-curator-chip · ios · 02-feed-collapsed · light — the same feed on iOS, explainer collapsed.
3. f9-curator-chip · ios · 03-why-expanded · light — the four lines, toggle with its caption, and Report link, plus the three-line inset.
4. f9-curator-chip · android · 04-muted-undo · light — InlineUndo in the card's place with the Feed preferences caption under it, the feed re-filtered behind it.
5. f9-curator-chip · web-1440 · 05-post-detail-overflow · light — photo, headline, topic chips, SourceCaption, overflow open.
6. f9-curator-chip · ios · 06-post-detail-overflow · light — the native detail with the pull-down menu open from the ••• button. Inset: the detail opened from a link while already muted, toggle off, with the already-muted caption.
7. f9-curator-chip · web-390 · 07-feed-three-kinds · light — the three cards at 390.
8. f9-curator-chip · android · 08-no-author-record · light — a cached row with no chip and no byline.
9. f9-curator-chip · ios · 09-mute-failed · light — detail: InlineErrorRow, toggle back on. Inset: feed after a failed card mute, the card restored with InlineErrorRow in its slot.
10. f9-curator-chip · web-390 · 10-muted-on-detail · light — the post still visible, toggle off, InlineUndo under it.
11. f9-curator-chip · web-390 · 11-reported · light — the reported line with its review window and date.
12. f9-curator-chip · android · 12-media-loading-failed · light — one image box loading, one failed with Retry.
13. f9-curator-chip · ios · 13-pulse-and-map-variants · light — Pulse card and map callout side by side. Inset: the Pulse card while muted, Pantopus item absent.
14. f9-curator-chip · android · 14-offline · light — OfflineNotice; toggle, Report and the overflow mute item disabled with reasons.
15. f9-curator-chip · web-1440 · 15-worst-case · light — long source name, truncated body, three Pantopus cards in a row.
16. f9-curator-chip · ios · 16-ax5 · light — frame 3 at AX5.
17. f9-curator-chip · web-1440 · 17-greyscale · light — frame 1 in greyscale.
18. f9-curator-chip · web-1440 · 18-feed-three-kinds · dark — dark twin of frame 1, chip with the outlined dark fill.
19. f9-curator-chip · ios · 19-why-expanded · dark — dark twin of frame 3.
20. f9-curator-chip · Notes — record:
- Invented strings: Marcus R., the outage body, 412, 4:05 PM, 8:30 PM, "NE 164th Ave area", the headline, the photo caption, the topic chips, Mon 26 Oct and "within 7 days", the WSDOT example, "Report this post", the toggle caption, "Pantopus posts are hidden in Nearby and on Today."
- Proposed contract addition: the origin chip ("From Pantopus"), with its dark-mode choice (dark raised fill plus a 1px dark text.secondary outline, because dark sunken equals dark base).
- SourceCaption documented variant for posts: a "Source:" prefix (from the design doc's F9 row) and no ProvenanceMark, because the chip already states origin.
- Each explainer line is generated from who posted, the source and the exclusion from counts. Line 4 ships only once the Seeder exclusion (Pantopus-authored rows left out of the taper RPC and every organic count) is live in code; otherwise ship the three-line inset.
- Open question: is there a geo-targeting field that would make "because it's about your area" true? Until there is, line 1 stays "Pantopus posted this."
- Open question: does the Feed preference reach the Pulse card and the Nearby map? If not, narrow the toggle caption and the undo text to what it does hide.
- Open question: is there a post-report review queue with a turnaround? If not, use "You reported this post. We'll look at it." Is a 7-day review window achievable for a solo founder?
- The design doc's F9 section and the f9-nearby-cells-map prompt still say "Pantopus curator"; update both to "From Pantopus".
- Whether the existing system card shows a human-looking byline (flag it; do not redesign it).
- Any header-format difference from the attached feed.
- Omitted states: origin system (keeps its existing treatment, not redrawn), plus any others.

BATCH PLAN: Turn 1: artboards 1-6, then wait for "continue". Turn 2: artboards 7-12, then wait for "continue". Turn 3: artboards 13-18, then wait for "continue". Turn 4: artboards 19-20.
