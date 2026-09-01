@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.eventtypes

import app.pantopus.android.data.scheduling.SchedulingOwner
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Carries the resolved [SchedulingOwner] across the arg-less A0 routes
 * (`EVENT_TYPE_EDITOR` / `INTAKE_QUESTIONS_EDITOR` only encode `eventTypeId`).
 *
 * The list/editor set [pending] to the pillar they are scoped to right before
 * `onNavigate(...)`; the editor/intake view-models read it as the initial owner
 * so a Business "+" creates a *business* event type (owner_type/owner_id on the
 * POST) and a Home event type loads via the `/api/homes/{homeId}/scheduling`
 * alias — instead of silently defaulting to Personal. On edit the loaded DTO's
 * `owner_type`/`owner_id` remain authoritative and override this hint.
 *
 * A process-scoped `@Singleton` (not a nav arg) so it never touches the frozen
 * A0 routing seam — owner context still resolves in-screen, the A0 way.
 */
@Singleton
class SchedulingEditorOwnerRelay
    @Inject
    constructor() {
        var pending: SchedulingOwner? = null

        fun consume(): SchedulingOwner? = pending.also { pending = null }
    }
