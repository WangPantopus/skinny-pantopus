package app.pantopus.android.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.ui.theme.PantopusColors
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

/**
 * Instant Screens contract §3: a read failed and the copy on screen is older than its kind's max shown age.
 * [shownAt] is when that copy arrived (wall clock).
 */
data class RefreshNotice(
    val shownAt: Long,
    val onRetry: () -> Unit,
)

/** The one quiet line for a [RefreshNotice]: "Couldn't refresh. Showing 3:42 PM." with Retry. The content stays. */
@Composable
fun RefreshFailedLine(
    notice: RefreshNotice,
    modifier: Modifier = Modifier,
) {
    val shownTime = remember(notice.shownAt) { TIME.withZone(ZoneId.systemDefault()).format(Instant.ofEpochMilli(notice.shownAt)) }
    Row(
        modifier = modifier.fillMaxWidth().testTag("refreshFailedLine"),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            "Couldn't refresh. Showing $shownTime.",
            fontSize = 13.sp,
            color = PantopusColors.appTextSecondary,
            modifier = Modifier.weight(1f),
        )
        Text(
            "Retry",
            fontSize = 13.sp,
            fontWeight = FontWeight.SemiBold,
            color = PantopusColors.primary600,
            modifier =
                Modifier
                    .clip(RoundedCornerShape(8.dp))
                    .clickable(role = Role.Button, onClick = notice.onRetry)
                    .padding(horizontal = 10.dp, vertical = 12.dp),
        )
    }
}

private val TIME: DateTimeFormatter = DateTimeFormatter.ofPattern("h:mm a", Locale.US)
