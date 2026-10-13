@file:Suppress("TooManyFunctions")

package app.pantopus.android.data.plans

import app.pantopus.android.data.api.models.plans.AcceptRequestBody
import app.pantopus.android.data.api.models.plans.AskToJoinBody
import app.pantopus.android.data.api.models.plans.AskToJoinResponse
import app.pantopus.android.data.api.models.plans.CancelPlanBody
import app.pantopus.android.data.api.models.plans.CreatePlanBody
import app.pantopus.android.data.api.models.plans.MyPlansResponse
import app.pantopus.android.data.api.models.plans.PlanDto
import app.pantopus.android.data.api.models.plans.PlanFeedbackBody
import app.pantopus.android.data.api.models.plans.PlanGameDto
import app.pantopus.android.data.api.models.plans.PlanGpsInput
import app.pantopus.android.data.api.models.plans.PlanNearbyPlacesResponse
import app.pantopus.android.data.api.models.plans.PlanPinsResponse
import app.pantopus.android.data.api.models.plans.PlanReportBody
import app.pantopus.android.data.api.models.plans.PlanRequestsResponse
import app.pantopus.android.data.api.models.plans.PlansListResponse
import app.pantopus.android.data.api.models.plans.PublicPlanDto
import app.pantopus.android.data.api.models.plans.StillComingBody
import app.pantopus.android.data.api.models.plans.UpdatePlanBody
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.conditionalApiCall
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.PlansApi
import app.pantopus.android.data.store.PlanStoreKeys
import app.pantopus.android.data.store.ScreenStore
import app.pantopus.android.data.store.StoreKeys
import app.pantopus.android.data.store.StoreTopics
import app.pantopus.android.data.store.Stored
import org.json.JSONObject
import javax.inject.Inject
import javax.inject.Singleton

/** A map viewport (south, west, north, east), rounded so small pans share one stored copy. */
data class PlanViewport(
    val south: Double,
    val west: Double,
    val north: Double,
    val east: Double,
)

/**
 * Nearby Plans' data (brief section 5). The map, the list and "mine" go through the store as kind `nearby`; a
 * plan's detail never does (its private part is re-checked on every visit). Every write marks the Plans entries out
 * of date so the map, the list and Today catch up.
 */
@Singleton
class PlansRepository
    @Inject
    constructor(
        private val api: PlansApi,
        private val store: ScreenStore,
    ) {
        /** Public cards seen lately, so a plan opened from the map or a list shows its card at once. */
        private val cards =
            object : LinkedHashMap<String, PlanDto>(CARD_CACHE, 0.75f, true) {
                override fun removeEldestEntry(eldest: MutableMap.MutableEntry<String, PlanDto>?): Boolean = size > CARD_CACHE
            }

        fun pinsCopy(
            viewport: PlanViewport,
            kinds: String?,
            window: PlanWindow,
        ): PlanPinsResponse? = store.peek(pinsKey(viewport, kinds, window, origin)).data

        /** Pins for [viewport]; each pin's distance band is measured from where the person browses from. */
        suspend fun pins(
            viewport: PlanViewport,
            kinds: String?,
            window: PlanWindow,
            force: Boolean = false,
        ): Stored<PlanPinsResponse> {
            val from = origin
            return store.read(pinsKey(viewport, kinds, window, from), force) { etag ->
                conditionalApiCall {
                    api.pins(
                        south = viewport.south,
                        west = viewport.west,
                        north = viewport.north,
                        east = viewport.east,
                        kinds = kinds,
                        window = window.wire,
                        etag = etag,
                        latitude = from?.latitude?.let(StoreKeys::roundCoordinate),
                        longitude = from?.longitude?.let(StoreKeys::roundCoordinate),
                        gpsLatitude = from?.gps?.let { from.latitude },
                        gpsLongitude = from?.gps?.let { from.longitude },
                        gpsTimestamp = from?.gps?.toString(),
                    )
                }
            }
        }

        private fun pinsKey(
            viewport: PlanViewport,
            kinds: String?,
            window: PlanWindow,
            from: PlanOrigin?,
        ) = PlanStoreKeys.pins(
            viewport.south,
            viewport.west,
            viewport.north,
            viewport.east,
            kinds,
            window.wire,
            from?.latitude?.let(StoreKeys::roundCoordinate),
            from?.longitude?.let(StoreKeys::roundCoordinate),
        )

        fun listCopy(
            latitude: Double?,
            longitude: Double?,
            window: PlanWindow,
            kinds: String?,
        ): PlansListResponse? = store.peek(listKey(latitude, longitude, window, kinds)).data?.also(::remember)

        suspend fun list(
            latitude: Double?,
            longitude: Double?,
            window: PlanWindow,
            kinds: String?,
            force: Boolean = false,
        ): Stored<PlansListResponse> {
            val lat = latitude?.let(StoreKeys::roundCoordinate)
            val lng = longitude?.let(StoreKeys::roundCoordinate)
            val gps = origin?.gps
            return store
                .read(listKey(lat, lng, window, kinds), force) { etag ->
                    conditionalApiCall {
                        api.list(
                            latitude = lat,
                            longitude = lng,
                            window = window.wire,
                            kinds = kinds,
                            cursor = null,
                            etag = etag,
                            gpsLatitude = gps?.let { latitude },
                            gpsLongitude = gps?.let { longitude },
                            gpsTimestamp = gps?.toString(),
                        )
                    }
                }.also { it.data?.let(::remember) }
        }

        private fun listKey(
            latitude: Double?,
            longitude: Double?,
            window: PlanWindow,
            kinds: String?,
        ) = PlanStoreKeys.list(
            latitude?.let(StoreKeys::roundCoordinate),
            longitude?.let(StoreKeys::roundCoordinate),
            window.wire,
            kinds,
        )

        fun mineCopy(): MyPlansResponse? = store.peek(PlanStoreKeys.mine).data

        fun isMineCurrent(): Boolean = store.isCurrent(PlanStoreKeys.mine)

        suspend fun mine(force: Boolean = false): Stored<MyPlansResponse> =
            store.read(PlanStoreKeys.mine, force) { etag -> conditionalApiCall { api.mine(etag) } }.also { stored ->
                stored.data?.let { reply -> (reply.hosting + reply.going + reply.asked + reply.waitlisted).forEach(::rememberCard) }
            }

        /** The public card last seen for [id], for a first frame while the plan loads. Never the private part. */
        fun card(id: String): PlanDto? = synchronized(cards) { cards[id] }

        /** The last list read around the person, for "Other plans this week" (J8). */
        @Volatile
        var lastList: List<PlanDto> = emptyList()
            private set

        /** `GET /api/public/plans/:id`: what a signed-out page may show (J9 asks it after a 404). */
        suspend fun publicPlan(id: String): NetworkResult<PublicPlanDto> = safeApiCall { api.publicPlan(id) }

        /** Where distances are measured from, and a fresh GPS fix when the person browses by location. */
        @Volatile
        private var origin: PlanOrigin? = null

        fun setOrigin(value: PlanOrigin?) {
            origin = value
        }

        /** `GET /api/plans/:id`, fresh every time, with what a 404 means (J9 or gone). */
        suspend fun read(id: String): PlanRead {
            val from = origin
            val result =
                safeApiCall {
                    api.plan(
                        id = id,
                        latitude = from?.latitude,
                        longitude = from?.longitude,
                        gpsLatitude = from?.gps?.let { from.latitude },
                        gpsLongitude = from?.gps?.let { from.longitude },
                        gpsTimestamp = from?.gps?.toString(),
                    )
                }
            val response =
                when (result) {
                    is NetworkResult.Success -> result.data
                    is NetworkResult.Failure -> return PlanRead.Failed(result.error)
                }
            val body = response.body()
            if (response.isSuccessful && body != null) {
                rememberCard(body)
                return PlanRead.Found(body)
            }
            val error = runCatching { response.errorBody()?.string() }.getOrNull()
            return when (response.code()) {
                HTTP_NOT_FOUND -> {
                    forget(id)
                    val json = error?.let { runCatching { JSONObject(it) }.getOrNull() }
                    if (json?.optString("error") == "needs_verified_address") {
                        PlanRead.Locked(json.optJSONObject("plan")?.optString("city")?.takeIf(String::isNotBlank))
                    } else {
                        PlanRead.Missing
                    }
                }
                HTTP_UNAUTHORIZED -> PlanRead.Failed(NetworkError.Unauthorized)
                HTTP_FORBIDDEN -> PlanRead.Failed(NetworkError.Forbidden(error))
                in HTTP_SERVER_ERRORS -> PlanRead.Failed(NetworkError.Server(response.code(), error))
                else -> PlanRead.Failed(NetworkError.ClientError(response.code(), error))
            }
        }

        /** `GET /api/plans/:id` as a plain result (a 404 of any kind is [NetworkError.NotFound]). */
        suspend fun plan(id: String): NetworkResult<PlanDto> =
            when (val read = read(id)) {
                is PlanRead.Found -> NetworkResult.Success(read.plan)
                is PlanRead.Failed -> NetworkResult.Failure(read.error)
                is PlanRead.Locked, PlanRead.Missing -> NetworkResult.Failure(NetworkError.NotFound)
            }

        suspend fun create(body: CreatePlanBody): NetworkResult<PlanDto> = write { api.create(body) }.also { rememberResult(it) }

        suspend fun update(
            id: String,
            body: UpdatePlanBody,
        ): NetworkResult<PlanDto> = write(id) { api.update(id, body) }.also { rememberResult(it) }

        suspend fun cancel(
            id: String,
            note: String?,
        ): NetworkResult<Unit> = write(id, chats = true) { api.cancel(id, CancelPlanBody(note?.takeIf(String::isNotBlank))) }

        suspend fun ask(
            id: String,
            body: AskToJoinBody,
        ): NetworkResult<AskToJoinResponse> {
            val gps = origin?.let { from -> from.gps?.let { at -> PlanGpsInput(from.latitude, from.longitude, at.toString()) } }
            val withGps = if (body.gps == null && gps != null) body.copy(gps = gps) else body
            return write(id) { api.ask(id, withGps) }.also { result -> (result as? NetworkResult.Success)?.data?.plan?.let(::rememberCard) }
        }

        /** `POST /api/plans/:id/report`. */
        suspend fun report(
            id: String,
            reason: String,
        ): NetworkResult<Unit> = safeApiCall(surfaceForbiddenBody = true) { api.report(id, PlanReportBody(reason)) }

        suspend fun withdraw(id: String): NetworkResult<Unit> = write(id, chats = true) { api.withdraw(id) }

        suspend fun requests(id: String): NetworkResult<PlanRequestsResponse> =
            safeApiCall(
                surfaceForbiddenBody = true,
            ) { api.requests(id) }

        suspend fun accept(
            id: String,
            requestId: String,
            confirmSharesAddress: Boolean,
        ): NetworkResult<Unit> =
            write(id, chats = true) {
                api.accept(id, requestId, AcceptRequestBody(confirmSharesAddress.takeIf { it }))
            }

        suspend fun decline(
            id: String,
            requestId: String,
        ): NetworkResult<Unit> = write(id) { api.decline(id, requestId) }

        suspend fun remove(
            id: String,
            requestId: String,
        ): NetworkResult<Unit> = write(id, chats = true) { api.remove(id, requestId) }

        suspend fun onMyWay(id: String): NetworkResult<Unit> = write(id, chats = true) { api.onMyWay(id) }

        suspend fun stillComing(
            id: String,
            coming: Boolean,
        ): NetworkResult<Unit> = write(id, chats = !coming) { api.stillComing(id, StillComingBody(coming)) }

        suspend fun feedback(
            id: String,
            answer: String,
            note: String?,
        ): NetworkResult<Unit> = write(id) { api.feedback(id, PlanFeedbackBody(answer, note?.takeIf(String::isNotBlank))) }

        suspend fun games(): NetworkResult<List<PlanGameDto>> =
            when (val result = safeApiCall { api.games() }) {
                is NetworkResult.Success -> NetworkResult.Success(result.data.games)
                is NetworkResult.Failure -> result
            }

        /** Public places for H6, nearest first; `loading` asks the caller to try again in a few seconds. */
        suspend fun nearbyPlaces(
            latitude: Double,
            longitude: Double,
            query: String? = null,
        ): NetworkResult<PlanNearbyPlacesResponse> =
            safeApiCall { api.nearbyPlaces(latitude, longitude, query?.trim()?.takeIf(String::isNotEmpty)) }

        /** Plans changed elsewhere (a push, another device): the next read of every Plans entry asks again. */
        fun changed(planId: String? = null) {
            store.markStale(planId?.let(PlanStoreKeys::topic) ?: PlanStoreKeys.TOPIC)
        }

        private suspend inline fun <T> write(
            id: String? = null,
            chats: Boolean = false,
            crossinline block: suspend () -> T,
        ): NetworkResult<T> {
            val result = safeApiCall(surfaceForbiddenBody = true) { block() }
            if (result is NetworkResult.Success) {
                store.markEdited(PlanStoreKeys.TOPIC)
                id?.let { store.markEdited(PlanStoreKeys.topic(it)) }
                if (chats) store.markStale(StoreTopics.CHATS)
            }
            return result
        }

        private fun rememberResult(result: NetworkResult<PlanDto>) {
            if (result is NetworkResult.Success) rememberCard(result.data)
        }

        private fun remember(reply: PlansListResponse) {
            lastList = reply.items
            reply.items.forEach(::rememberCard)
        }

        private fun rememberCard(plan: PlanDto) {
            val card = plan.copy(place = null, people = null, chatRoomId = null, guestNote = null)
            synchronized(cards) { cards[plan.id] = card }
        }

        private fun forget(id: String) {
            synchronized(cards) { cards.remove(id) }
        }

        private companion object {
            const val CARD_CACHE = 64
        }
    }

/** Where the person browses from: distances are measured from here; [gps] is the fix time when it's GPS. */
data class PlanOrigin(
    val latitude: Double,
    val longitude: Double,
    val gps: java.time.Instant?,
)

/** What `GET /api/plans/:id` said. */
sealed interface PlanRead {
    data class Found(
        val plan: PlanDto,
    ) : PlanRead

    /** A playdate the viewer can't see without a verified address (J9). */
    data class Locked(
        val city: String?,
    ) : PlanRead

    /** Gone, hidden, or the flag is off. */
    data object Missing : PlanRead

    data class Failed(
        val error: NetworkError,
    ) : PlanRead
}

private const val HTTP_UNAUTHORIZED = 401
private const val HTTP_FORBIDDEN = 403
private const val HTTP_NOT_FOUND = 404
private val HTTP_SERVER_ERRORS = 500..599

/** The machine code of a Plans error reply (`{ error, message }`), such as `not_near` or `full`. */
val NetworkError.planCode: String?
    get() {
        val body =
            when (this) {
                is NetworkError.ClientError -> body
                is NetworkError.Forbidden -> body
                is NetworkError.Server -> body
                else -> null
            } ?: return null
        return runCatching { JSONObject(body).optString("error") }.getOrNull()?.takeIf { it.isNotBlank() }
    }

/** The sentence for people from a Plans error reply, else the error's own copy. */
val NetworkError.planMessage: String
    get() {
        val body =
            when (this) {
                is NetworkError.ClientError -> body
                is NetworkError.Forbidden -> body
                else -> null
            }
        val sentence = body?.let { runCatching { JSONObject(it).optString("message") }.getOrNull() }?.takeIf { it.isNotBlank() }
        return sentence ?: message
    }
