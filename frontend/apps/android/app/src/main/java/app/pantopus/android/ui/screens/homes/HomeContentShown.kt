package app.pantopus.android.ui.screens.homes

import app.pantopus.android.ui.screens.shared.list_of_rows.ListOfRowsUiState

/** Debug content timing (ISPerf, `ReportContentShown`): a list shows content once its rows or empty state are on screen. */
internal fun ListOfRowsUiState.showsContent(): Boolean = this is ListOfRowsUiState.Loaded || this is ListOfRowsUiState.Empty
