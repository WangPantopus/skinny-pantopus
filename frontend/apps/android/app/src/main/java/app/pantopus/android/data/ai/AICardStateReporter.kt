package app.pantopus.android.data.ai

import app.pantopus.android.data.api.models.ai.AICardStateReportBody
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.api.net.safeApiCall
import app.pantopus.android.data.api.services.AIApi
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import timber.log.Timber
import javax.inject.Inject
import javax.inject.Singleton

/**
 * Tells the server what ran on the assistant's action cards (AI assistant phase 3 contract §4.2, §4.4), so a card used on
 * one phone shows as done on the person's other phones, and after Clear data. Each report is kept in [AIActionCardStore]
 * before it goes out, in the background; one the server didn't take stays there, unreported, and goes again the next
 * time the assistant thread opens ([retryUnreported]). A card the server has no record of (`404 CARD_UNKNOWN`: from
 * before phase 3, or its recording failed) is let go: this phone's own record covers it.
 */
@Singleton
class AICardStateReporter
    @Inject
    constructor(
        private val api: AIApi,
        private val store: AIActionCardStore,
    ) {
        private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

        // One report at a time: a retry never races the same report going out.
        private val sending = Mutex()

        /** A button that went through: [itemId] is its row's id, null for the card's own buttons; [link] is what showed. */
        fun reportDone(
            userId: String,
            cardId: String,
            itemId: String?,
            actionId: String,
            link: String?,
        ) = report(AIActionCardStore.Report(userId, cardId, STATUS_DONE, itemId = itemId, actionId = actionId, link = link))

        /**
         * [reportDone] for a notification button (phase 3 contract §9.3): it waits for the answer, within the button's
         * time limit; a report that doesn't get through stays unreported for the thread to send.
         */
        suspend fun reportDoneNow(
            userId: String,
            cardId: String,
            itemId: String?,
            actionId: String,
        ) {
            val report = AIActionCardStore.Report(userId, cardId, STATUS_DONE, itemId = itemId, actionId = actionId)
            if (report.userId.isBlank()) return
            store.markUnreported(report)
            sending.withLock { deliver(report) }
        }

        /** "Not now". */
        fun reportDismissed(
            userId: String,
            cardId: String,
        ) = report(AIActionCardStore.Report(userId, cardId, STATUS_DISMISSED))

        /** [userId]'s reports that didn't reach the server yet, oldest first; it stops at the first that fails again. */
        fun retryUnreported(userId: String) {
            if (userId.isBlank()) return
            scope.launch {
                sending.withLock {
                    for (report in store.unreported(userId)) {
                        if (!deliver(report)) break
                    }
                }
            }
        }

        private fun report(report: AIActionCardStore.Report) {
            if (report.userId.isBlank()) return
            store.markUnreported(report)
            scope.launch { sending.withLock { deliver(report) } }
        }

        /** True once the report is settled: taken, or refused for good. False to send it again later. */
        private suspend fun deliver(report: AIActionCardStore.Report): Boolean {
            val body = AICardStateReportBody(status = report.status, actionId = report.actionId, itemId = report.itemId, link = report.link)
            val settled =
                when (val result = safeApiCall { api.reportCardState(report.cardId, body) }) {
                    is NetworkResult.Success -> true
                    // A card it has no record of, an action it doesn't know: sending it again changes nothing.
                    is NetworkResult.Failure -> result.error.code in REFUSED_FOR_GOOD
                }
            if (settled) {
                store.markReported(report)
            } else {
                Timber.w("AI card state not reported yet (%s)", report.status)
            }
            return settled
        }

        private companion object {
            const val STATUS_DONE = "done"
            const val STATUS_DISMISSED = "dismissed"

            /** 400 `CARD_ACTION_UNKNOWN` (or a body it refuses), 403, 404 `CARD_UNKNOWN`. A 409 `CARD_BUSY` goes again. */
            val REFUSED_FOR_GOOD = setOf(400, 403, 404)
        }
    }
