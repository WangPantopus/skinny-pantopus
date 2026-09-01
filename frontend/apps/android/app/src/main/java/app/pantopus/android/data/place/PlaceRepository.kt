package app.pantopus.android.data.place

import app.pantopus.android.data.api.models.geo.GeoAutocompleteResponse
import app.pantopus.android.data.api.models.geo.GeoNearbyPlacesResponse
import app.pantopus.android.data.api.models.geo.GeoPlaceSearchResponse
import app.pantopus.android.data.api.models.place.IssueResidencyLetterRequest
import app.pantopus.android.data.api.models.place.NeighborMessageAck
import app.pantopus.android.data.api.models.place.NeighborMessageTemplates
import app.pantopus.android.data.api.models.place.NeighborhoodPulse
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.place.PlacePreview
import app.pantopus.android.data.api.models.place.PlaceSectionId
import app.pantopus.android.data.api.models.place.ReceivedNeighborMessage
import app.pantopus.android.data.api.models.place.ReceivedNeighborMessagesResponse
import app.pantopus.android.data.api.models.place.ReplyNeighborMessageRequest
import app.pantopus.android.data.api.models.place.ReportNeighborMessageRequest
import app.pantopus.android.data.api.models.place.ResidencyLetterResponse
import app.pantopus.android.data.api.models.place.ResidencyLetterVerification
import app.pantopus.android.data.api.models.place.ResidencyLettersResponse
import app.pantopus.android.data.api.models.place.SendNeighborMessageRequest
import app.pantopus.android.data.api.models.place.SentNeighborMessage
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.AIApi
import app.pantopus.android.data.api.services.GeoApi
import app.pantopus.android.data.api.services.NeighborMessagesApi
import app.pantopus.android.data.api.services.PlaceApi
import app.pantopus.android.data.api.services.ResidencyLettersApi
import okhttp3.ResponseBody
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Place Intelligence data layer — the section-envelope dashboard, the
 * anonymous T0 preview, neighbor messages, residency letters, and the
 * Neighborhood Pulse. Wraps the APIs in `safeApiCall` so view-models
 * route on the `NetworkResult` taxonomy.
 */
@Singleton
class PlaceRepository
    @Inject
    constructor(
        private val placeApi: PlaceApi,
        private val neighborMessagesApi: NeighborMessagesApi,
        private val residencyLettersApi: ResidencyLettersApi,
        private val aiApi: AIApi,
        private val geoApi: GeoApi,
    ) {
        /** Address typeahead for the signed-out funnel (keyless). */
        suspend fun geoAutocomplete(query: String): NetworkResult<GeoAutocompleteResponse> = safeApiCall { geoApi.autocomplete(query) }

        /** Nearby POIs + locality for the compose place tagger. */
        suspend fun geoNearbyPlaces(
            latitude: Double,
            longitude: Double,
        ): NetworkResult<GeoNearbyPlacesResponse> = safeApiCall { geoApi.nearbyPlaces(latitude, longitude) }

        /** Place search for the compose place tagger; coords bias proximity. */
        suspend fun geoSearchPlaces(
            query: String,
            latitude: Double?,
            longitude: Double?,
        ): NetworkResult<GeoPlaceSearchResponse> = safeApiCall { geoApi.searchPlaces(query, latitude, longitude) }

        /**
         * The grouped section envelopes for a home. Pass [sections] to
         * lazy-load a subset (detail pages); null ⇒ the full launch set.
         */
        suspend fun intelligence(
            homeId: String,
            sections: List<PlaceSectionId>? = null,
        ): NetworkResult<PlaceIntelligence> =
            safeApiCall {
                placeApi.intelligence(
                    homeId = homeId,
                    sections =
                        sections
                            ?.takeIf { it.isNotEmpty() }
                            ?.joinToString(",") { it.raw },
                )
            }

        /** The anonymous, address-only T0 preview (no account required). */
        suspend fun publicPreview(address: String): NetworkResult<PlacePreview> = safeApiCall { placeApi.publicPreview(address) }

        /** The Neighborhood Pulse signal stream for a home. */
        suspend fun pulse(homeId: String): NetworkResult<NeighborhoodPulse> = safeApiCall { aiApi.pulse(homeId) }

        // ── Neighbor messages (T4, template-only) ────────────────

        suspend fun neighborMessageTemplates(): NetworkResult<NeighborMessageTemplates> = safeApiCall { neighborMessagesApi.templates() }

        suspend fun sendNeighborMessage(body: SendNeighborMessageRequest): NetworkResult<SentNeighborMessage> =
            safeApiCall { neighborMessagesApi.send(body) }

        suspend fun receivedNeighborMessages(): NetworkResult<ReceivedNeighborMessagesResponse> =
            safeApiCall { neighborMessagesApi.received() }

        /** Single received message — marks it read server-side. */
        suspend fun neighborMessage(id: String): NetworkResult<ReceivedNeighborMessage> = safeApiCall { neighborMessagesApi.message(id) }

        suspend fun replyToNeighborMessage(
            id: String,
            replyTemplateId: String,
        ): NetworkResult<ReceivedNeighborMessage> =
            safeApiCall {
                neighborMessagesApi.reply(id, ReplyNeighborMessageRequest(replyTemplateId))
            }

        suspend fun markNeighborMessageNotHelpful(id: String): NetworkResult<NeighborMessageAck> =
            safeApiCall { neighborMessagesApi.notHelpful(id) }

        suspend fun reportNeighborMessage(
            id: String,
            reason: String?,
        ): NetworkResult<NeighborMessageAck> = safeApiCall { neighborMessagesApi.report(id, ReportNeighborMessageRequest(reason)) }

        suspend fun blockNeighborMessageSender(id: String): NetworkResult<NeighborMessageAck> =
            safeApiCall { neighborMessagesApi.block(id) }

        // ── Residency letters (T4) ───────────────────────────────

        suspend fun issueResidencyLetter(
            homeId: String,
            purpose: String?,
        ): NetworkResult<ResidencyLetterResponse> =
            safeApiCall {
                residencyLettersApi.issue(homeId, IssueResidencyLetterRequest(purpose))
            }

        suspend fun residencyLetters(homeId: String): NetworkResult<ResidencyLettersResponse> =
            safeApiCall { residencyLettersApi.list(homeId) }

        /** The exact issued PDF artifact (raw bytes). */
        suspend fun residencyLetterPdf(
            homeId: String,
            letterId: String,
        ): NetworkResult<ResponseBody> = safeApiCall { residencyLettersApi.pdf(homeId, letterId) }

        suspend fun revokeResidencyLetter(
            homeId: String,
            letterId: String,
        ): NetworkResult<ResidencyLetterResponse> = safeApiCall { residencyLettersApi.revoke(homeId, letterId) }

        /** Anonymous third-party letter check (no auth required). */
        suspend fun verifyResidencyLetter(code: String): NetworkResult<ResidencyLetterVerification> =
            safeApiCall { residencyLettersApi.publicVerify(code) }
    }
