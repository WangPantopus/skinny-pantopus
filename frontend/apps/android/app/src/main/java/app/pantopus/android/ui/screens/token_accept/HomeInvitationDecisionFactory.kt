@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.token_accept

import app.pantopus.android.data.api.services.HomeInvitationDecisionApi
import app.pantopus.android.data.api.services.HomeResidencyProgressApi
import app.pantopus.android.data.homes.APIHomeInvitationDecisionTransport
import app.pantopus.android.data.homes.HomeCreationScope
import app.pantopus.android.data.homes.HomeInvitationDecisionCodec
import app.pantopus.android.data.homes.PersistentPendingHomeInvitationDecisionStore
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScope
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScopeFactory
import com.squareup.moshi.Moshi
import kotlinx.coroutines.CoroutineScope
import retrofit2.Retrofit
import javax.inject.Inject

class HomeInvitationDecisionFactory
    @Inject
    constructor(
        private val store: PersistentPendingHomeInvitationDecisionStore,
        private val retrofit: Retrofit,
        private val sessions: HomeClaimSessionScopeFactory,
        moshi: Moshi,
    ) {
        val codec = HomeInvitationDecisionCodec(moshi)
        private val transport =
            APIHomeInvitationDecisionTransport(
                retrofit.create(HomeInvitationDecisionApi::class.java),
                retrofit.create(HomeResidencyProgressApi::class.java),
                codec,
            )

        private fun scope(session: HomeClaimSessionScope) =
            HomeCreationScope(
                retrofit.baseUrl().toString(),
                session.actorId.orEmpty().lowercase(),
            )

        fun session(scope: CoroutineScope): HomeClaimSessionScope = sessions.create(scope)

        suspend fun hasOriginal(session: HomeClaimSessionScope): Boolean = store.read(scope(session)) != null

        suspend fun preview(token: String) = transport.preview(token)

        fun create(
            session: HomeClaimSessionScope,
            token: String,
        ) = HomeInvitationDecisionCoordinator(scope(session), token, store, codec, transport, session::requireCurrent)
    }
