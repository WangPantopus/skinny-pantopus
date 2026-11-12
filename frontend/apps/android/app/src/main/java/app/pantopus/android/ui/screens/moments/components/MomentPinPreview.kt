@file:Suppress("MagicNumber")

package app.pantopus.android.ui.screens.moments.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import app.pantopus.android.data.api.models.moments.MomentAuthorDto
import app.pantopus.android.data.api.models.moments.MomentRingPreviewDto
import coil.compose.AsyncImagePainter
import coil.compose.rememberAsyncImagePainter
import coil.size.Size

/*
 * A pin on the Moments map shows a small look at the person's newest Moment inside its ring (founder, 2026-11-11:
 * "Yes, add previews"), as on iPhone (`MomentPinPreview.swift`): the photo's or video's thumbnail, or a text card's
 * colours, with the person's face as a small badge at the lower left so they stay recognisable. With no preview (an
 * older server, a ring with no location, a picture that didn't load) the pin is the face pin it always was: never a
 * blank, never a spinner. The ring keeps its meaning, and crowded spots and the row of faces keep faces.
 *
 * Seeing a preview is not watching the Moment: no view is recorded for it. The pictures are tiny and held in memory
 * only, never in the image cache on disk ([MomentImages]), under a key made from the Moment's id, so a fresh link on
 * the next map read reuses what's loaded.
 */

/** What fills a pin's ring, in the pin's own 64 dp box: the [preview] with the face as a badge, or the face. */
@Composable
internal fun MomentPinInside(
    author: MomentAuthorDto,
    preview: MomentRingPreviewDto?,
) {
    val shown = preview?.takeIf { it.canShow }
    val inside = Modifier.offset(x = 7.dp, y = 7.dp).size(INSIDE)
    when {
        shown == null -> MomentFace(author = author, size = INSIDE, modifier = Modifier.offset(x = 7.dp, y = 7.dp), initialsSize = 18.sp)
        shown.isText -> {
            Box(
                modifier = inside.clip(CircleShape).momentCardGradient(MomentCardBackground.fromWire(shown.background)),
                contentAlignment = Alignment.Center,
            ) {
                // "Aa" for the words on the card.
                Text(
                    text = "Aa",
                    color = Color.White.copy(alpha = 0.92f),
                    fontSize = 17.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.clearAndSetSemantics { },
                )
            }
            FaceBadge(author)
        }
        else -> {
            // Loaded at its own (tiny) size: a picture that waits to be drawn before it loads would never load here,
            // because it isn't drawn until it has.
            val context = LocalContext.current
            val key = MomentImages.thumbKey(shown.momentId.orEmpty())
            val request =
                remember(shown.thumbUrl, key) {
                    MomentImages.request(context, shown.thumbUrl.orEmpty(), key).newBuilder().size(Size.ORIGINAL).build()
                }
            val painter = rememberAsyncImagePainter(model = request, contentScale = ContentScale.Crop)
            val loaded = painter.state is AsyncImagePainter.State.Success
            // Until the picture is in (and if it never comes), the face as before.
            if (!loaded) MomentFace(author = author, size = INSIDE, modifier = Modifier.offset(x = 7.dp, y = 7.dp), initialsSize = 18.sp)
            Image(
                painter = painter,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                alpha = if (loaded) 1f else 0f,
                modifier = inside.clip(CircleShape),
            )
            if (loaded) FaceBadge(author)
        }
    }
}

/** The person, small, at the lower left of the ring (the verified check keeps the lower right). */
@Composable
private fun FaceBadge(author: MomentAuthorDto) {
    Box(
        modifier =
            Modifier
                .offset(x = 1.dp, y = 37.dp)
                .clip(CircleShape)
                .background(Color.White)
                .padding(2.dp),
    ) {
        MomentFace(author = author, size = 22.dp, initialsSize = 9.sp)
    }
}

private val INSIDE = 50.dp
