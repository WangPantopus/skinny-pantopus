package app.pantopus.android.data.mailbox

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Which morning round's delivery moment (the mailbox door opening, today's mail sliding out) this phone has shown each
 * person, so it plays once per delivery (Mail tab drawings, `R2-Delivery`). Only the round's time is kept.
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

        private fun key(userId: String) = "delivery_shown.$userId"

        private companion object {
            const val PREFS = "pantopus.mail_delivery"
        }
    }
