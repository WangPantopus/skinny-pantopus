@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.mail_detail.letter

import app.pantopus.android.data.api.models.mailbox.v2.MailEnclosure
import app.pantopus.android.ui.screens.mailbox.components.MailPieceModel
import java.io.File

/** An enclosure saved on the phone, ready for a viewer. */
data class OpenedEnclosure(
    val file: File,
    val mimeType: String,
    val name: String,
)

/** A bundle's pieces on its letter page (`GET /api/mailbox/v2/item/:id`, `pieces`). */
sealed interface MailBundleState {
    data object Loading : MailBundleState

    data class Loaded(
        val pieces: List<MailPieceModel>,
    ) : MailBundleState

    data class Failed(
        val message: String,
    ) : MailBundleState
}

/** Why a piece couldn't open, and what to do about it (the message itself is the page's error text). */
sealed interface MailCantOpen {
    /** Home mail waiting for proof of the address: Verify your home, for [homeId] when the mailbox names one. */
    data class NeedsProof(
        val homeId: String?,
        val address: String?,
    ) : MailCantOpen

    /** Not this person's, shredded and gone, or never there: back to Mail. */
    data object NotFound : MailCantOpen
}

/** What the letter page's buttons do; the screen confirms Done and Shred first. */
data class LetterActions(
    val onEnvelope: () -> Unit,
    val onPay: (String) -> Unit,
    val onAcknowledge: () -> Unit,
    val onPutOnCounter: () -> Unit,
    val onDone: () -> Unit,
    val onFile: () -> Unit,
    val onUnfile: () -> Unit,
    val onShred: () -> Unit,
    val onOpenEnclosure: (MailEnclosure) -> Unit,
    val onOpenPiece: (String) -> Unit,
    val onRetryBundle: () -> Unit,
)
