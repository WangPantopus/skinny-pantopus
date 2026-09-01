package app.pantopus.android.data.mailbox

import app.pantopus.android.data.api.models.mailbox.p3.AssetMailResponse
import app.pantopus.android.data.api.models.mailbox.p3.AssetSuggestionsResponse
import app.pantopus.android.data.api.models.mailbox.p3.AutoDetectAssetsRequest
import app.pantopus.android.data.api.models.mailbox.p3.AutoDetectAssetsResponse
import app.pantopus.android.data.api.models.mailbox.p3.HomeAssetsResponse
import app.pantopus.android.data.api.models.mailbox.p3.LinkMailToAssetRequest
import app.pantopus.android.data.api.models.mailbox.p3.LinkMailToAssetResponse
import app.pantopus.android.data.api.models.mailbox.p3.UnlinkMailFromAssetResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.MailboxRecordsApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Thin wrapper around [MailboxRecordsApi] returning the typed
 * [NetworkResult] taxonomy. Backs the Home Records asset hub.
 */
@Singleton
open class MailboxRecordsRepository
    @Inject
    constructor(
        private val api: MailboxRecordsApi,
    ) {
        /** `GET api/mailbox/v2/p3/records/assets`. */
        open suspend fun assets(homeId: String? = null): NetworkResult<HomeAssetsResponse> = safeApiCall { api.assets(homeId) }

        /** `GET api/mailbox/v2/p3/records/asset/:id/mail`. */
        open suspend fun assetMail(assetId: String): NetworkResult<AssetMailResponse> = safeApiCall { api.assetMail(assetId) }

        /** `POST api/mailbox/v2/p3/records/auto-detect`. */
        open suspend fun autoDetect(homeId: String): NetworkResult<AutoDetectAssetsResponse> =
            safeApiCall { api.autoDetect(AutoDetectAssetsRequest(homeId = homeId)) }

        /** `GET api/mailbox/v2/p3/records/suggestions`. */
        open suspend fun suggestions(homeId: String? = null): NetworkResult<AssetSuggestionsResponse> =
            safeApiCall { api.suggestions(homeId) }

        /** `POST api/mailbox/v2/p3/records/link`. */
        open suspend fun link(
            mailId: String,
            assetId: String,
            linkType: String = "manual",
        ): NetworkResult<LinkMailToAssetResponse> =
            safeApiCall {
                api.link(
                    LinkMailToAssetRequest(
                        mailId = mailId,
                        assetId = assetId,
                        linkType = linkType,
                    ),
                )
            }

        /** `DELETE api/mailbox/v2/p3/records/unlink/:id`. */
        open suspend fun unlink(linkId: String): NetworkResult<UnlinkMailFromAssetResponse> = safeApiCall { api.unlink(linkId) }
    }
