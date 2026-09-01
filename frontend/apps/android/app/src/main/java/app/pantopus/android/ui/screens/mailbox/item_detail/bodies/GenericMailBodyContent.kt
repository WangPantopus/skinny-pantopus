@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.item_detail.bodies

import app.pantopus.android.ui.screens.mailbox.item_detail.MailItemCategory

/** Projection for the generic mailbox body surface — rendered by [GenericMailBody]. */
data class GenericMailBodyContent(
    val category: MailItemCategory,
    val paragraphs: List<String> = emptyList(),
    val attachments: List<String> = emptyList(),
    val tags: List<String> = emptyList(),
    val actionLabel: String? = null,
)
