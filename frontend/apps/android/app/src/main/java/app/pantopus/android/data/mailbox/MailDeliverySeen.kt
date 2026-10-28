package app.pantopus.android.data.mailbox

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Which morning round's delivery moment (the mailbox door opening, today's mail sliding out) this phone has shown each
 * person, so it plays once per delivery (Mail tab drawings, `R2-Delivery`), and whether it has shown them the first
 * day's porch with the sealed welcome letter (`R12-Welcome`), which comes once. Only the round's time and the welcome
 * letter's id are kept.
 */
@Singleton
class MailDeliverySeen
    @Inject
    constructor(
        @ApplicationContext context: Context,
    ) {
        private val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

        fun shown(
            userId: String,
            deliveredAt: String,
        ): Boolean = prefs.getString(key(userId), null) == deliveredAt

        fun markShown(
            userId: String,
            deliveredAt: String,
        ) {
            prefs.edit().putString(key(userId), deliveredAt).apply()
        }

        /** The porch came up for this person on this phone, whether they opened the letter or closed it. */
        fun welcomeShown(userId: String): Boolean = prefs.getString(welcomeKey(userId), null) != null

        fun markWelcomeShown(
            userId: String,
            mailId: String,
        ) {
            prefs.edit().putString(welcomeKey(userId), mailId).apply()
        }

        private fun key(userId: String) = "delivery_shown.$userId"

        private fun welcomeKey(userId: String) = "welcome_porch_shown.$userId"

        private companion object {
            const val PREFS = "pantopus.mail_delivery"
        }
    }
