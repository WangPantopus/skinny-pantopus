@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.inbox.conversation

import androidx.lifecycle.ViewModel
import app.pantopus.android.data.api.net.NetworkResult
import app.pantopus.android.data.auth.AuthRepository
import app.pantopus.android.data.blocks.BlocksRepository
import app.pantopus.android.data.chats.ChatRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

/**
 * On-demand resolution for chat links (`/chat/<roomId>`, what chat pushes
 * carry), sibling of `DeepLinkPlaceResolverViewModel`. A direct room with
 * exactly one other person, who the viewer has not blocked, opens that
 * person's thread as the Messages list does, so its details keep Report and
 * Block. Anything else, or a failed read, returns null and the link opens
 * the room exactly as before. iOS mirrors this in
 * `InboxTabRoot.linkedConversation`. Fetches nothing until a link needs it.
 */
@HiltViewModel
class DeepLinkChatResolverViewModel
    @Inject
    constructor(
        private val chatRepository: ChatRepository,
        private val blocksRepository: BlocksRepository,
        private val authRepository: AuthRepository,
    ) : ViewModel() {
        /** The other person of a linked direct room. */
        data class LinkedPerson(
            val userId: String,
            val displayName: String,
        )

        suspend fun directCounterpart(roomId: String): LinkedPerson? {
            val viewerId = (authRepository.state.value as? AuthRepository.State.SignedIn)?.user?.id
            // The route answers participants only; anyone else gets its denial.
            val room = viewerId?.let { (chatRepository.room(roomId) as? NetworkResult.Success)?.data?.room }
            val other =
                room
                    ?.takeIf { it.type == "direct" }
                    ?.participants
                    .orEmpty()
                    .filter { it.userId != viewerId }
                    .singleOrNull()
            val person =
                other?.let {
                    val id = it.userId?.takeIf(String::isNotBlank)
                    val name = it.user?.displayName?.takeIf(String::isNotBlank)
                    if (id != null && name != null) LinkedPerson(id, name) else null
                } ?: return null
            val blocked = (blocksRepository.blocked() as? NetworkResult.Success)?.data?.blocked ?: return null
            return person.takeUnless { linked -> blocked.any { it.userId == linked.userId } }
        }
    }
