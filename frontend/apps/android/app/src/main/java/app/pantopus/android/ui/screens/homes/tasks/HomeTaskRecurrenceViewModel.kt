package app.pantopus.android.ui.screens.homes.tasks

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import app.pantopus.android.data.homes.HomeTaskRecurrenceScope
import app.pantopus.android.data.homes.HomeTasksRepository
import app.pantopus.android.data.homes.PersistentPendingHomeTaskRecurrenceStore
import dagger.hilt.android.lifecycle.HiltViewModel
import retrofit2.Retrofit
import javax.inject.Inject

@HiltViewModel
class HomeTaskRecurrenceViewModel
    @Inject
    constructor(
        tasks: HomeTaskAccessFactory,
        repository: HomeTasksRepository,
        store: PersistentPendingHomeTaskRecurrenceStore,
        retrofit: Retrofit,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        private val home = checkNotNull(savedStateHandle.get<String>(ADD_HOUSEHOLD_TASK_HOME_ID_KEY))
        private val task = checkNotNull(savedStateHandle.get<String>(ADD_HOUSEHOLD_TASK_TASK_ID_KEY))
        private val access = tasks.create(home, viewModelScope)
        val controller =
            HomeTaskRecurrenceController(
                HomeTaskRecurrenceAccess(
                    HomeTaskRecurrenceScope(retrofit.baseUrl().toString(), access.actorId ?: "", home, task),
                    access,
                    repository,
                ),
                store,
                viewModelScope,
            )

        override fun onCleared() {
            controller.retire()
            super.onCleared()
        }
    }
