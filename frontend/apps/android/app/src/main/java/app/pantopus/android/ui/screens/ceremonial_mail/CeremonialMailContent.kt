@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.ceremonial_mail

import androidx.compose.runtime.Immutable
import app.pantopus.android.ui.theme.PantopusIcon

/** Four-step wizard order. */
enum class CeremonialMailStep(val index: Int) {
    Decide(0),
    Verify(1),
    Compose(2),
    Commit(3),
    Success(4),
    ;

    val stepNumber: Int?
        get() =
            when (this) {
                Decide -> 1
                Verify -> 2
                Compose -> 3
                Commit -> 4
                Success -> null
            }

    companion object {
        const val PROGRESS_TOTAL: Int = 4
    }
}

enum class CeremonialMailIntent(val wire: String, val title: String, val subtitle: String, val icon: PantopusIcon) {
    SayHello("say_hello", "Say hello", "A quick warm check-in.", PantopusIcon.Send),
    Congratulations("congratulations", "Congratulations", "Celebrate something good.", PantopusIcon.Star),
    Condolences("condolences", "Condolences", "Steady through a hard moment.", PantopusIcon.Heart),
    BusinessNote("business_note", "Business note", "Keep it professional.", PantopusIcon.Briefcase),
    JustBecause("just_because", "Just because", "Send a thought, no occasion needed.", PantopusIcon.Pencil),
}

enum class CeremonialMailStationery(val wire: String, val title: String) {
    ClassicCream("classic_cream", "Classic cream"),
    MidnightBlue("midnight_blue", "Midnight blue"),
    Linen("linen", "Linen white"),
    Botanical("botanical", "Botanical"),
}

enum class CeremonialMailInk(val wire: String, val title: String) {
    Walnut("walnut", "Walnut"),
    Navy("navy", "Navy"),
    Sepia("sepia", "Sepia"),
    Forest("forest", "Forest"),
}

enum class CeremonialMailSeal(val wire: String, val title: String) {
    WaxRed("wax_red", "Red wax"),
    WaxBlue("wax_blue", "Blue wax"),
    WaxBlack("wax_black", "Black wax"),
    None("none", "No seal"),
}

enum class CeremonialMailSendTiming(val wire: String, val title: String, val subtitle: String) {
    Now("now", "Send now", "Deliver as soon as the recipient opens Pantopus."),
    Morning("morning", "Tomorrow morning", "Land in their inbox at 8 a.m. local time."),
    Tomorrow("tomorrow", "Tomorrow evening", "Land in their inbox at 6 p.m. local time."),
}

/** Voice-postscript state. The recording side lives in the view
 *  layer; the VM owns upload + resolved URL. */
sealed interface VoicePostscriptStatus {
    data object Empty : VoicePostscriptStatus

    data object Recording : VoicePostscriptStatus

    data class Captured(val localUri: String) : VoicePostscriptStatus

    data object Uploading : VoicePostscriptStatus

    data class Uploaded(val remoteUrl: String) : VoicePostscriptStatus

    data class Error(val message: String) : VoicePostscriptStatus
}

/** Outbound nav event. */
sealed interface CeremonialMailEvent {
    data object Dismiss : CeremonialMailEvent

    data class OpenMail(val mailId: String) : CeremonialMailEvent
}

@Immutable
data class CeremonialMailFormState(
    val step: CeremonialMailStep = CeremonialMailStep.Decide,
    val recipientQuery: String = "",
    val intent: CeremonialMailIntent = CeremonialMailIntent.SayHello,
    val addressConfirmed: Boolean = false,
    val returnAddressShared: Boolean = false,
    val stationery: CeremonialMailStationery = CeremonialMailStationery.ClassicCream,
    val ink: CeremonialMailInk = CeremonialMailInk.Walnut,
    val seal: CeremonialMailSeal = CeremonialMailSeal.WaxRed,
    val bodyText: String = "",
    val sendTiming: CeremonialMailSendTiming = CeremonialMailSendTiming.Now,
)
