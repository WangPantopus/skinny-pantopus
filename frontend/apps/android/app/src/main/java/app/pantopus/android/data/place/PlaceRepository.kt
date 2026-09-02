package app.pantopus.android.data.place

import app.pantopus.android.data.api.models.geo.GeoAutocompleteResponse
import app.pantopus.android.data.api.models.geo.GeoNearbyPlacesResponse
import app.pantopus.android.data.api.models.geo.GeoPlaceSearchResponse
import app.pantopus.android.data.api.models.homes.GetHomeEmergenciesResponse
import app.pantopus.android.data.api.models.place.AddressCalendarResponse
import app.pantopus.android.data.api.models.place.BlockInviteRecipient
import app.pantopus.android.data.api.models.place.BlockInviteRequest
import app.pantopus.android.data.api.models.place.BlockInviteResult
import app.pantopus.android.data.api.models.place.BlockStatusResponse
import app.pantopus.android.data.api.models.place.FridgeCardResponse
import app.pantopus.android.data.api.models.place.FridgeCardsResponse
import app.pantopus.android.data.api.models.place.HomeUnlistedResponse
import app.pantopus.android.data.api.models.place.IssueFridgeCardRequest
import app.pantopus.android.data.api.models.place.IssueResidencyClaimRequest
import app.pantopus.android.data.api.models.place.IssueResidencyLetterRequest
import app.pantopus.android.data.api.models.place.MailboxCheckResponse
import app.pantopus.android.data.api.models.place.NeighborMessageAck
import app.pantopus.android.data.api.models.place.NeighborMessageTemplates
import app.pantopus.android.data.api.models.place.NeighborhoodPulse
import app.pantopus.android.data.api.models.place.PlaceIntelligence
import app.pantopus.android.data.api.models.place.PlacePreview
import app.pantopus.android.data.api.models.place.PlaceSectionId
import app.pantopus.android.data.api.models.place.PublicUnlistedResponse
import app.pantopus.android.data.api.models.place.ReceivedNeighborMessage
import app.pantopus.android.data.api.models.place.ReceivedNeighborMessagesResponse
import app.pantopus.android.data.api.models.place.RecordWatchResponse
import app.pantopus.android.data.api.models.place.RemoveRecordWatchResponse
import app.pantopus.android.data.api.models.place.RemoveRentReportResponse
import app.pantopus.android.data.api.models.place.RentReportResponse
import app.pantopus.android.data.api.models.place.ReplyNeighborMessageRequest
import app.pantopus.android.data.api.models.place.ReportNeighborMessageRequest
import app.pantopus.android.data.api.models.place.ResidencyClaimResponse
import app.pantopus.android.data.api.models.place.ResidencyClaimsResponse
import app.pantopus.android.data.api.models.place.ResidencyLetterResponse
import app.pantopus.android.data.api.models.place.ResidencyLetterVerification
import app.pantopus.android.data.api.models.place.ResidencyLettersResponse
import app.pantopus.android.data.api.models.place.SendNeighborMessageRequest
import app.pantopus.android.data.api.models.place.SentNeighborMessage
import app.pantopus.android.data.api.models.place.SetPickupDayRequest
import app.pantopus.android.data.api.models.place.SetRecordWatchRequest
import app.pantopus.android.data.api.models.place.SetRentReportRequest
import app.pantopus.android.data.api.models.place.SetUnlistedRemovalRequest
import app.pantopus.android.data.api.models.place.UnlistedRemovalResponse
import app.pantopus.android.data.api.models.place.UnlistedRemovalStatus
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.AIApi
import app.pantopus.android.data.api.services.BlockFoundersApi
import app.pantopus.android.data.api.services.FridgeCardsApi
import app.pantopus.android.data.api.services.GeoApi
import app.pantopus.android.data.api.services.HomesApi
import app.pantopus.android.data.api.services.MailboxCheckApi
import app.pantopus.android.data.api.services.NeighborMessagesApi
import app.pantopus.android.data.api.services.PlaceApi
import app.pantopus.android.data.api.services.RealRentApi
import app.pantopus.android.data.api.services.RecordWatchApi
import app.pantopus.android.data.api.services.ResidencyClaimsApi
import app.pantopus.android.data.api.services.ResidencyLettersApi
import app.pantopus.android.data.api.services.UnlistedApi
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
// A deliberately flat façade over the Place feature's five APIs —
// cohesive by design; the count grows one wave at a time.
@Suppress("TooManyFunctions", "LongParameterList")
class PlaceRepository
    @Inject
    constructor(
        private val placeApi: PlaceApi,
        private val neighborMessagesApi: NeighborMessagesApi,
        private val residencyClaimsApi: ResidencyClaimsApi,
        private val residencyLettersApi: ResidencyLettersApi,
        private val fridgeCardsApi: FridgeCardsApi,
        private val mailboxCheckApi: MailboxCheckApi,
        private val recordWatchApi: RecordWatchApi,
        private val realRentApi: RealRentApi,
        private val blockFoundersApi: BlockFoundersApi,
        private val unlistedApi: UnlistedApi,
        private val aiApi: AIApi,
        private val geoApi: GeoApi,
        private val homesApi: HomesApi,
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

        // ─── Address calendar (Wedge v2 D6) ────────────────────

        suspend fun addressCalendar(homeId: String): NetworkResult<AddressCalendarResponse> =
            safeApiCall { placeApi.addressCalendar(homeId) }

        suspend fun setPickupDay(
            homeId: String,
            weekday: String,
            recyclingEveryOtherWeek: Boolean = true,
        ): NetworkResult<AddressCalendarResponse> =
            safeApiCall { placeApi.setPickupDay(homeId, SetPickupDayRequest(weekday, recyclingEveryOtherWeek)) }

        suspend fun clearPickupDay(homeId: String): NetworkResult<AddressCalendarResponse> = safeApiCall { placeApi.clearPickupDay(homeId) }

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

        // ── Residency Pass — scoped live claims (Wave 1) ─────────

        suspend fun residencyClaims(homeId: String): NetworkResult<ResidencyClaimsResponse> =
            safeApiCall { residencyClaimsApi.list(homeId) }

        suspend fun issueResidencyClaim(
            homeId: String,
            scope: String,
            expiresInDays: Int,
        ): NetworkResult<ResidencyClaimResponse> =
            safeApiCall { residencyClaimsApi.issue(homeId, IssueResidencyClaimRequest(scope, expiresInDays)) }

        suspend fun revokeResidencyClaim(
            homeId: String,
            claimId: String,
        ): NetworkResult<ResidencyClaimResponse> = safeApiCall { residencyClaimsApi.revoke(homeId, claimId) }

        /** The home's existing emergency info — the fridge-card utilities pre-seed. */
        suspend fun homeEmergencies(homeId: String): NetworkResult<GetHomeEmergenciesResponse> =
            safeApiCall { homesApi.getHomeEmergencies(homeId) }

        // ── Fridge cards — the 911-ready household card (Wave 1) ─

        suspend fun fridgeCards(homeId: String): NetworkResult<FridgeCardsResponse> = safeApiCall { fridgeCardsApi.list(homeId) }

        suspend fun issueFridgeCard(
            homeId: String,
            body: IssueFridgeCardRequest,
        ): NetworkResult<FridgeCardResponse> = safeApiCall { fridgeCardsApi.issue(homeId, body) }

        suspend fun revokeFridgeCard(
            homeId: String,
            cardId: String,
        ): NetworkResult<FridgeCardResponse> = safeApiCall { fridgeCardsApi.revoke(homeId, cardId) }

        /** The mailbox reality check (Wave 1, #3) — read-only diagnostic. */
        suspend fun mailboxCheck(homeId: String): NetworkResult<MailboxCheckResponse> = safeApiCall { mailboxCheckApi.check(homeId) }

        // ── Home Record Watch, rate-watch half (Wave 2b) ─────────

        suspend fun recordWatch(homeId: String): NetworkResult<RecordWatchResponse> = safeApiCall { recordWatchApi.get(homeId) }

        suspend fun setRecordWatch(
            homeId: String,
            loanRecordedMonth: String,
        ): NetworkResult<RecordWatchResponse> = safeApiCall { recordWatchApi.set(homeId, SetRecordWatchRequest(loanRecordedMonth)) }

        suspend fun removeRecordWatch(homeId: String): NetworkResult<RemoveRecordWatchResponse> =
            safeApiCall { recordWatchApi.remove(homeId) }

        // ── Real Rent Benchmark — the contribution (Wave 3, T4) ──
        // The block aggregate is NOT here; it rides the intelligence
        // contract's `real_rent` section behind the k>=10 floor.

        suspend fun rentReport(homeId: String): NetworkResult<RentReportResponse> = safeApiCall { realRentApi.get(homeId) }

        /**
         * Writing is gated to a VERIFIED resident, and the route's 403
         * sentence ("Verify your address to add your rent…") is the next
         * step, not a dead end — so this call opts into carrying the
         * server's 403 body through instead of the canned
         * "You don't have permission to do that."
         */
        suspend fun setRentReport(
            homeId: String,
            monthlyRent: Int,
            bedrooms: Int? = null,
        ): NetworkResult<RentReportResponse> =
            safeApiCall(surfaceForbiddenBody = true) {
                realRentApi.set(homeId, SetRentReportRequest(monthlyRent, bedrooms))
            }

        suspend fun removeRentReport(homeId: String): NetworkResult<RemoveRentReportResponse> =
            safeApiCall(surfaceForbiddenBody = true) { realRentApi.remove(homeId) }

        // ── Block Founders — rank, meters, postcard invites (T4) ─

        suspend fun blockFounders(homeId: String): NetworkResult<BlockStatusResponse> = safeApiCall { blockFoundersApi.status(homeId) }

        suspend fun sendBlockInvite(
            homeId: String,
            recipient: BlockInviteRecipient,
        ): NetworkResult<BlockInviteResult> = safeApiCall { blockFoundersApi.invite(homeId, BlockInviteRequest(recipient)) }

        // ── Unlisted — the state escape hatch + removal paths (T1+) ─
        // We never query the broker sites: a lookup would disclose the
        // address to the very companies the caller is leaving. Nothing
        // here asks, or answers, whether someone IS listed.

        /**
         * The state profile plus the CALLER's own progress. Gated on
         * home access, not verification. `unlisted.removals` is null
         * when the progress read failed — distinct from the empty list.
         */
        suspend fun unlisted(homeId: String): NetworkResult<HomeUnlistedResponse> = safeApiCall { unlistedApi.forHome(homeId) }

        /** The anonymous, address-only profile. Persists nothing. */
        suspend fun publicUnlisted(address: String): NetworkResult<PublicUnlistedResponse> =
            safeApiCall { unlistedApi.publicUnlisted(address) }

        /**
         * Record a step. [status] must be sendable — UNKNOWN is a decode
         * fallback, never a value the server accepts (`BAD_STATUS`).
         */
        suspend fun setUnlistedRemoval(
            homeId: String,
            brokerId: String,
            status: UnlistedRemovalStatus,
        ): NetworkResult<UnlistedRemovalResponse> =
            safeApiCall {
                unlistedApi.setRemoval(homeId, brokerId, SetUnlistedRemovalRequest(status.wire))
            }
    }
