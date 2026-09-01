@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.scheduling.invitee.edge

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.core.routing.DeepLinkRouter
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.scheduling.SchedulingRepository
import app.pantopus.android.ui.screens.scheduling._shared.SchedulingRoutes
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * D9 — Open-in-App / deep-link hand-off. Consumes an inbound
 * `pantopus://…/book/:slug`, `…/book/o/:token`, or `…/booking/:token` link
 * (read **read-only** from the Foundation [DeepLinkRouter]) and routes the
 * app-having invitee into the native booking/manage flow with their identity and
 * timezone — instead of a degraded signed-out web flow. Resolves a small event
 * preview so the interstitial can confirm what they're about to open.
 *
 * NOTE (A0 Foundation gap): the frozen `RootTabScreen` drops a book/manage
 * `DeepLinkRouter.Destination.Unknown` without routing it here, and
 * `DeepLinkRouter` has no `Book`/`Manage` destination. This screen consumes the
 * pending link read-only and is correct the moment that routing is wired; it
 * never adds route plumbing itself.
 */
@HiltViewModel
class OpenInAppViewModel
    @Inject
    constructor(
        private val repo: SchedulingRepository,
    ) : ViewModel() {
        sealed interface OpenInAppUiState {
            data object Resolving : OpenInAppUiState

            data class Resolved(
                val title: String,
                val subtitle: String?,
                val targetRoute: String,
                val webUrl: String?,
            ) : OpenInAppUiState

            data class Failed(val webUrl: String?) : OpenInAppUiState
        }

        private val _state = MutableStateFlow<OpenInAppUiState>(OpenInAppUiState.Resolving)
        val state: StateFlow<OpenInAppUiState> = _state.asStateFlow()

        private var started = false

        private var lastRaw: String? = null

        /** Resolve the inbound link. [rawOverride] lets the host inject the captured link. */
        fun start(rawOverride: String? = null) {
            if (started) return
            started = true
            val raw = rawOverride ?: (DeepLinkRouter.pending.value as? DeepLinkRouter.Destination.Unknown)?.uri
            resolve(raw)
        }

        /** "Try the app again" — re-runs the link resolution from the failed state. */
        fun retry() {
            resolve(lastRaw ?: (DeepLinkRouter.pending.value as? DeepLinkRouter.Destination.Unknown)?.uri)
        }

        fun resolve(raw: String?) {
            lastRaw = raw
            val link = raw?.let(::parseBookingLink)
            if (link == null) {
                _state.value = OpenInAppUiState.Failed(webUrl = raw?.takeIf { it.startsWith("http") })
                return
            }
            viewModelScope.launch {
                _state.value = OpenInAppUiState.Resolving
                _state.value = resolvePreview(link)
            }
        }

        private suspend fun resolvePreview(link: BookingLink): OpenInAppUiState =
            when (link) {
                is BookingLink.Page -> {
                    when (val r = repo.publicGetPage(link.slug)) {
                        is NetworkResult.Success -> {
                            val et = r.data.eventTypes.firstOrNull()
                            OpenInAppUiState.Resolved(
                                title = r.data.page?.title ?: et?.name ?: "Book a time",
                                subtitle = et?.let { eventSubtitle(it.defaultDuration, r.data.page?.title) },
                                targetRoute = SchedulingRoutes.publicBooking(link.slug),
                                webUrl = link.webUrl,
                            )
                        }
                        is NetworkResult.Failure -> OpenInAppUiState.Failed(link.webUrl)
                    }
                }
                is BookingLink.OneOff -> {
                    when (val r = repo.publicGetOneOff(link.token)) {
                        is NetworkResult.Success ->
                            OpenInAppUiState.Resolved(
                                title = r.data.eventType?.name ?: "Book a time",
                                subtitle = r.data.eventType?.let { eventSubtitle(it.defaultDuration, null) },
                                targetRoute = SchedulingRoutes.publicBookingOneOff(link.token),
                                webUrl = link.webUrl,
                            )
                        is NetworkResult.Failure -> OpenInAppUiState.Failed(link.webUrl)
                    }
                }
                is BookingLink.Manage -> {
                    when (val r = repo.publicGetManageBooking(link.token)) {
                        is NetworkResult.Success ->
                            OpenInAppUiState.Resolved(
                                title = r.data.eventType?.name ?: "Your booking",
                                subtitle = r.data.page?.title?.let { "with $it" },
                                targetRoute = SchedulingRoutes.manageBooking(link.token),
                                webUrl = link.webUrl,
                            )
                        is NetworkResult.Failure -> OpenInAppUiState.Failed(link.webUrl)
                    }
                }
            }

        private fun eventSubtitle(
            durationMin: Int?,
            host: String?,
        ): String? {
            val parts = listOfNotNull(durationMin?.let { "$it min" }, host?.let { "with $it" })
            return parts.takeIf { it.isNotEmpty() }?.joinToString(" · ")
        }

        private sealed interface BookingLink {
            val webUrl: String?

            data class Page(val slug: String, override val webUrl: String?) : BookingLink

            data class OneOff(val token: String, override val webUrl: String?) : BookingLink

            data class Manage(val token: String, override val webUrl: String?) : BookingLink
        }

        private fun parseBookingLink(raw: String): BookingLink? {
            val withoutScheme = raw.substringAfter("://", raw)
            val path = withoutScheme.substringBefore('?').substringBefore('#')
            val segments = path.split('/').filter { it.isNotBlank() }
            val web = raw.takeIf { it.startsWith("http") }
            val bookIdx = segments.indexOf("book")
            val bookingIdx = segments.indexOf("booking")
            return when {
                bookIdx >= 0 && segments.getOrNull(bookIdx + 1) == "o" ->
                    segments.getOrNull(bookIdx + 2)?.let { BookingLink.OneOff(it, web) }
                bookIdx >= 0 ->
                    segments.getOrNull(bookIdx + 1)?.let { BookingLink.Page(it, web) }
                bookingIdx >= 0 ->
                    segments.getOrNull(bookingIdx + 1)?.let { BookingLink.Manage(it, web) }
                else -> null
            }
        }
    }
