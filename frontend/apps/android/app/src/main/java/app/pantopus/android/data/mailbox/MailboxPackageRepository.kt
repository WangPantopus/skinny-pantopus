package app.pantopus.android.data.mailbox

import app.pantopus.android.data.api.models.mailbox.v2.PackageGigRequest
import app.pantopus.android.data.api.models.mailbox.v2.PackageGigResponse
import app.pantopus.android.data.api.models.mailbox.v2.PackageSaveWarrantyRequest
import app.pantopus.android.data.api.models.mailbox.v2.PackageSaveWarrantyResponse
import app.pantopus.android.data.api.models.mailbox.v2.PackageUnboxingRequest
import app.pantopus.android.data.api.models.mailbox.v2.PackageUnboxingResponse
import app.pantopus.android.data.api.models.mailbox.v2.SharePackageEtaResponse
import app.pantopus.android.data.api.models.mailbox.v2.UnboxingPackageResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.MailboxPackageApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Package + unboxing persistence (A17.14). Wraps [MailboxPackageApi] in
 * the [NetworkResult] taxonomy.
 */
@Singleton
open class MailboxPackageRepository
    @Inject
    constructor(
        private val api: MailboxPackageApi,
    ) {
        /** `GET api/mailbox/v2/package/:mailId`. */
        open suspend fun packageDetail(mailId: String): NetworkResult<UnboxingPackageResponse> = safeApiCall { api.packageDetail(mailId) }

        /** `POST api/mailbox/v2/p2/package/:mailId/unboxing`. */
        open suspend fun recordUnboxing(
            mailId: String,
            request: PackageUnboxingRequest,
        ): NetworkResult<PackageUnboxingResponse> = safeApiCall { api.recordUnboxing(mailId, request) }

        /** `POST api/mailbox/v2/p2/package/:mailId/save-warranty`. */
        open suspend fun saveWarranty(
            mailId: String,
            type: String,
        ): NetworkResult<PackageSaveWarrantyResponse> = safeApiCall { api.saveWarranty(mailId, PackageSaveWarrantyRequest(type = type)) }

        /** `POST api/mailbox/v2/p2/package/:mailId/gig`. */
        open suspend fun createPackageGig(
            mailId: String,
            request: PackageGigRequest,
        ): NetworkResult<PackageGigResponse> = safeApiCall { api.createPackageGig(mailId, request) }

        /** `POST api/mailbox/v2/package/:mailId/share-eta`. */
        open suspend fun shareEta(mailId: String): NetworkResult<SharePackageEtaResponse> = safeApiCall { api.shareEta(mailId) }
    }
