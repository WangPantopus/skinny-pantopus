package app.pantopus.android.ui.screens.homes.tasks

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

/** Composed with task detail so the opening account is captured before its first read. */
@HiltViewModel
class HomeTaskMediaViewModel
    @Inject
    constructor(
        factory: HomeTaskMediaAccessFactory,
        savedStateHandle: SavedStateHandle,
    ) : ViewModel() {
        val controller =
            HomeTaskMediaController(
                factory.create(
                    checkNotNull(savedStateHandle[ADD_HOUSEHOLD_TASK_HOME_ID_KEY]),
                    checkNotNull(savedStateHandle[ADD_HOUSEHOLD_TASK_TASK_ID_KEY]),
                    viewModelScope,
                ),
                viewModelScope,
            )

        override fun onCleared() {
            controller.retire()
            super.onCleared()
        }
    }
