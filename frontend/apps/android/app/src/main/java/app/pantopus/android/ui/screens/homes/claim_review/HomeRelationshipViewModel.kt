@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.homes.claim_review

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.models.homes.HomeRelationshipAction
import app.pantopus.android.data.homes.HomeRelationshipScope
import app.pantopus.android.data.homes.HomeRelationshipService
import app.pantopus.android.data.homes.PersistentPendingHomeRelationshipStore
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject

@HiltViewModel
class HomeRelationshipViewModel
    @Inject
    constructor(
        savedStateHandle: SavedStateHandle,
        private val service: HomeRelationshipService,
        private val store: PersistentPendingHomeRelationshipStore,
        scopes: HomeClaimSessionScopeFactory,
    ) : ViewModel() {
        private val homeId: String = savedStateHandle[HOME_CLAIM_REVIEW_HOME_ID_KEY] ?: ""
        private val session = scopes.create(viewModelScope)
        private val mutable = MutableStateFlow<HomeRelationshipController?>(null)
        val panel = mutable.asStateFlow()

        fun open(
            claimId: String? = null,
            action: HomeRelationshipAction = HomeRelationshipAction.Decline,
        ) {
            dismiss()
            val identity = HomeRelationshipScope(service.origin, session.actorId ?: "", homeId)
            val controller =
                HomeRelationshipController(HomeRelationshipAccess(identity, session, service.api), store, viewModelScope, claimId, action)
            mutable.value = controller
            controller.show()
        }

        fun dismiss() {
            mutable.value?.dispose()
            mutable.value = null
        }

        override fun onCleared() {
            dismiss()
            super.onCleared()
        }
    }
