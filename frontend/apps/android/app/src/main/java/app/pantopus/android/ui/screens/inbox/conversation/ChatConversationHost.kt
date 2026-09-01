@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.inbox.conversation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.data.auth.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.StateFlow
import javax.inject.Inject

/**
 * Auth bridge: resolves the signed-in user id from [AuthRepository.state]
 * for the chat conversation host. Lives in its own VM so the testable
 * [ChatConversationViewModel] stays free of session concerns.
 */
@HiltViewModel
class ChatConversationHostViewModel
    @Inject
    constructor(
        authRepository: AuthRepository,
    ) : ViewModel() {
        val authState: StateFlow<AuthRepository.State> = authRepository.state
    }

/**
 * Resolves the current user id and renders [ChatConversationScreen]. The
 * nav layer (RootTabScreen) calls this with route-decoded args.
 */
@Composable
fun ChatConversationHost(
    mode: ChatThreadMode,
    counterparty: ChatCounterparty,
    onBack: () -> Unit,
    chrome: ChatConversationChrome = ChatConversationChrome(),
    scrollToMessageId: String? = null,
    initialTopic: ChatInitialTopic? = null,
    gigId: String? = null,
    onUseAIDraft: (ChatAIDraftCard) -> Unit = {},
    onOpenGig: (String) -> Unit = {},
    onOpenListing: (String) -> Unit = {},
    authViewModel: ChatConversationHostViewModel = hiltViewModel(),
) {
    val state by authViewModel.authState.collectAsStateWithLifecycle()
    val currentUserId = (state as? AuthRepository.State.SignedIn)?.user?.id.orEmpty()
    ChatConversationScreen(
        args =
            ChatConversationRouteArgs(
                mode = mode,
                counterparty = counterparty,
                currentUserId = currentUserId,
                scrollToMessageId = scrollToMessageId,
                initialTopic = initialTopic,
                gigId = gigId,
            ),
        chrome = chrome,
        onBack = onBack,
        onUseAIDraft = onUseAIDraft,
        onOpenGig = onOpenGig,
        onOpenListing = onOpenListing,
    )
}
