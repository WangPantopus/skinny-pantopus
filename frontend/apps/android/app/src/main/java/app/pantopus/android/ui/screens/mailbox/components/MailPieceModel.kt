@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.components

import androidx.compose.ui.graphics.Color
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon

/**
 * What a piece is, drawn as that object (the server's `kind`, Mail build contract). Anything the app doesn't know
 * draws as a letter.
 */
enum class MailKind(
    val wire: String,
    val word: String,
) {
    Letter("letter", "Letter"),
    Bill("bill", "Bill"),
    Notice("notice", "Notice"),
    Postcard("postcard", "Postcard"),
    Booklet("booklet", "Booklet"),
    Parcel("parcel", "Parcel"),
    Bundle("bundle", "Bundle"),
    ;

    companion object {
        fun fromWire(value: String?): MailKind = entries.firstOrNull { it.wire == value?.lowercase() } ?: Letter
    }
}

/**
 * Who sent a piece, as Pantopus checked them. Verified senders carry printed postage with their [mark]; neighbors and
 * businesses with a Pantopus account that aren't verified yet put a stamp on; an unknown sender's bill carries nothing,
 * and every unknown sender says so in red.
 */
enum class MailSender(
    val line: String,
    val mark: String?,
    val color: Color,
    val icon: PantopusIcon,
) {
    Business("Verified business", "BUSINESS", PantopusColors.success, PantopusIcon.ShieldCheck),
    Government("Verified government", "GOVERNMENT", PantopusColors.success, PantopusIcon.ShieldCheck),
    Utility("Verified utility", "UTILITY", PantopusColors.success, PantopusIcon.ShieldCheck),
    Pantopus("From Pantopus", "PANTOPUS", PantopusColors.primary600, PantopusIcon.ShieldCheck),
    Neighbor("Pantopus neighbor · verified address", null, PantopusColors.appTextSecondary, PantopusIcon.ShieldCheck),

    /** A business with a Pantopus account that isn't verified yet, such as one invoicing a customer (SRV-7). */
    PantopusBusiness("Business on Pantopus", null, PantopusColors.info, PantopusIcon.Store),
    Unknown("Unverified sender", null, PantopusColors.error, PantopusIcon.AlertTriangle),
    ;

    /** People and businesses without printed postage put a stamp on. */
    val stamps: Boolean get() = this == Neighbor || this == PantopusBusiness

    companion object {
        /**
         * `sender_trust` as the server stores it, with Pantopus's own letters marked by `from_pantopus`; a Pantopus
         * account that sent as a business ([fromBusiness]) is a business on Pantopus, not a neighbor.
         */
        fun from(
            trust: String?,
            fromPantopus: Boolean,
            fromBusiness: Boolean = false,
        ): MailSender =
            when {
                fromPantopus -> Pantopus
                trust == "verified_gov" -> Government
                trust == "verified_utility" -> Utility
                trust == "verified_business" -> Business
                trust == "pantopus_user" -> if (fromBusiness) PantopusBusiness else Neighbor
                else -> Unknown
            }
    }
}

/** The three stamps in a stamp book: Fir, Peak and River. A piece always shows the same one. */
enum class MailStamp {
    Fir,
    Peak,
    River,
    ;

    companion object {
        fun forPiece(id: String): MailStamp = entries[(id.hashCode() and Int.MAX_VALUE) % entries.size]
    }
}

/**
 * One piece of mail as the Mailbox and search draw it: the object, who it's from and to, its marks and state, the
 * line under it, and the one sentence a screen reader says for it.
 */
data class MailPieceModel(
    val id: String,
    val kind: MailKind,
    val from: String,
    val fromLine: String?,
    val to: String?,
    val toLine: String?,
    val sender: MailSender,
    val opened: Boolean,
    val special: Boolean,
    /** 1 for new mail, down to 0.6 for opened mail that's months old. */
    val fade: Float,
    val postmarkTown: String?,
    /** "OCT 27". */
    val postmarkDay: String,
    /** "2026". */
    val postmarkYear: String,
    val stamp: MailStamp,
    /** The words the paper carries besides the addresses: a bill's enclosure, a postcard's message, a title. */
    val note: String?,
    /** Under the piece: "7:00 a.m. · Opened · Due Fri, Nov 7". */
    val meta: String,
    /** One sentence: what it is, from whom, sealed or opened, special, due. */
    val accessibilityLabel: String,
    val bundleCount: Int? = null,
    val pageCount: Int? = null,
)
