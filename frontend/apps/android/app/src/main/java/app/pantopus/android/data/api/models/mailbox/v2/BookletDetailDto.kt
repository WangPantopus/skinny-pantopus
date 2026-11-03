@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.mailbox.v2

import app.pantopus.android.data.api.models.common.JsonValue

/**
 * Booklet sub-payload decoded from `mail.object_payload` when
 * `mail_type == "booklet"`. Backend stores this as untyped JSON in S3.
 * [decodeFromObjectPayload] returns null when the payload doesn't list
 * any pages.
 */
data class BookletDetailDto(
    val pages: List<String>,
    val summary: String?,
    val pageCount: Int,
    /**
     * Per-page OCR transcripts, index-aligned with [pages]. Optional —
     * the A17.2 OCR card only renders for pages that carry text.
     */
    val ocrTexts: List<String> = emptyList(),
) {
    companion object {
        fun decodeFromObjectPayload(payload: JsonValue?): BookletDetailDto? {
            if (payload == null) return null
            val rawPages = payload["pages"] as? List<*> ?: emptyList<Any?>()
            val pageIndices = rawPages.indices.filter { (rawPages[it] as? String)?.isNotBlank() == true }
            val pages = pageIndices.map { rawPages[it] as String }
            if (pages.isEmpty()) return null
            val pageCount =
                (payload["page_count"] as? Number)?.toInt() ?: pages.size
            val rawText = payload["ocr_texts"] as? List<*>
            // Missing text on one page must not move the next page's transcript onto it.
            val ocrTexts = pageIndices.map { rawText?.getOrNull(it) as? String ?: "" }
            return BookletDetailDto(
                pages = pages,
                summary = payload["summary"] as? String,
                pageCount = pageCount,
                ocrTexts = ocrTexts,
            )
        }
    }
}
