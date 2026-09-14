# Publish a Gig from a private Home task

The Home task is private source material. Open the normal Gig composer using
only Home/task IDs in navigation; fetch source details after current authorization.
The user explicitly reviews the public title, description, price, location and
terms. Never automatically copy mail, attachments, access secrets, household
members, recurrence, assignees, or private details into the Gig.

Publication uses POST /api/gigs with a `home_task_source` object containing
`home_id`, `task_id`, `request_id`, `expected_updated_at` and `reviewed: true`.
The client retains the exact original request, encrypted and scoped to API origin
and actor, before sending. The authenticated session scope header is required.
No business/proxy posting or second source reference is allowed for this path.
The selected location is explicit address/current/custom, without a Home ID;
public output must not reveal the private Home/task identifiers. Location reveal
must remain after assignment or never public. Public text is consciously authored.

Current readable/editable adult household membership is required; private setup
alone is insufficient to publish on behalf of an existing Home. Only open,
unassigned, unlinked tasks with automatic recurrence inactive can first publish.
Conversion does not complete the Home task, assign a worker, charge a card or
activate recurrence. Gig bidding/payment uses the existing downstream workflow.

One transaction rechecks source version/authority, inserts the ordinary Gig,
links the exact Home task, records a private audit and an immutable receipt.
One source may publish once. Original actor/request/payload replay returns that
receipt and current Gig status; it cannot reset a canceled/completed Gig. A new
request for an already linked task cannot create another Gig. Changed terms
under the same request ID conflict. Deleted tasks/Gigs cannot make an old request
publish again. Lost replies remain unknown until exact recovery. Revoked access
also prevents recovery data disclosure.

Receipt IDs and the backlink remain private. Keep financial/source history during
Home deletion; resource retirement is a separate lifecycle. No hosted or paid
operation is needed for SQL/API/browser synthetic acceptance. Actual provider,
native composer/recovery and combined release acceptance remain separate gates.
