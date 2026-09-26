@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.mailbox.v2

import app.pantopus.android.data.api.models.common.JsonValue

/** One step in the chain-of-custody timeline. */
data class CertifiedChainStep(
    val id: String,
    val label: String,
    val occurredAt: String?,
    val isComplete: Boolean,
)

/**
 * Certified-mail sub-payload decoded from `mail.object_payload` when
 * `mail_type == "certified"`. [decodeFromObjectPayload] returns null
 * when the payload doesn't carry a reference number.
 */
data class CertifiedDetailDto(
    val referenceNumber: String,
    val documentType: String?,
    val acknowledgeBy: String?,
    val chain: List<CertifiedChainStep>,
    val noticeBody: String?,
    val termsUrl: String?,
    val isAcknowledged: Boolean,
    /**
     * False for Pantopus certified mail (`Mail.certified`), which has no
     * postal carrier, tracking number or postmark.
     */
    val isPostal: Boolean = true,
) {
    /** A copy with chain step [id] done at [stamp]; the "acknowledged" step also marks it signed. */
    fun completing(
        id: String,
        stamp: String,
    ): CertifiedDetailDto =
        copy(
            chain = chain.map { if (it.id == id && !it.isComplete) it.copy(occurredAt = stamp, isComplete = true) else it },
            isAcknowledged = isAcknowledged || id == "acknowledged",
        )

    companion object {
        /** Pantopus certified mail: Received → Read → Signed, from the letter's own timestamps. */
        fun pantopus(
            reference: String,
            receivedAt: String,
            readAt: String?,
            signedAt: String?,
        ): CertifiedDetailDto =
            CertifiedDetailDto(
                referenceNumber = reference,
                documentType = null,
                acknowledgeBy = null,
                chain =
                    listOf(
                        CertifiedChainStep(id = "delivered", label = "Received", occurredAt = receivedAt, isComplete = true),
                        CertifiedChainStep(id = "read", label = "Read", occurredAt = readAt, isComplete = readAt != null),
                        CertifiedChainStep(id = "acknowledged", label = "Signed", occurredAt = signedAt, isComplete = signedAt != null),
                    ),
                noticeBody = null,
                termsUrl = null,
                isAcknowledged = signedAt != null,
                isPostal = false,
            )

        fun decodeFromObjectPayload(payload: JsonValue?): CertifiedDetailDto? {
            if (payload == null) return null
            val reference =
                (payload["reference_number"] as? String)
                    ?: (payload["reference"] as? String)
                    ?: return null
            if (reference.isEmpty()) return null
            val rawChain = payload["chain"] as? List<*> ?: emptyList<Any?>()
            val chain =
                rawChain.mapNotNull { entry ->
                    @Suppress("UNCHECKED_CAST")
                    val map = entry as? Map<String, Any?> ?: return@mapNotNull null
                    val id =
                        (map["id"] as? String)
                            ?: (map["status"] as? String)
                            ?: return@mapNotNull null
                    val label =
                        (map["label"] as? String)
                            ?: (map["title"] as? String)
                            ?: return@mapNotNull null
                    val occurredAt = map["occurred_at"] as? String
                    val isComplete =
                        (map["complete"] as? Boolean) ?: (occurredAt != null)
                    CertifiedChainStep(
                        id = id,
                        label = label,
                        occurredAt = occurredAt,
                        isComplete = isComplete,
                    )
                }
            return CertifiedDetailDto(
                referenceNumber = reference,
                documentType = payload["document_type"] as? String,
                acknowledgeBy = payload["acknowledge_by"] as? String,
                chain = chain,
                noticeBody =
                    (payload["notice_body"] as? String)
                        ?: (payload["body"] as? String),
                termsUrl = payload["terms_url"] as? String,
                isAcknowledged = (payload["is_acknowledged"] as? Boolean) ?: false,
            )
        }
    }
}
