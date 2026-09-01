package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.mailbox.p3.AssetMailResponse
import app.pantopus.android.data.api.models.mailbox.p3.AssetSuggestionsResponse
import app.pantopus.android.data.api.models.mailbox.p3.AutoDetectAssetsRequest
import app.pantopus.android.data.api.models.mailbox.p3.AutoDetectAssetsResponse
import app.pantopus.android.data.api.models.mailbox.p3.HomeAssetsResponse
import app.pantopus.android.data.api.models.mailbox.p3.LinkMailToAssetRequest
import app.pantopus.android.data.api.models.mailbox.p3.LinkMailToAssetResponse
import app.pantopus.android.data.api.models.mailbox.p3.UnlinkMailFromAssetResponse
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/**
 * Home-Records routes from `backend/routes/mailboxV2Phase3.js`. The
 * Phase-3 router is mounted at `api/mailbox/v2/p3` — `backend/app.js:317`
 * — so each path below is that prefix plus the route-relative declaration.
 *
 * Mirrors `Core/Networking/Endpoints/MailboxRecordsEndpoints.swift` on iOS.
 */
interface MailboxRecordsApi {
    /**
     * `GET api/mailbox/v2/p3/records/assets` — route
     * `backend/routes/mailboxV2Phase3.js:182`. Assets for one home, or for
     * every accessible home when `homeId` is omitted. `rooms` backs the
     * filter chips.
     */
    @GET("api/mailbox/v2/p3/records/assets")
    suspend fun assets(
        @Query("homeId") homeId: String? = null,
    ): HomeAssetsResponse

    /**
     * `GET api/mailbox/v2/p3/records/asset/:id/mail` — route
     * `backend/routes/mailboxV2Phase3.js:238`. Asset detail with its linked
     * mail and photos. 403s when the asset's home is not one the caller
     * occupies.
     */
    @GET("api/mailbox/v2/p3/records/asset/{id}/mail")
    suspend fun assetMail(
        @Path("id") id: String,
    ): AssetMailResponse

    /**
     * `POST api/mailbox/v2/p3/records/auto-detect` — route
     * `backend/routes/mailboxV2Phase3.js:338`. Scans the 50 most recent
     * mail items carrying `key_facts` for appliance / warranty mentions.
     * `homeId` is required by the validator (route line 26).
     */
    @POST("api/mailbox/v2/p3/records/auto-detect")
    suspend fun autoDetect(
        @Body body: AutoDetectAssetsRequest,
    ): AutoDetectAssetsResponse

    /**
     * `GET api/mailbox/v2/p3/records/suggestions` — route
     * `backend/routes/mailboxV2Phase3.js:380`. Up to 10 not-yet-linked mail
     * items that mention an asset, each with its detections.
     */
    @GET("api/mailbox/v2/p3/records/suggestions")
    suspend fun suggestions(
        @Query("homeId") homeId: String? = null,
    ): AssetSuggestionsResponse

    /**
     * `POST api/mailbox/v2/p3/records/link` — route
     * `backend/routes/mailboxV2Phase3.js:296`. Links a mail item to an
     * asset and returns the created `MailAssetLink` — the only response
     * exposing its primary key, so keep it for [unlink].
     */
    @POST("api/mailbox/v2/p3/records/link")
    suspend fun link(
        @Body body: LinkMailToAssetRequest,
    ): LinkMailToAssetResponse

    /**
     * `DELETE api/mailbox/v2/p3/records/unlink/:id` — route
     * `backend/routes/mailboxV2Phase3.js:323`. `:id` is the `MailAssetLink`
     * primary key returned by [link].
     */
    @DELETE("api/mailbox/v2/p3/records/unlink/{id}")
    suspend fun unlink(
        @Path("id") id: String,
    ): UnlinkMailFromAssetResponse
}
