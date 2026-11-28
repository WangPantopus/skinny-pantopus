package app.pantopus.android.data.pulse

import app.pantopus.android.data.api.models.moments.MomentEnvelope
import app.pantopus.android.data.api.models.plans.CreatePlanBody
import app.pantopus.android.data.api.models.plans.PlanDto
import app.pantopus.android.data.api.models.reinvented.ReinventedAtlasResponse
import app.pantopus.android.data.api.models.reinvented.ReinventedCircleChangeBody
import app.pantopus.android.data.api.models.reinvented.ReinventedCircleDto
import app.pantopus.android.data.api.models.reinvented.ReinventedCircleKeepBody
import app.pantopus.android.data.api.models.reinvented.ReinventedCircleMakeBody
import app.pantopus.android.data.api.models.reinvented.ReinventedCirclesResponse
import app.pantopus.android.data.api.models.reinvented.ReinventedExploreResponse
import app.pantopus.android.data.api.models.reinvented.ReinventedKeepBody
import app.pantopus.android.data.api.models.reinvented.ReinventedListResponse
import app.pantopus.android.data.api.models.reinvented.ReinventedMagazineResponse
import app.pantopus.android.data.api.models.reinvented.ReinventedMapResponse
import app.pantopus.android.data.api.models.reinvented.ReinventedStrandsResponse
import app.pantopus.android.data.api.models.reinvented.ReinventedStrandsSeenBody
import app.pantopus.android.data.api.models.reinvented.ReinventedStripResponse
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.ReinventedApi
import app.pantopus.android.data.moments.serverCode
import java.util.Locale
import javax.inject.Inject
import javax.inject.Singleton

/** A point on the map, in degrees. */
data class ReinventedPoint(
    val latitude: Double,
    val longitude: Double,
)

/** A box on the map, in degrees. */
data class ReinventedBox(
    val south: Double,
    val west: Double,
    val north: Double,
    val east: Double,
)

/**
 * The new Pulse tab's reads ([ReinventedApi]). A refusal that says the switch is off for this person
 * (`403 PULSE_REINVENTED_OFF`, CONTRACT 1) turns it off at once and reads it again, so the tab goes back to today's
 * Pulse; a server from before these routes (404) puts today's Pulse back too, until it is asked again a minute later
 * ([ReinventedServer], PHASE-1 §3). Nobody ever sees "couldn't load" because the server is older.
 */
@Singleton
@Suppress("TooManyFunctions") // The new Pulse's routes, one router on the server, as `ReinventedApi`.
class ReinventedRepository
    @Inject
    constructor(
        private val api: ReinventedApi,
        private val feature: PulseReinventedFeature,
        private val server: ReinventedServer,
    ) {
        /** One page of the list (CONTRACT 6a). [miles] goes only with `around`. */
        suspend fun list(
            reach: String,
            miles: Int?,
            chip: String,
            at: ReinventedPoint?,
            cursor: String?,
            // CONTRACT 8d: one circle of the reader's, with `close`.
            circle: String? = null,
            // CONTRACT 10a: the filters, each left out while null.
            filters: ReinventedFilterQuery? = null,
        ): NetworkResult<ReinventedListResponse> =
            // A circle's 404 is the circle gone (CIRCLE_NOT_FOUND), not an older server: today's Pulse stays out of it.
            guarded(behindOn404 = circle == null) {
                api.list(
                    reach,
                    miles,
                    // With filters the chip goes only when it is one kind alone (never beside `kinds`, never `all`).
                    chip.takeIf { filters == null || (filters.kinds == null && it != "all") },
                    at?.latitude?.let(::degrees),
                    at?.longitude?.let(::degrees),
                    cursor,
                    circle = circle,
                    kinds = filters?.kinds,
                    whenTime = filters?.whenTime,
                    from = filters?.from,
                    state = filters?.state,
                    since = filters?.since,
                    noPlace = "1".takeIf { filters?.noPlace == true },
                )
            }

        /**
         * One page of what the map shows in [box] (CONTRACT 11a, `around`), nearest the box's middle first, with the chip
         * or the filters, and the things without a place after them when [ReinventedFilterQuery.noPlace] (11b).
         */
        suspend fun listInBox(
            box: ReinventedBox,
            chip: String,
            filters: ReinventedFilterQuery?,
            cursor: String?,
        ): NetworkResult<ReinventedListResponse> =
            guarded {
                api.list(
                    reach = "around",
                    miles = null,
                    chip = chip.takeIf { filters == null || (filters.kinds == null && it != "all") },
                    latitude = null,
                    longitude = null,
                    cursor = cursor,
                    kinds = filters?.kinds,
                    whenTime = filters?.whenTime,
                    from = filters?.from,
                    state = filters?.state,
                    since = filters?.since,
                    south = degrees(box.south),
                    west = degrees(box.west),
                    north = degrees(box.north),
                    east = degrees(box.east),
                    noPlace = "1".takeIf { filters?.noPlace == true },
                )
            }

        /** The map for a box and a time (CONTRACT 6b), and the filters (10a) while any is on. */
        suspend fun map(
            box: ReinventedBox,
            time: String,
            // CONTRACT 10a: the filters, without `when` (the time is the map's When).
            filters: ReinventedFilterQuery? = null,
        ): NetworkResult<ReinventedMapResponse> =
            guarded {
                api.map(
                    degrees(box.south),
                    degrees(box.west),
                    degrees(box.north),
                    degrees(box.east),
                    time,
                    kinds = filters?.kinds,
                    from = filters?.from,
                    state = filters?.state,
                    since = filters?.since,
                )
            }

        /** Alive right now (CONTRACT 6c). An older server's 404 only leaves the strip out. */
        suspend fun strip(at: ReinventedPoint?): NetworkResult<ReinventedStripResponse> =
            guarded(behindOn404 = false) { api.strip(at?.latitude?.let(::degrees), at?.longitude?.let(::degrees)) }

        /** One page of Explore (CONTRACT 6f). */
        suspend fun explore(
            at: ReinventedPoint?,
            cursor: String?,
        ): NetworkResult<ReinventedExploreResponse> =
            guarded { api.explore(at?.latitude?.let(::degrees), at?.longitude?.let(::degrees), cursor) }

        /** My Atlas by date (CONTRACT 6e). */
        suspend fun atlas(cursor: String?): NetworkResult<ReinventedAtlasResponse> = guarded { api.atlas(cursor) }

        /** My Atlas's kept Moments in a box, for the map (CONTRACT 6e). */
        suspend fun atlasInBox(box: ReinventedBox): NetworkResult<ReinventedAtlasResponse> =
            guarded { api.atlasInBox(degrees(box.south), degrees(box.west), degrees(box.north), degrees(box.east)) }

        /** Delete for good (CONTRACT 6e): a Moment held for review answers 409 with the server's words. */
        suspend fun deleteForGood(momentId: String): NetworkResult<Unit> = guarded(behindOn404 = false) { api.deleteForGood(momentId) }

        /** "Keep this?" answered (CONTRACT 6d): yes keeps it as a post that stays, for the same people. */
        suspend fun keep(
            momentId: String,
            keep: Boolean,
        ): NetworkResult<MomentEnvelope> = guarded(behindOn404 = false) { api.keep(momentId, ReinventedKeepBody(keep)) }

        /** "Want to come?" (CONTRACT 6g): the plan from the author's own Moment, answered as `POST /api/plans` answers. */
        suspend fun startPlan(
            momentId: String,
            body: CreatePlanBody,
        ): NetworkResult<PlanDto> = guarded(behindOn404 = false) { api.startPlan(momentId, body).plan }

        /** CONTRACT 8d: the reader's circles and invites. An older server's 404 leaves circles out. */
        suspend fun circles(): NetworkResult<ReinventedCirclesResponse> = guarded(behindOn404 = false) { api.circles(zone()) }

        suspend fun makeCircle(
            name: String,
            people: List<String>,
        ): NetworkResult<ReinventedCircleDto?> =
            guarded(behindOn404 = false) { api.makeCircle(ReinventedCircleMakeBody(name, people)).circle }

        suspend fun joinCircle(
            id: String,
            keepFaded: Boolean,
        ): NetworkResult<ReinventedCircleDto?> =
            guarded(behindOn404 = false) { api.joinCircle(id, ReinventedCircleKeepBody(keepFaded)).circle }

        suspend fun circleKeep(
            id: String,
            keepFaded: Boolean,
        ): NetworkResult<ReinventedCircleDto?> =
            guarded(behindOn404 = false) { api.circleKeep(id, ReinventedCircleKeepBody(keepFaded)).circle }

        suspend fun leaveCircle(id: String): NetworkResult<Unit> = guarded(behindOn404 = false) { api.leaveCircle(id) }

        suspend fun changeCircle(
            id: String,
            change: ReinventedCircleChangeBody,
        ): NetworkResult<ReinventedCircleDto?> = guarded(behindOn404 = false) { api.changeCircle(id, change).circle }

        suspend fun endCircle(id: String): NetworkResult<Unit> = guarded(behindOn404 = false) { api.endCircle(id) }

        suspend fun magazine(
            id: String,
            week: String?,
        ): NetworkResult<ReinventedMagazineResponse> = guarded(behindOn404 = false) { api.magazine(id, week, zone()) }

        /** The reader's own zone, for the week's day. */
        private fun zone(): String = java.time.ZoneId.systemDefault().id

        /** "Went because of you" (CONTRACT 8c). An older server's 404 only leaves the section out. */
        suspend fun strands(cursor: String?): NetworkResult<ReinventedStrandsResponse> =
            guarded(behindOn404 = false) { api.strands(cursor) }

        /** Marks the strands the reader has seen (CONTRACT 8c); they stay listed. */
        suspend fun strandsSeen(ids: List<String>): NetworkResult<Unit> =
            guarded(behindOn404 = false) { api.strandsSeen(ReinventedStrandsSeenBody(ids = ids)) }

        private suspend fun <T> guarded(
            behindOn404: Boolean = true,
            call: suspend () -> T,
        ): NetworkResult<T> {
            val answer = safeApiCall { call() }
            when (answer) {
                is NetworkResult.Success -> server.caughtUp()
                is NetworkResult.Failure ->
                    if (answer.error.serverCode == StudioRepository.SWITCH_OFF) {
                        feature.refusedOff()
                    } else if (answer.error == NetworkError.NotFound && behindOn404) {
                        server.markBehind()
                    }
            }
            return answer
        }

        private fun degrees(value: Double): String = String.format(Locale.US, "%.5f", value)
    }
