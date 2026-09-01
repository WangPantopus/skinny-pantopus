@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.polish

import app.pantopus.android.ui.theme.PantopusIcon

/**
 * H15 Notification / Reminder Permission & Channel Connect Prompt · Stream A18.
 *
 * The value types the just-in-time channel-connect prompt is driven by: the
 * delivery channel being connected, the frame the surface shows, the collapsed
 * OS push state, and the result reported back to the presenter.
 *
 * Wiring (see `reference/calendarly-backend-api.md` + the A18 GLOBAL WIRING
 * CONTRACT): push is a real OS gate (Android 13+ `POST_NOTIFICATIONS`);
 * email/SMS channel state round-trips through `GET/PUT /notification-preferences`
 * (`prefs.channels`, unknown keys preserved); SMS stays "coming soon" — the same
 * locked-S / 501-connect treatment used elsewhere in Calendarly.
 */
enum class NotificationChannel(val key: String) {
    Push("push"),
    Email("email"),
    Sms("sms"),
    ;

    /**
     * SMS is not yet deliverable server-side — surfaced with the same "coming
     * soon" treatment as the locked S column and the `POST /connected-calendars/connect`
     * 501 response, so a reminder is never wired to a dead channel.
     */
    val isComingSoon: Boolean get() = this == Sms

    /** Hero glyph for the channel's prompt frame. */
    val glyph: PantopusIcon
        get() =
            when (this) {
                Push -> PantopusIcon.BellRing
                Email -> PantopusIcon.Mail
                Sms -> PantopusIcon.MessageSquare
            }

    /** Title shown on the connected/success frame. */
    val connectedTitle: String
        get() =
            when (this) {
                Push -> "Push is on"
                Email -> "Email confirmed"
                Sms -> "Phone confirmed"
            }

    /**
     * Body shown on the connected/success frame. [target] is the verified email
     * or phone number (ignored for push, which targets the device).
     */
    fun connectedBody(target: String): String =
        when (this) {
            Push -> "Reminders will send to this device."
            Email, Sms -> "Reminders will send to $target."
        }
}

/**
 * Which frame of the H15 prompt is showing. The owning surface sets the initial
 * frame; the prompt advances it as permission is granted or a code is verified.
 */
sealed interface NotificationPromptFrame {
    /** Request OS push permission for this device. */
    data object Push : NotificationPromptFrame

    /** Confirm the account email a reminder will use (carries the address). */
    data class EmailVerify(val email: String) : NotificationPromptFrame

    /** Verify a phone for SMS (coming soon). */
    data object SmsVerify : NotificationPromptFrame

    /** Channel granted/verified — the calm success frame. */
    data class Connected(val channel: NotificationChannel) : NotificationPromptFrame

    /** Push is off at the OS level — deep-link to Settings; email still works. */
    data object Denied : NotificationPromptFrame
}

/** The OS push authorization state, collapsed to the three the prompt branches on. */
enum class PushPermissionStatus {
    NotDetermined,
    Denied,
    Authorized,
}

/**
 * Reported back to the surface that presented the prompt so it can reflect the
 * channel's new state on its own toggle (e.g. the Default Reminders sheet).
 */
sealed interface NotificationChannelConnectResult {
    data class Connected(val channel: NotificationChannel) : NotificationChannelConnectResult

    data object DeniedPush : NotificationChannelConnectResult

    data object Dismissed : NotificationChannelConnectResult
}
