package app.pantopus.android.ui.screens.plans.detail

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.plans.PlanInviteBody
import app.pantopus.android.data.api.models.plans.PlanInviteCandidateDto
import app.pantopus.android.data.api.models.plans.PlanInviteListDto
import app.pantopus.android.data.api.models.plans.PlanInviteRowDto
import app.pantopus.android.data.api.net.NetworkError
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.plans.PlansRepository
import app.pantopus.android.data.plans.planCode
import app.pantopus.android.data.plans.planMessage
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/** The invite sheet's load state. */
sealed interface PlanInviteLoad {
    data object Loading : PlanInviteLoad

    data object Loaded : PlanInviteLoad

    data class Failed(
        val message: String,
    ) : PlanInviteLoad
}

/** A text invite ready for the share sheet: the host's words, then the one-person link. */
data class PlanTextInvite(
    val message: String,
    val url: String,
)

/** The whole sheet. */
data class PlanInviteUi(
    val load: PlanInviteLoad = PlanInviteLoad.Loading,
    val query: String = "",
    val people: List<PlanInviteCandidateDto> = emptyList(),
    val list: PlanInviteListDto? = null,
    /** Chosen to invite, in the order chosen. */
    val chosenPeople: List<PlanInviteCandidateDto> = emptyList(),
    val chosenEmails: List<String> = emptyList(),
    val sending: Boolean = false,
    val makingLink: Boolean = false,
    val error: String? = null,
    val notice: String? = null,
    /** At a home, the first invitation asks the host to agree that people who say they're in see the address. */
    val asksAboutAddress: Boolean = false,
    val textInvite: PlanTextInvite? = null,
) {
    val searchText: String get() = query.trim()

    /** The search text when it's an address not chosen yet: "Invite alex@example.com by email". */
    val emailInQuery: String?
        get() = searchText.lowercase().takeIf { PlanInviteEmail.isValid(it) && it !in chosenEmails }

    val chosenCount: Int get() = chosenPeople.size + chosenEmails.size

    val emailsLeft: Int get() = maxOf(0, (list?.emailsLeft ?: EMAILS_PER_PLAN) - chosenEmails.size)

    fun isChosen(person: PlanInviteCandidateDto): Boolean = chosenPeople.any { it.userId == person.userId }

    companion object {
        const val EMAILS_PER_PLAN = 20
    }
}

/**
 * The host's "Invite friends" (founder decision, October 31): people they know on Pantopus (connections, people who
 * came to their plans), anyone by email, and a one-person link to text. The invitations already sent, with where each
 * stands, and taking one back. Everything is the server's (planInvites.js); the same screen as iOS's PlanInviteSheet.
 */
@HiltViewModel
class PlanInviteViewModel
    @Inject
    constructor(
        private val repository: PlansRepository,
    ) : ViewModel() {
        private val _ui = MutableStateFlow(PlanInviteUi())
        val ui: StateFlow<PlanInviteUi> = _ui.asStateFlow()

        private var planId = ""
        private var pending: Pending? = null
        private var addressAgreed = false
        private var searchJob: Job? = null

        /** What "Share your address?" is for. */
        private enum class Pending { Send, Link }

        /** The sheet opened for [id]: read the people and the invitations sent. */
        fun start(id: String) {
            if (planId != id) {
                planId = id
                addressAgreed = false
                _ui.value = PlanInviteUi()
            }
            load()
        }

        fun load() {
            viewModelScope.launch {
                val peopleRead = async { repository.invitePeople(planId, _ui.value.searchText) }
                val listRead = async { repository.invites(planId) }
                val people = peopleRead.await()
                val list = listRead.await()
                _ui.update {
                    when {
                        list is NetworkResult.Success ->
                            it.copy(
                                load = PlanInviteLoad.Loaded,
                                list = list.data,
                                people = (people as? NetworkResult.Success)?.data?.people ?: it.people,
                            )
                        it.list == null -> it.copy(load = PlanInviteLoad.Failed((list as NetworkResult.Failure).error.planMessage))
                        else -> it
                    }
                }
            }
        }

        /** The search box: a name narrows the people list after a short pause; an address offers "Invite by email". */
        fun editQuery(text: String) {
            _ui.update { it.copy(query = text, error = null) }
            searchJob?.cancel()
            if (_ui.value.emailInQuery != null) return
            searchJob =
                viewModelScope.launch {
                    delay(SEARCH_PAUSE_MS)
                    val typed = _ui.value.searchText
                    val found = repository.invitePeople(planId, typed)
                    if (found is NetworkResult.Success && typed == _ui.value.searchText) {
                        _ui.update { it.copy(people = found.data.people) }
                    }
                }
        }

        fun toggle(person: PlanInviteCandidateDto) {
            if (person.state != null) return
            _ui.update {
                val chosen =
                    if (it.isChosen(person)) {
                        it.chosenPeople.filterNot { p -> p.userId == person.userId }
                    } else {
                        it.chosenPeople + person
                    }
                it.copy(chosenPeople = chosen, error = null)
            }
        }

        fun addEmailFromQuery() {
            val email = _ui.value.emailInQuery ?: return
            if (_ui.value.emailsLeft <= 0) {
                _ui.update { it.copy(error = "You can invite 20 people by email to a plan.") }
                return
            }
            _ui.update { it.copy(chosenEmails = it.chosenEmails + email, query = "", error = null) }
        }

        fun removeEmail(email: String) {
            _ui.update { it.copy(chosenEmails = it.chosenEmails - email) }
        }

        fun removePerson(userId: String) {
            _ui.update { it.copy(chosenPeople = it.chosenPeople.filterNot { p -> p.userId == userId }) }
        }

        /** Sends the chosen invitations. At a home the first one asks about the address first. */
        fun send() {
            val ui = _ui.value
            if (ui.chosenCount == 0 || ui.sending) return
            _ui.update { it.copy(sending = true, error = null) }
            viewModelScope.launch {
                val body =
                    PlanInviteBody(
                        userIds = ui.chosenPeople.map { it.userId },
                        emails = ui.chosenEmails,
                        confirmSharesAddress = addressAgreed.takeIf { it },
                    )
                when (val result = repository.invite(planId, body)) {
                    is NetworkResult.Success -> {
                        val invited = result.data.results.count { it.outcome == "invited" }
                        val already = result.data.results.count { it.outcome == "already_invited" || it.outcome == "already_in" }
                        val notice =
                            when {
                                invited == 1 -> "Invited 1 person"
                                invited > 1 -> "Invited $invited people"
                                already > 0 -> "They're already invited"
                                else -> "No one new to invite"
                            }
                        _ui.update {
                            it.copy(
                                sending = false,
                                list = result.data,
                                chosenPeople = emptyList(),
                                chosenEmails = emptyList(),
                                query = "",
                                notice = notice,
                            )
                        }
                        reload()
                    }
                    is NetworkResult.Failure -> failed(result.error, Pending.Send)
                }
            }
        }

        /** "Text an invite": a one-person link and the words to send with it, for the share sheet. */
        fun makeTextInvite() {
            if (_ui.value.makingLink) return
            _ui.update { it.copy(makingLink = true, error = null) }
            viewModelScope.launch {
                when (val result = repository.inviteLink(planId, addressAgreed)) {
                    is NetworkResult.Success ->
                        _ui.update {
                            it.copy(makingLink = false, textInvite = PlanTextInvite(result.data.message, result.data.url))
                        }
                    is NetworkResult.Failure -> failed(result.error, Pending.Link)
                }
            }
        }

        /** The share sheet opened: the list shows the text invite. */
        fun textInviteShared() {
            _ui.update { it.copy(textInvite = null, notice = "Done. That link works for one person.") }
            reload()
        }

        /** "Share your address?" answered yes: do what was asked. */
        fun agreeToShareAddress() {
            addressAgreed = true
            val action = pending
            pending = null
            _ui.update { it.copy(asksAboutAddress = false) }
            when (action) {
                Pending.Send -> send()
                Pending.Link -> makeTextInvite()
                null -> Unit
            }
        }

        fun declineToShareAddress() {
            pending = null
            _ui.update { it.copy(asksAboutAddress = false) }
        }

        /** Takes back an invitation nobody has said yes to. */
        fun cancel(row: PlanInviteRowDto) {
            viewModelScope.launch {
                when (val result = repository.cancelInvite(planId, row.id)) {
                    is NetworkResult.Success -> {
                        _ui.update { it.copy(list = result.data, notice = "Invitation taken back") }
                        reload()
                    }
                    is NetworkResult.Failure -> _ui.update { it.copy(error = result.error.planMessage) }
                }
            }
        }

        fun noticeShown() {
            _ui.update { it.copy(notice = null) }
        }

        private fun failed(
            error: NetworkError,
            action: Pending,
        ) {
            if (error.planCode == "confirm_shares_address") {
                pending = action
                _ui.update { it.copy(sending = false, makingLink = false, asksAboutAddress = true) }
            } else {
                _ui.update { it.copy(sending = false, makingLink = false, error = error.planMessage) }
            }
        }

        private fun reload() {
            viewModelScope.launch {
                (repository.invites(planId) as? NetworkResult.Success)?.data?.let { list -> _ui.update { it.copy(list = list) } }
                (repository.invitePeople(planId, _ui.value.searchText) as? NetworkResult.Success)?.data?.let { found ->
                    _ui.update { it.copy(people = found.people) }
                }
            }
        }

        private companion object {
            const val SEARCH_PAUSE_MS = 250L
        }
    }

/** An address the host can invite by email (the server checks it again); the same rule as iOS. */
object PlanInviteEmail {
    private const val MAX_LOCAL = 64
    private const val MAX_LENGTH = 254
    private const val FORBIDDEN = "<>()[]\\,;:\""

    fun isValid(text: String): Boolean {
        val parts = text.split('@')
        if (parts.size != 2) return false
        val (local, domain) = parts
        val tld = domain.substringAfterLast('.', missingDelimiterValue = "")
        return local.isNotEmpty() &&
            local.length <= MAX_LOCAL &&
            text.length <= MAX_LENGTH &&
            domain.contains('.') &&
            !domain.startsWith('.') &&
            !domain.endsWith('.') &&
            tld.length >= 2 &&
            text.none { it.isWhitespace() || it in FORBIDDEN }
    }
}
