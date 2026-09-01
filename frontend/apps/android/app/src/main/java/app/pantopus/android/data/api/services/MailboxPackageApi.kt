package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.mailbox.v2.PackageGigRequest
import app.pantopus.android.data.api.models.mailbox.v2.PackageGigResponse
import app.pantopus.android.data.api.models.mailbox.v2.PackageSaveWarrantyRequest
import app.pantopus.android.data.api.models.mailbox.v2.PackageSaveWarrantyResponse
import app.pantopus.android.data.api.models.mailbox.v2.PackageUnboxingRequest
import app.pantopus.android.data.api.models.mailbox.v2.PackageUnboxingResponse
import app.pantopus.android.data.api.models.mailbox.v2.SharePackageEtaResponse
import app.pantopus.android.data.api.models.mailbox.v2.UnboxingPackageResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * Phase-2 package/unboxing routes from
 * `backend/routes/mailboxV2Phase2.js` (mounted at `api/mailbox/v2/p2`,
 * `backend/app.js:316`), plus the typed package read. These back the
 * A17.14 Unboxing screen, which used to be a pure in-memory fixture —
 * every action now persists.
 */
interface MailboxPackageApi {
    /**
     * `GET api/mailbox/v2/package/:mailId` — route
     * `backend/routes/mailboxV2.js:634`. Typed view of the `MailPackage`
     * row, including the Phase-2 unboxing columns.
     */
    @GET("api/mailbox/v2/package/{mailId}")
    suspend fun packageDetail(
        @Path("mailId") mailId: String,
    ): UnboxingPackageResponse

    /**
     * `POST api/mailbox/v2/p2/package/:mailId/unboxing` — route
     * `backend/routes/mailboxV2Phase2.js:1217`. Records the condition
     * photo on the package row and marks the unboxing complete.
     */
    @POST("api/mailbox/v2/p2/package/{mailId}/unboxing")
    suspend fun recordUnboxing(
        @Path("mailId") mailId: String,
        @Body body: PackageUnboxingRequest,
    ): PackageUnboxingResponse

    /**
     * `POST api/mailbox/v2/p2/package/:mailId/save-warranty` — route
     * `backend/routes/mailboxV2Phase2.js:1246`. Flips `warranty_saved` /
     * `manual_saved` and auto-files the document to the caller's
     * Home › Warranties vault folder.
     */
    @POST("api/mailbox/v2/p2/package/{mailId}/save-warranty")
    suspend fun saveWarranty(
        @Path("mailId") mailId: String,
        @Body body: PackageSaveWarrantyRequest,
    ): PackageSaveWarrantyResponse

    /**
     * `POST api/mailbox/v2/p2/package/:mailId/gig` — route
     * `backend/routes/mailboxV2Phase2.js:1280`. Posts the help gig for
     * this package; the backend picks pre- vs post-delivery copy from the
     * package status.
     */
    @POST("api/mailbox/v2/p2/package/{mailId}/gig")
    suspend fun createPackageGig(
        @Path("mailId") mailId: String,
        @Body body: PackageGigRequest,
    ): PackageGigResponse

    /**
     * `POST api/mailbox/v2/package/:mailId/share-eta` — route
     * `backend/routes/mailboxV2.js:727`. Drops a "package arriving soon"
     * notice into every other resident's Home drawer and returns how many
     * people were notified. Mirrors RN `src/app/mailbox/package.tsx:40-48`.
     */
    @POST("api/mailbox/v2/package/{mailId}/share-eta")
    suspend fun shareEta(
        @Path("mailId") mailId: String,
    ): SharePackageEtaResponse
}
