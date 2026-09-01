package app.pantopus.android.data.mailbox

import app.pantopus.android.data.api.models.mailbox.v2.BookletDownloadResponse
import app.pantopus.android.data.api.models.mailbox.v2.CertifiedProofResponse
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.MailboxDocumentApi
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Thin wrapper around [MailboxDocumentApi] that maps throwables into the
 * [NetworkResult] taxonomy. Backs the A17.2 booklet "PDF" tile and the
 * A17.3 certified "Proof" tile.
 */
@Singleton
class MailboxDocumentRepository
    @Inject
    constructor(
        private val api: MailboxDocumentApi,
    ) {
        /** `POST api/mailbox/v2/p2/booklet/:mailId/download`. */
        suspend fun bookletDownload(mailId: String): NetworkResult<BookletDownloadResponse> = safeApiCall { api.bookletDownload(mailId) }

        /** `GET api/mailbox/v2/p2/certified/:mailId/proof`. */
        suspend fun certifiedProof(mailId: String): NetworkResult<CertifiedProofResponse> = safeApiCall { api.certifiedProof(mailId) }
    }
