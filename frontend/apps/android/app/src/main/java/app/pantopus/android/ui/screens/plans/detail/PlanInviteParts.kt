package app.pantopus.android.ui.screens.plans.detail

import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.testTag
import androidx.compose.ui.unit.dp
import app.pantopus.android.data.api.models.plans.PlanDto
import app.pantopus.android.data.api.models.plans.PlanMyInviteDto
import app.pantopus.android.data.plans.PlanViewerStanding
import app.pantopus.android.data.plans.isAtHome
import app.pantopus.android.data.plans.isPlaydate
import app.pantopus.android.data.plans.standing
import app.pantopus.android.ui.components.PrimaryButton
import app.pantopus.android.ui.screens.plans.components.PlanBanner
import app.pantopus.android.ui.screens.plans.components.PlanBannerTone
import app.pantopus.android.ui.screens.plans.components.PlanTextButton
import app.pantopus.android.ui.theme.PantopusIcon

/*
 * The person a host invited (founder decision, October 31): "Sam invited you" over the plan, and "I'm in" and "Can't
 * make it" in the footer. Saying "I'm in" is the ordinary ask, which the invitation lets in at once (planInvites.js).
 * The same words and test tags as iOS (PlanFooter.swift's PlanInviteCopy).
 */

/**
 * The viewer's invitation while it's still theirs to answer (not answered, or "Can't make it"), or null once they've
 * said yes (they're in, waiting, or on the waitlist) or for the host.
 */
internal val PlanDto.openInvite: PlanMyInviteDto?
    get() =
        myInvite?.takeIf {
            it.isOpen &&
                standing !in
                setOf(PlanViewerStanding.HOSTING, PlanViewerStanding.IN, PlanViewerStanding.REQUESTED, PlanViewerStanding.WAITLISTED)
        }

/** The words around an invitation. */
internal object PlanInviteCopy {
    /** Under "I'm in". */
    fun footer(
        plan: PlanDto,
        invite: PlanMyInviteDto,
    ): String {
        val host = plan.hostFirst
        return when {
            invite.status == "declined" -> "You said you can't make it. If that changes, tap I'm in."
            plan.isFull -> "Full for now. If a spot opens, we'll tell you right away."
            invite.needsHostOk -> "This invitation went to another address, so $host says yes first."
            else -> "$host invited you, so you're in as soon as you say so."
        }
    }

    /** The banner over the plan: "Sam invited you". */
    fun banner(
        plan: PlanDto,
        invite: PlanMyInviteDto,
    ): Pair<String, String> {
        val host = plan.hostFirst
        val place =
            when {
                plan.isPlaydate -> "the time and the exact place"
                plan.isAtHome -> "the address"
                else -> "the exact place"
            }
        val message =
            if (invite.needsHostOk) {
                "Say you're in and $host gets a request. You see $place once they say yes."
            } else {
                "No request needed. You see $place once you say you're in."
            }
        return "$host invited you" to message
    }
}

/** "Sam invited you" over a plan the viewer was invited to. */
@Composable
internal fun PlanInviteBanner(
    plan: PlanDto,
    invite: PlanMyInviteDto,
) {
    val (title, message) = PlanInviteCopy.banner(plan, invite)
    PlanBanner(
        title = title,
        subtitle = message,
        icon = PantopusIcon.PartyPopper,
        tone = PlanBannerTone.Ok,
        modifier = Modifier.testTag("planInviteBanner"),
    )
}

/** The footer for an invitation: "I'm in" (the waitlist when it's full) and "Can't make it". */
internal fun inviteFooterContent(
    plan: PlanDto,
    invite: PlanMyInviteDto,
    busy: Boolean,
    viewModel: PlanDetailViewModel,
): @Composable ColumnScope.() -> Unit =
    {
        PrimaryButton(
            title = if (plan.isFull) "Join the waitlist" else "I'm in",
            onClick = viewModel::openAsk,
            isEnabled = !busy,
            modifier = Modifier.height(50.dp).testTag("planInviteYes"),
        )
        if (invite.status == "pending") {
            PlanTextButton(
                title = "Can't make it",
                onClick = viewModel::declineInvite,
                enabled = !busy,
                modifier = Modifier.testTag("planInviteNo"),
            )
        }
        PlanFooterCaption(PlanInviteCopy.footer(plan, invite))
    }
