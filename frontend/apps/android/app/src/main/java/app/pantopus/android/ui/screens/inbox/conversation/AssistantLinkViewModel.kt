@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.inbox.conversation

import androidx.lifecycle.ViewModel
import app.pantopus.android.data.ai.AIScreenContext
import app.pantopus.android.data.homes.HomesRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

/**
 * What a `pantopus://assistant` link's `surface` key opens the thread about (AI assistant phase 3 contract §8.4): the
 * Plans tab, or Today with the default home, as Ask Pantopus on those screens does.
 */
@HiltViewModel
class AssistantLinkViewModel
    @Inject
    constructor(
        private val homes: HomesRepository,
    ) : ViewModel() {
        /** Null for no surface, or one a link can't name. */
        fun context(surface: String?): AIScreenContext? =
            when (surface) {
                "plans" -> AIScreenContext.plans()
                "today" -> AIScreenContext.today(homes.myHomesCopy()?.defaultHomeId)
                else -> null
            }
    }
