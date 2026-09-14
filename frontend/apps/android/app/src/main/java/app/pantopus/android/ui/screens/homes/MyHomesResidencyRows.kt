package app.pantopus.android.ui.screens.homes

import app.pantopus.android.data.api.models.homes.PersonalHomeResidencyRequest
import app.pantopus.android.ui.screens.shared.list_of_rows.CompactButtonVariant
import app.pantopus.android.ui.screens.shared.list_of_rows.RowFooter
import app.pantopus.android.ui.screens.shared.list_of_rows.RowFooterAction
import app.pantopus.android.ui.screens.shared.list_of_rows.RowLeading
import app.pantopus.android.ui.screens.shared.list_of_rows.RowModel
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTemplate
import app.pantopus.android.ui.screens.shared.list_of_rows.RowTrailing
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusIcon

internal fun personalResidencyRow(
    request: PersonalHomeResidencyRequest,
    open: () -> Unit,
): RowModel =
    RowModel(
        id = "residency-request_${request.id}", title = request.label, subtitle = request.reviewLabel,
        template = RowTemplate.AvatarKebab,
        leading = RowLeading.TypeIcon(PantopusIcon.Home, PantopusColors.homeBg, PantopusColors.home),
        trailing = if (request.homeId == null) RowTrailing.None else RowTrailing.Chevron, onTap = open,
        body =
            if (request.homeId == null) {
                "This saved request is no longer linked to a Home."
            } else {
                "Your submitted request. Check current status before continuing."
            },
        footer =
            request.homeId?.let {
                RowFooter(
                    listOf(
                        RowFooterAction(
                            title = "Check residency status",
                            icon = PantopusIcon.ArrowRight,
                            variant = CompactButtonVariant.Primary,
                            testTag = "myResidency.request_${request.id}.continue",
                            onClick = open,
                        ),
                    ),
                )
            },
    )

internal fun homeResidencyRecoveryRow(
    id: String,
    message: String,
    title: String,
    action: () -> Unit,
): RowModel =
    RowModel(
        id = id,
        title = message,
        template = RowTemplate.AvatarKebab,
        footer =
            RowFooter(
                listOf(
                    RowFooterAction(
                        title = title,
                        icon = PantopusIcon.ArrowRight,
                        variant = CompactButtonVariant.Primary,
                        testTag = "myHomes.$id",
                        onClick = action,
                    ),
                ),
            ),
    )
