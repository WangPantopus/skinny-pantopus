@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.inbox.conversation

import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import app.pantopus.android.core.routing.DeepLinkRouter
import app.pantopus.android.data.ai.AIScreenContext
import app.pantopus.android.data.auth.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.StateFlow
import java.io.File
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
@Suppress("LongParameterList") // The route's arguments and the chat's ways out, as the nav layer decodes them.
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
    onOpenToday: () -> Unit = {},
    onOpenGig: (String) -> Unit = {},
    onOpenListing: (String) -> Unit = {},
    arrivalRoomId: String? = null,
    onOpenProfile: (String) -> Unit = {},
    onOpenPlan: (String) -> Unit = {},
    aiContext: AIScreenContext? = null,
    aiNudgeId: String? = null,
    aiConversationId: String? = null,
    aiOpening: String? = null,
    sharedFile: File? = null,
    /** The person chat's "Send a Christmas card": the card flow with them chosen (user id, name); null leaves it out. */
    onSendCard: ((userId: String, name: String) -> Unit)? = null,
    authViewModel: ChatConversationHostViewModel = hiltViewModel(),
) {
    val state by authViewModel.authState.collectAsStateWithLifecycle()
    val currentUserId = (state as? AuthRepository.State.SignedIn)?.user?.id.orEmpty()
    // A chat link opened as a person thread still completes for its room.
    val arrival =
        (mode as? ChatThreadMode.Room)?.let { DeepLinkRouter.Destination.Conversation(it.id) }
            ?: arrivalRoomId?.let { DeepLinkRouter.Destination.Conversation(it) }
    DisposableEffect(arrival) {
        onDispose { arrival?.let(DeepLinkRouter::completeArrival) }
    }
    ChatConversationScreen(
        args =
            ChatConversationRouteArgs(
                mode = mode,
                counterparty = counterparty,
                currentUserId = currentUserId,
                scrollToMessageId = scrollToMessageId,
                initialTopic = initialTopic,
                gigId = gigId,
                aiContext = aiContext,
                aiNudgeId = aiNudgeId,
                aiConversationId = aiConversationId,
                aiOpening = aiOpening,
                sharedFile = sharedFile,
            ),
        chrome = chrome,
        onBack = onBack,
        onUseAIDraft = onUseAIDraft,
        onOpenToday = onOpenToday,
        onOpenGig = onOpenGig,
        onOpenListing = onOpenListing,
        onContentLoaded = { arrival?.let(DeepLinkRouter::completeArrival) },
        onOpenProfile = onOpenProfile,
        onOpenPlan = onOpenPlan,
        onSendCard = onSendCard,
    )
}
