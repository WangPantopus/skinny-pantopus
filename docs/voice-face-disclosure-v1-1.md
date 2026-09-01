# Voice / face disclosure — v1.1 TODO

Date: 2026-05-08
Status: NOT YET IMPLEMENTED — required before video calls (v1.1) ship.
Resolves: audience-profile design v2 §6.4 (media firewall) + §10
(video call infrastructure).

---

## 0. What's required

Per audience-profile §6.4, before a fan or creator joins their **first**
video call on a persona, Pantopus must show a one-time acknowledgement:

> Your voice and face will be visible to the other person. They may
> recognize you if they know you outside Pantopus. Pantopus cannot
> prevent this.

A single checkbox + a single "I understand and want to continue" button.
Once accepted, the decision is sticky — the prompt is not shown again
for either party.

This doc captures the requirement so PR 10 (Direct tier + LiveKit) picks
it up correctly when video calls land.

## 1. Why it matters

The audience-profile firewall is honest: §2 explicitly carves out
"voice/face inference" from what the platform can hide. Real-time audio
and video reveal the user's voice + appearance to the call counterparty,
and a determined recognizer can correlate that to their personal-side
identity. The disclosure makes that risk visible at the precise moment
the user crosses it — not buried in a privacy policy they never read.

Without the disclosure, fans + creators may join their first persona
video call without internalizing that this is a different
identity-exposure surface than DMs or broadcasts.

## 2. Surfaces that need the prompt

The disclosure fires **once per user, per role**, on a sticky basis:

| Role   | When                                                         |
|--------|--------------------------------------------------------------|
| Fan    | Just before booking their first video call with ANY persona  |
| Creator| Just before confirming their first video call with ANY fan   |

Once accepted, the user record carries a flag (proposed:
`User.voice_face_disclosure_accepted_at timestamptz`) and the prompt
never re-fires for that user — even when they switch personas (creator)
or memberships (fan).

## 3. UI shape

Modal sheet, not a full-screen takeover. Single checkbox, single primary
action. Per §6.4 verbatim copy:

```
┌─────────────────────────────────────────────┐
│  Heads up                                   │
│  ─────────────────────────────────         │
│  Your voice and face will be visible to     │
│  the other person. They may recognize       │
│  you if they know you outside Pantopus.     │
│  Pantopus cannot prevent this.              │
│                                             │
│  [ ] I understand and want to continue.     │
│                                             │
│  [Cancel]                  [Continue]       │
└─────────────────────────────────────────────┘
```

`Continue` is disabled until the checkbox is on. `Cancel` returns the
user to their previous screen without booking / confirming.

## 4. Data model

Two new columns (proposed; PR 10 owns the migration):

```sql
ALTER TABLE "User"
  ADD COLUMN voice_face_disclosure_accepted_at timestamptz NULL,
  ADD COLUMN voice_face_disclosure_role text NULL
    CHECK (voice_face_disclosure_role IS NULL OR voice_face_disclosure_role IN ('fan','creator','both'));
```

Two columns (not one) so we can record which role(s) the user has
acknowledged for. A user who first acknowledges as a fan and later
becomes a creator gets re-prompted on the creator side; the role
column flips to `both` after both prompts are accepted.

## 5. API + tests

Endpoint (proposed): `POST /api/users/me/voice-face-disclosure`
with `{ role: 'fan' | 'creator' }`. Returns the updated User record.

Tests PR 10 must include:
- Booking a video call when `voice_face_disclosure_accepted_at IS NULL`
  on the fan returns 409 + `code: 'voice_face_disclosure_required'`
  + `role: 'fan'`. The booking flow surfaces the modal.
- Confirming a video call as creator with no creator-side
  acknowledgement returns the same 409 with `role: 'creator'`.
- After acceptance the fan can book without the prompt re-firing.
- The acknowledgement persists across personas (a creator who
  switches personas isn't re-prompted).
- LiveKit token issuance (P2.7's existing identity invariant — token
  identity = `fan_handle` / persona display name, never `User.id`)
  is **independent** of this prompt. The two work together but each
  enforces its own rule.

## 6. Cross-references

- audience-profile §6.4: media firewall (the disclosure lives here).
- audience-profile §10: video call infrastructure (when this lands).
- audience-profile §11.5 / §11.6: fan booking + creator confirm flows.
- Invariant 6 (P2.7 / view-as): real-time identity uses audience-side
  handle only. The disclosure complements but does NOT replace that
  invariant.
- backend/services/personaSubscriptionLifecycleService.js — already
  treats Direct tier video calls as a future capability; this doc
  is the gate before the booking flow goes live.

## 7. Acceptance for v1.1 launch

The Direct tier ships with video calls when:

1. The migration in §4 is applied in production.
2. The `POST /api/users/me/voice-face-disclosure` endpoint exists +
   is covered by the §5 test list.
3. The booking + confirm flows on web + mobile show the modal at
   the right moment and store the acceptance.
4. A user who completes the disclosure once never sees it again
   (verified by an automated test + manual smoke).
5. This doc is updated to mark §0 as RESOLVED with a backlink to the
   PR that landed it.
