@file:Suppress("PackageNaming")

package app.pantopus.android.data.api.models.mailbox.v2

import app.pantopus.android.data.api.models.common.JsonValue
import app.pantopus.android.ui.screens.mailbox.item_detail.MailItemCategory

/**
 * Discriminated union of category-specific sub-payloads decoded from
 * `mail.object_payload`. The view-model resolves this once per item
 * load; bodies switch on it to render the right surface.
 */
sealed interface MailboxCategoryPayload {
    data class Coupon(val detail: CouponDetailDto) : MailboxCategoryPayload

    data class Booklet(val detail: BookletDetailDto) : MailboxCategoryPayload

    data class Certified(val detail: CertifiedDetailDto) : MailboxCategoryPayload

    data class Community(val detail: CommunityDetailDto) : MailboxCategoryPayload

    data class Gig(val detail: GigDetailDto) : MailboxCategoryPayload

    data class Memory(val detail: MemoryDetailDto) : MailboxCategoryPayload

    data class Records(val detail: RecordsDetailDto) : MailboxCategoryPayload

    /**
     * No category-specific decoder applies (Package, Bill, Notice, …).
     * Bodies fall back to the generic placeholder layout.
     */
    data object Other : MailboxCategoryPayload

    companion object {
        /**
         * Resolve a payload from a category + raw object_payload JSON.
         * Falls back to [Other] when the category doesn't have a
         * dedicated body decoder or when decoding fails.
         */
        fun resolve(
            category: MailItemCategory,
            objectPayload: JsonValue?,
        ): MailboxCategoryPayload =
            when (category) {
                MailItemCategory.Coupon ->
                    CouponDetailDto.decodeFromObjectPayload(objectPayload)
                        ?.let(::Coupon) ?: Other
                MailItemCategory.Booklet ->
                    BookletDetailDto.decodeFromObjectPayload(objectPayload)
                        ?.let(::Booklet) ?: Other
                MailItemCategory.Certified ->
                    CertifiedDetailDto.decodeFromObjectPayload(objectPayload)
                        ?.let(::Certified) ?: Other
                MailItemCategory.Community ->
                    CommunityDetailDto.decodeFromObjectPayload(objectPayload)
                        ?.let(::Community) ?: Other
                MailItemCategory.Gig ->
                    GigDetailDto.decodeFromObjectPayload(objectPayload)
                        ?.let(::Gig) ?: Other
                MailItemCategory.Memory ->
                    MemoryDetailDto.decodeFromObjectPayload(objectPayload)
                        ?.let(::Memory) ?: Other
                MailItemCategory.Records ->
                    RecordsDetailDto.decodeFromObjectPayload(objectPayload)
                        ?.let(::Records) ?: Other
                else -> Other
            }
    }
}
