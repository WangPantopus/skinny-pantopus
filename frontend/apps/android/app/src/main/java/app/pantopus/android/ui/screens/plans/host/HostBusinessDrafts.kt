package app.pantopus.android.ui.screens.plans.host

import app.pantopus.android.data.api.models.plans.CreatePlanBody
import app.pantopus.android.data.api.models.plans.HostAsBusinessDto
import app.pantopus.android.data.api.models.plans.PlanDetailsDto
import app.pantopus.android.data.api.models.plans.PlanDto
import app.pantopus.android.data.api.models.plans.PlanHostAsInput
import app.pantopus.android.data.plans.PlanAutoRule
import app.pantopus.android.data.plans.PlanFormat
import app.pantopus.android.data.plans.PlanKind
import app.pantopus.android.data.plans.PlanStudyStyle
import java.time.Duration
import java.time.LocalDateTime
import java.time.ZoneId

/*
 * Plans with businesses, boards B1 and B2: a plan posted for a business. Kept apart from the host flow's view-model,
 * which keeps a neighbor's own plan exactly as it was.
 */

/** A business's plan starts with eight spots (board B2). */
private const val BUSINESS_SPOTS = 8
private const val MIN_MINUTES = 15L
private const val MAX_MINUTES = 8 * 60L

/** A business's plan of [kind]: its first label, its main location, eight spots, anyone in right away (board B2). */
internal fun businessDraft(
    business: HostAsBusinessDto,
    kind: PlanKind,
    start: LocalDateTime,
): HostDraft {
    val labels = business.kinds.firstOrNull { it.kind == kind.wire }?.labels.orEmpty()
    val location = business.locations.firstOrNull { it.isPrimary } ?: business.locations.firstOrNull()
    val hours = if (kind == PlanKind.WATCH_PARTY || kind == PlanKind.STUDY_GROUP) 2L else 1L
    return HostDraft(
        kind = kind,
        spots = BUSINESS_SPOTS.coerceAtMost(business.limits.spotsMax),
        approveEach = false,
        hostAs = business.userId,
        label = labels.firstOrNull()?.key,
        locationId = location?.id,
        start = start,
        end = start.plusHours(hours),
    )
}

/**
 * "Host again" for a business's plan: the same label, place and words a week on (moved forward a week at a time until
 * it is in the future), with the plan's zone. Null when the plan can't be read as one.
 */
internal fun copiedBusinessDraft(
    plan: PlanDto,
    business: HostAsBusinessDto,
): Pair<ZoneId, HostDraft>? {
    val kind = PlanKind.from(plan.kind) ?: return null
    val zone = PlanFormat.zone(plan.timezone)
    var start = PlanFormat.instant(plan.startsAt)?.atZone(zone)?.toLocalDateTime() ?: return null
    var end = PlanFormat.instant(plan.endsAt)?.atZone(zone)?.toLocalDateTime() ?: start.plusHours(1)
    val now = LocalDateTime.now(zone)
    while (!start.isAfter(now)) {
        start = start.plusWeeks(1)
        end = end.plusWeeks(1)
    }
    // The card carries the place's point, not its location id: the location at that point, else the main one.
    val location =
        business.locations.firstOrNull { it.latitude == plan.place?.latitude && it.longitude == plan.place?.longitude }
            ?: business.locations.firstOrNull { it.isPrimary }
            ?: business.locations.firstOrNull()
    val draft =
        HostDraft(
            kind = kind,
            title = plan.title,
            titleEdited = true,
            about = plan.about.orEmpty(),
            start = start,
            end = end,
            spots = plan.spots.coerceIn(1, business.limits.spotsMax),
            approveEach = plan.howPeopleGetIn != "automatic" && PlanAutoRule.OPEN !in plan.autoRules.orEmpty(),
            note = plan.place?.note.orEmpty(),
            subject = plan.details?.subject.orEmpty(),
            studyStyle = PlanStudyStyle.from(plan.details?.studyStyle),
            hostAs = business.userId,
            label = plan.label,
            locationId = location?.id,
        )
    return zone to draft
}

/** What a business's draft still needs before it can be posted (board B2), or null. */
internal fun businessDraftProblem(
    draft: HostDraft,
    business: HostAsBusinessDto,
    zone: ZoneId,
): String? {
    val now = LocalDateTime.now(zone)
    val start = draft.start
    val end = draft.end
    val minutes = if (start != null && end != null) Duration.between(start, end).toMinutes() else 0
    val days = business.limits.daysAhead.toLong()
    return when {
        draft.label == null -> "Choose what guests see it called."
        draft.title.isBlank() -> "Give your plan a title."
        start == null || end == null -> "Pick when it starts and ends."
        start.isBefore(now.minusMinutes(1)) -> "Pick a time that hasn't passed."
        start.isAfter(now.plusDays(days)) -> "A business's plans can start up to $days days from now."
        minutes < MIN_MINUTES -> "A plan lasts at least 15 minutes."
        minutes > MAX_MINUTES -> "A plan lasts at most 8 hours."
        draft.kind == PlanKind.STUDY_GROUP && draft.subject.cleanedSubject().isEmpty() -> "Add what you're studying."
        business.locations.none { it.id == draft.locationId } -> "Choose one of your business's locations."
        else -> null
    }
}

/**
 * `POST /api/plans` as the business (the contract's section 5.5): `host_as`, one of its locations, the label, and who
 * gets in (`open` for right away, none to approve each). No place and no GPS: the server copies the location's
 * address. The kind's own facts are left to the server's defaults, except a study group's subject.
 */
internal fun businessCreateBody(
    kind: PlanKind,
    draft: HostDraft,
    zone: ZoneId,
    business: HostAsBusinessDto,
): CreatePlanBody =
    CreatePlanBody(
        kind = kind.wire,
        title = draft.title.trim(),
        about = draft.about.trim().takeIf(String::isNotEmpty),
        startsAt = draft.start!!.atZone(zone).toInstant().toString(),
        endsAt = draft.end!!.atZone(zone).toInstant().toString(),
        place = null,
        spots = draft.spots,
        autoRules = if (draft.approveEach) emptyList() else listOf(PlanAutoRule.OPEN),
        joinRequirement = "located",
        details =
            if (kind == PlanKind.STUDY_GROUP) {
                PlanDetailsDto(subject = draft.subject.cleanedSubject(), studyStyle = draft.studyStyle.wire)
            } else {
                null
            },
        guestNote = draft.note.trim().takeIf(String::isNotEmpty),
        hostAs = PlanHostAsInput(business.userId),
        businessLocationId = draft.locationId,
        label = draft.label,
    )

/** A study group's subject with its spaces tidied, as the host flow sends it. */
private fun String.cleanedSubject(): String = trim().replace(Regex("\\s+"), " ")
