# Research-backed changes for f3-bill-detail-web

- 'Mark paid' shows a 'Marked paid · Undo' status. The bill_paid fan-out is sent only after the undo window closes; undo sends nothing [household, dates]
- A repeating bill shows 'Next due Mon 23 Nov' after marking; offer 'Paid a different amount' and 'Skip this month' [dates]
- Marking paid cancels scheduled reminders for every member. The paid landing state is only for race conditions [household, notifications]
- Attribution 'Marked paid by Sam · 15 Oct' never truncates before the name [household]
- Member view names who can mark it paid ('Maya can mark this paid'); a deleted bill shows 'That bill was removed' with a way back [household, notifications]
- A 'Visible to: Household / Only me' line [household]
- (research contradiction, topic household-sharing: shared household spac) v1: The Paid state is designed for 'arriving here from a reminder', which implies bill reminders can still fire after a co-resident has marked the bill paid. | research: Apple: sending several notifications about the same thing makes people turn off all notifications from the app. Android: update the existing notification when separate ones add nothing, and don't notify when no action is needed. | do: Keep the reassurance frame for race conditions only. Add to the f3-bill-detail-web and f3-household-notifications prompts that marking a bill paid cancels its scheduled reminders for every member and replaces any delivered reminder (same thread or tag) with the bill_paid notice.
