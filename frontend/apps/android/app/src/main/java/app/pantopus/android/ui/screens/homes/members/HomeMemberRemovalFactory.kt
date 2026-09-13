package app.pantopus.android.ui.screens.homes.members

import app.pantopus.android.data.api.services.HomeMemberRemovalApi
import app.pantopus.android.data.homes.APIHomeMemberRemovalTransport
import app.pantopus.android.data.homes.HomeCreationScope
import app.pantopus.android.data.homes.HomeMemberRemovalCodec
import app.pantopus.android.data.homes.PersistentPendingHomeMemberRemovalStore
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScope
import app.pantopus.android.ui.screens.homes.claim_review.HomeClaimSessionScopeFactory
import com.squareup.moshi.Moshi
import kotlinx.coroutines.CoroutineScope
import retrofit2.Retrofit
import javax.inject.Inject

class HomeMemberRemovalFactory
    @Inject
    constructor(
        private val store: PersistentPendingHomeMemberRemovalStore,
        private val retrofit: Retrofit,
        private val sessions: HomeClaimSessionScopeFactory,
        moshi: Moshi,
    ) {
        val codec = HomeMemberRemovalCodec(moshi)
        private val api = retrofit.create(HomeMemberRemovalApi::class.java)
        private val transport = APIHomeMemberRemovalTransport(api, codec)

        fun session(scope: CoroutineScope): HomeClaimSessionScope = sessions.create(scope)

        fun create(session: HomeClaimSessionScope) =
            HomeMemberRemovalCoordinator(
                HomeCreationScope(retrofit.baseUrl().toString(), session.actorId.orEmpty().lowercase()),
                store,
                codec,
                transport,
                session::requireCurrent,
            )
    }
