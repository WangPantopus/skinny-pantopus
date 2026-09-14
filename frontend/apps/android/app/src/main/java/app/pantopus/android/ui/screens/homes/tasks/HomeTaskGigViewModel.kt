package app.pantopus.android.ui.screens.homes.tasks

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.api.services.GeoApi
import app.pantopus.android.data.api.services.HomeTaskGigApi
import app.pantopus.android.data.homes.HomeTaskGigScope
import app.pantopus.android.data.homes.PersistentPendingHomeTaskGigStore
import dagger.hilt.android.lifecycle.HiltViewModel
import retrofit2.Retrofit
import javax.inject.Inject

@HiltViewModel
class HomeTaskGigViewModel
    @Inject
    constructor(
        tasks: HomeTaskAccessFactory,
        store: PersistentPendingHomeTaskGigStore,
        retrofit: Retrofit,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val home = checkNotNull(savedStateHandle.get<String>(ADD_HOUSEHOLD_TASK_HOME_ID_KEY))
        private val task = checkNotNull(savedStateHandle.get<String>(ADD_HOUSEHOLD_TASK_TASK_ID_KEY))
        private val access = tasks.create(home, viewModelScope)
        val controller =
            HomeTaskGigController(
                HomeTaskGigAccess(
                    HomeTaskGigScope(retrofit.baseUrl().toString(), access.actorId ?: "", home, task),
                    access,
                    retrofit.create(HomeTaskGigApi::class.java),
                ),
                store,
                retrofit.create(GeoApi::class.java),
                viewModelScope,
            )

        override fun onCleared() {
            controller.retire()
            super.onCleared()
        }
    }
