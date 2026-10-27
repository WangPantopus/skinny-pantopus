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
 * carry). A direct room with exactly one other person, who the viewer has
 * not blocked, opens that person's thread as the Messages list does, so its
 * details keep Report and Block. Anything else, or a failed read, returns
 * null and the link opens the room exactly as before. iOS mirrors this in
 * `InboxTabRoot.linkedConversation`. A business inbox link
 * (`/app/businesses/<id>/chat/<roomId>`) only needs the thread's header name
 * ([businessCounterpartName]). Fetches nothing until a link needs it.
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
            val avatarUrl: String? = null,
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
                    if (id != null && name != null) LinkedPerson(id, name, it.user?.avatarUrl) else null
                } ?: return null
            val blocked = (blocksRepository.blocked() as? NetworkResult.Success)?.data?.blocked ?: return null
            return person.takeUnless { linked -> blocked.any { it.userId == linked.userId } }
        }

        /**
         * The name a linked room goes by in the Messages list (a Support Train's, a group's), or null
         * for a direct or task room, or a failed read. A chat push's title names the sender, not the room.
         */
        suspend fun roomName(roomId: String): String? {
            val room = (chatRepository.room(roomId) as? NetworkResult.Success)?.data?.room ?: return null
            if (room.type == "direct" || room.type == "gig") return null
            return room.name?.takeIf(String::isNotBlank)
        }

        /**
         * The name a business inbox thread opened from a notice is headed with:
         * the room's member who isn't the business, as its inbox row names
         * them. Null when the room can't be read for the business. iOS mirrors
         * this in `HubTabRoot.businessThread`.
         */
        suspend fun businessCounterpartName(
            roomId: String,
            businessId: String,
        ): String? {
            val room = (chatRepository.room(roomId, asBusinessUserId = businessId) as? NetworkResult.Success)?.data?.room
            return room
                ?.participants
                .orEmpty()
                .firstOrNull { !it.userId.isNullOrBlank() && it.userId != businessId }
                ?.user
                ?.displayName
                ?.takeIf(String::isNotBlank)
        }
    }
