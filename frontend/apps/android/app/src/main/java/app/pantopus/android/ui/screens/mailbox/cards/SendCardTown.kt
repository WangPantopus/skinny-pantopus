@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.mailbox.cards

import app.pantopus.android.data.api.models.mailbox.HolidayCardsResponse
import app.pantopus.android.data.api.net.NetworkError
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

/** What goes on once "Where does it start?" has a town (travelling card plan Part 2). */
enum class TownThen { Nothing, Look, Send, SendList }

/**
 * "Let it travel" and "Where does it start?" on the send flow (travelling card plan Part 2): the switch is offered
 * where `GET /cards` answers `travel`, on to begin with (D5); someone with no town is asked once (D4), when they turn it
 * on, look the card over or seal it, or when the server refuses for want of one (`CARD_TRAVEL_NEEDS_TOWN`).
 */
internal class SendCardTown(
    private val cards: StateFlow<HolidayCardsResponse?>,
    private val form: MutableStateFlow<SendCardForm>,
) {
    private val asked = MutableStateFlow<TownThen?>(null)

    /** "Where does it start?" is open, and what goes on once a town is chosen. */
    val askTown: StateFlow<TownThen?> = asked.asStateFlow()

    /** "Let it travel" is offered (the server's switch `card_travel`) and left on for this card. */
    fun travels(form: SendCardForm): Boolean = cards.value?.travel?.on == true && !form.travelOff

    /** The card would travel but its sender has no town yet. */
    private fun needsTown(form: SendCardForm): Boolean = travels(form) && cards.value?.travel?.town.isNullOrBlank()

    /** "Let it travel" turned on or off; on with no town yet asks for it. */
    fun set(on: Boolean) {
        form.update { it.copy(travelOff = !on, sealError = null) }
        if (on && needsTown(form.value)) asked.value = TownThen.Nothing
    }

    /** The town was kept: what was asked for, for the flow to go on with. */
    fun kept(): TownThen? {
        val then = asked.value
        asked.value = null
        return then
    }

    /** "Where does it start?" closed without a town: the card can't travel, so "Let it travel" goes off. */
    fun dismissed() {
        asked.value = null
        form.update { it.copy(travelOff = true) }
    }

    /** True, with the town asked for, when this card would travel from no town; [then] goes on once it's kept. */
    fun askFirst(
        form: SendCardForm,
        then: TownThen,
    ): Boolean {
        if (!needsTown(form)) return false
        asked.value = then
        return true
    }

    /** True, with the town asked for and the look or send ended, when the server refused the card for want of one. */
    fun refused(
        error: NetworkError?,
        then: TownThen,
    ): Boolean {
        if (error?.serverCode() != NEEDS_TOWN) return false
        form.update { it.copy(previewing = false, sending = false) }
        asked.value = then
        return true
    }

    private companion object {
        const val NEEDS_TOWN = "CARD_TRAVEL_NEEDS_TOWN"
    }
}
