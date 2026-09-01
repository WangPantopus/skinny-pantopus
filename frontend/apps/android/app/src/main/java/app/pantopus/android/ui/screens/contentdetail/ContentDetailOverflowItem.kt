package app.pantopus.android.ui.screens.contentdetail

/**
 * One row in the top-bar overflow menu. Used by owner-mode listing
 * detail to surface "Edit listing" without crowding the dock.
 */
data class ContentDetailOverflowItem(
    val label: String,
    val testTag: String,
    val onClick: () -> Unit,
)
