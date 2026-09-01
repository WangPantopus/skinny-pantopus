@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.settings.payments.components

import androidx.compose.ui.graphics.Color
import app.pantopus.android.ui.screens.settings.payments.PaymentMethodBrand
import app.pantopus.android.ui.screens.settings.payments.PaymentMethodChip
import app.pantopus.android.ui.screens.settings.payments.PaymentsRowTrailing
import app.pantopus.android.ui.theme.PantopusColors

data class PaymentMethodRowModel(
    val rowIdentifier: String,
    val label: String,
    val trailing: PaymentsRowTrailing,
    val brand: PaymentMethodBrand? = null,
    val subtext: String? = null,
    val chip: PaymentMethodChip? = null,
    val labelColor: Color = PantopusColors.appText,
    val rowTestTag: String? = null,
    /**
     * testTag applied to the status chip (e.g. the "Default" badge on a
     * saved method). `null` leaves the chip untagged.
     */
    val chipTestTag: String? = null,
)
