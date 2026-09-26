package app.pantopus.android.data.api.services

import app.pantopus.android.data.api.models.mailbox.v2.BookletDownloadResponse
import app.pantopus.android.data.api.models.mailbox.v2.CertifiedAcknowledgeBody
import app.pantopus.android.data.api.models.mailbox.v2.CertifiedAcknowledgeResponse
import app.pantopus.android.data.api.models.mailbox.v2.CertifiedProofResponse
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

/**
 * Document-artefact routes on the phase-2 mailbox router
 * (`backend/routes/mailboxV2Phase2.js`, mounted at `api/mailbox/v2/p2`
 * — `backend/app.js:316`):
 *
 *  - the booklet PDF download (A17.2 "PDF" tile), and
 *  - the certified-mail legal delivery proof (A17.3 "Proof" tile).
 *
 * Both are single-shot artefact fetches off a mail item's detail screen,
 * so they live together rather than in the heavily-shared
 * [MailboxV2Api].
 */
interface MailboxDocumentApi {
    /**
     * `POST api/mailbox/v2/p2/booklet/:mailId/download` — route
     * `backend/routes/mailboxV2Phase2.js:447`. Answers
     * `{ downloadUrl, sizeBytes }`, or 404 `{ error: 'Download not
     * available' }` when the row carries no `download_url`.
     */
    @POST("api/mailbox/v2/p2/booklet/{mailId}/download")
    suspend fun bookletDownload(
        @Path("mailId") mailId: String,
    ): BookletDownloadResponse

    /**
     * `GET api/mailbox/v2/p2/certified/:mailId/proof` — route
     * `backend/routes/mailboxV2Phase2.js:705`. Answers `{ proof: … }`
     * once the item has been acknowledged; 400 before that
     * ("Must acknowledge before downloading proof").
     */
    @GET("api/mailbox/v2/p2/certified/{mailId}/proof")
    suspend fun certifiedProof(
        @Path("mailId") mailId: String,
    ): CertifiedProofResponse

    /**
     * `POST api/mailbox/v2/p2/certified/acknowledge` — signs for certified
     * mail. Only the named recipient may; it records `acknowledged_at` and
     * the audit trail the proof reads, and answers 400 once already signed.
     */
    @POST("api/mailbox/v2/p2/certified/acknowledge")
    suspend fun certifiedAcknowledge(
        @Body body: CertifiedAcknowledgeBody,
    ): CertifiedAcknowledgeResponse
}
