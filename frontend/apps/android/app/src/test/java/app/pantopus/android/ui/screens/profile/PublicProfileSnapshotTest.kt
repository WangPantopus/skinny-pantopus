@file:Suppress("MagicNumber", "PackageNaming", "LongMethod")

package app.pantopus.android.ui.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import app.cash.paparazzi.DeviceConfig
import app.cash.paparazzi.Paparazzi
import app.pantopus.android.data.api.models.profile.PublicProfileDto
import app.pantopus.android.ui.components.IdentityPillar
import app.pantopus.android.ui.screens.shared.content_detail.bodies.ProfileStatCell
import app.pantopus.android.ui.screens.shared.content_detail.bodies.ProfileTab
import app.pantopus.android.ui.screens.shared.content_detail.bodies.StatsTabsContent
import app.pantopus.android.ui.screens.shared.content_detail.headers.IdentityPillarBadge
import app.pantopus.android.ui.screens.shared.content_detail.headers.IdentityPillarVerificationState
import app.pantopus.android.ui.theme.PantopusColors
import app.pantopus.android.ui.theme.PantopusTheme
import org.junit.Rule
import org.junit.Test

/**
 * P6.5 — Paparazzi snapshots for the Public Profile screen split into
 * Persona (creator) vs Local (verified neighbor) chrome. Locks every
 * render state across both kinds:
 *
 *  - loading / error chrome (kind-agnostic)
 *  - Persona populated (sky banner, "Persona · Verified" gold chip,
 *    Follow header CTA, tier visibility chips, locked-broadcast
 *    paywall overlay)
 *  - Persona empty-broadcasts
 *  - Local populated (green banner, "Verified neighbor" shield chip,
 *    Message + Connect sticky CTAs, Pulse-style intent chips)
 *  - Local connect-requested (Connect CTA flipped to "Requested")
 *  - Local empty-posts
 */
class PublicProfileSnapshotTest {
    @get:Rule
    val paparazzi =
        Paparazzi(
            deviceConfig =
                DeviceConfig.PIXEL_5.copy(
                    screenHeight = 2400,
                    softButtons = false,
                ),
        )

    // MARK: - Chrome-agnostic states

    @Test
    fun public_profile_loading() {
        paparazzi.snapshot {
            Frame { LoadingLayout(onBack = {}) }
        }
    }

    @Test
    fun public_profile_error() {
        paparazzi.snapshot {
            Frame { ErrorLayout(message = "Check your connection and try again.", onRetry = {}, onBack = {}) }
        }
    }

    // MARK: - Persona

    @Test
    fun public_profile_persona_populated() {
        paparazzi.snapshot {
            Frame {
                PublicProfileLoadedFrame(
                    content = personaPopulated(),
                    selectedTab = ProfileTab.About,
                    connectState = PublicProfileActionState.Idle,
                    onBack = {},
                    onSelectTab = {},
                    onFollow = {},
                    onMessage = {},
                    onConnect = {},
                    onOverflow = {},
                    onUnlock = {},
                )
            }
        }
    }

    @Test
    fun public_profile_persona_empty_broadcasts() {
        paparazzi.snapshot {
            Frame {
                PublicProfileLoadedFrame(
                    content = personaPopulated().copy(posts = emptyList()),
                    selectedTab = ProfileTab.About,
                    connectState = PublicProfileActionState.Idle,
                    onBack = {},
                    onSelectTab = {},
                    onFollow = {},
                    onMessage = {},
                    onConnect = {},
                    onOverflow = {},
                    onUnlock = {},
                )
            }
        }
    }

    // MARK: - Local

    @Test
    fun public_profile_local_populated() {
        paparazzi.snapshot {
            Frame {
                PublicProfileLoadedFrame(
                    content = localPopulated(),
                    selectedTab = ProfileTab.About,
                    connectState = PublicProfileActionState.Idle,
                    onBack = {},
                    onSelectTab = {},
                    onFollow = {},
                    onMessage = {},
                    onConnect = {},
                    onOverflow = {},
                    onUnlock = {},
                    // The Connect control only renders for a signed-in
                    // viewer on someone else's profile.
                    follow = ProfileFollowState(canFollow = true),
                )
            }
        }
    }

    @Test
    fun public_profile_local_connect_requested() {
        paparazzi.snapshot {
            Frame {
                PublicProfileLoadedFrame(
                    content = localPopulated(),
                    selectedTab = ProfileTab.About,
                    connectState = PublicProfileActionState.Succeeded,
                    onBack = {},
                    onSelectTab = {},
                    onFollow = {},
                    onMessage = {},
                    onConnect = {},
                    onOverflow = {},
                    onUnlock = {},
                    follow = ProfileFollowState(canFollow = true),
                    // An outstanding request: "Requested", clock glyph, inert.
                    connection = ProfileConnection.PendingSent,
                )
            }
        }
    }

    @Test
    fun public_profile_local_empty_posts() {
        paparazzi.snapshot {
            Frame {
                PublicProfileLoadedFrame(
                    content = localPopulated().copy(posts = emptyList()),
                    selectedTab = ProfileTab.About,
                    connectState = PublicProfileActionState.Idle,
                    onBack = {},
                    onSelectTab = {},
                    onFollow = {},
                    onMessage = {},
                    onConnect = {},
                    onOverflow = {},
                    onUnlock = {},
                    follow = ProfileFollowState(canFollow = true),
                )
            }
        }
    }

    // MARK: - Fixture builders

    private fun fixtureDto(
        id: String = "u1",
        username: String = "mariak",
        name: String = "Maria K.",
        residency: Map<String, Any?>? = null,
    ): PublicProfileDto =
        PublicProfileDto(
            id = id,
            username = username,
            name = name,
            verified = true,
            residency = residency,
            reviews = emptyList(),
            skills = emptyList(),
        )

    private fun personaPopulated(): PublicProfileContent =
        PublicProfileContent(
            profile = fixtureDto(),
            kind = PublicProfileKind.Persona,
            header =
                PublicProfileHeader(
                    displayName = "Maria K.",
                    handle = "mariak",
                    locality = "Elm Park",
                    avatarUrl = null,
                    isVerified = true,
                    identityBadges =
                        listOf(
                            IdentityPillarBadge(IdentityPillar.Personal, IdentityPillarVerificationState.Verified),
                            IdentityPillarBadge(IdentityPillar.Home, IdentityPillarVerificationState.Unverified),
                            IdentityPillarBadge(IdentityPillar.Business, IdentityPillarVerificationState.Unverified),
                        ),
                    tierLabel = "Persona · Verified",
                    isVerifiedNeighbor = false,
                ),
            stats =
                StatsTabsContent(
                    stats =
                        listOf(
                            ProfileStatCell("beacons", "1.2K", "Beacons"),
                            ProfileStatCell("broadcasts", "47", "Broadcasts"),
                            ProfileStatCell("member", "Aug 24", "Member"),
                        ),
                    bio = "Sourdough scientist, Tuesday markets, late-night neighborhood walks.",
                    skills = listOf("Sourdough", "Coffee", "Walking"),
                    reviews = emptyList(),
                ),
            posts =
                listOf(
                    PublicProfilePost(
                        id = "b1",
                        body = "Today's loaf has a crumb you could read poetry through.",
                        timeAgo = "2h ago",
                        reactions = 34,
                        replies = 8,
                        visibility = PublicProfilePost.Visibility.Free,
                    ),
                    PublicProfilePost(
                        id = "b2",
                        body = "Full recipe + timing chart — six months of refining.",
                        timeAgo = "Yesterday",
                        reactions = 22,
                        replies = 3,
                        visibility = PublicProfilePost.Visibility.Bronze,
                        isLocked = true,
                    ),
                    PublicProfilePost(
                        id = "b3",
                        body = "Tuesday market field notes — that new cheese stall is the real deal.",
                        timeAgo = "3d ago",
                        reactions = 51,
                        replies = 14,
                        visibility = PublicProfilePost.Visibility.Free,
                    ),
                ),
        )

    private fun localPopulated(): PublicProfileContent =
        PublicProfileContent(
            profile = fixtureDto(residency = mapOf("verified" to true)),
            kind = PublicProfileKind.Local,
            header =
                PublicProfileHeader(
                    displayName = "Maria K.",
                    handle = "mariak",
                    locality = "Elm Park",
                    avatarUrl = null,
                    isVerified = true,
                    identityBadges =
                        listOf(
                            IdentityPillarBadge(IdentityPillar.Personal, IdentityPillarVerificationState.Verified),
                            IdentityPillarBadge(IdentityPillar.Home, IdentityPillarVerificationState.Verified),
                            IdentityPillarBadge(IdentityPillar.Business, IdentityPillarVerificationState.Unverified),
                        ),
                    tierLabel = null,
                    isVerifiedNeighbor = true,
                ),
            stats =
                StatsTabsContent(
                    stats =
                        listOf(
                            ProfileStatCell("connections", "128", "Connections"),
                            ProfileStatCell("posts", "23", "Posts"),
                            ProfileStatCell("rating", "4.9", "Rating"),
                        ),
                    bio = "Apt 3B at 412 Elm. Around most evenings.",
                    skills = emptyList(),
                    reviews = emptyList(),
                ),
            posts =
                listOf(
                    PublicProfilePost(
                        id = "p1",
                        body = "Anyone want sourdough? Made too much again.",
                        timeAgo = "1h ago",
                        locality = "Elm Park",
                        reactions = 14,
                        replies = 6,
                        intent = PublicProfilePost.Intent.Offer,
                    ),
                    PublicProfilePost(
                        id = "p2",
                        body = "Building elevator is down again. Maintenance says Wed.",
                        timeAgo = "Yesterday",
                        locality = "412 Elm St",
                        reactions = 22,
                        replies = 9,
                        intent = PublicProfilePost.Intent.Alert,
                    ),
                    PublicProfilePost(
                        id = "p3",
                        body = "Thursday block supper at the Papadakis stoop.",
                        timeAgo = "2d ago",
                        locality = "Elm Park",
                        reactions = 38,
                        replies = 17,
                        intent = PublicProfilePost.Intent.Event,
                    ),
                ),
        )

    @Composable
    private fun Frame(content: @Composable () -> Unit) {
        PantopusTheme {
            Box(
                modifier =
                    Modifier
                        .fillMaxSize()
                        .background(PantopusColors.appBg),
            ) { content() }
        }
    }
}
