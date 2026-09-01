@file:Suppress("PackageNaming")

package app.pantopus.android.ui.screens.businesses.team

import app.pantopus.android.data.api.models.businesses.BusinessAccessDto
import app.pantopus.android.data.api.models.businesses.BusinessRolePresetDto
import app.pantopus.android.data.api.models.businesses.BusinessSeatDto
import app.pantopus.android.data.api.models.businesses.BusinessTeamMemberDto
import app.pantopus.android.data.api.models.businesses.BusinessTeamUserDto

/**
 * Preview + test fixtures for the Business Team screen, mirroring the
 * businessIam `/members`, businessSeats `/seats`, `/role-presets`, and
 * `/me` payload shapes. Parity with iOS `BusinessTeamSampleData`.
 */
object BusinessTeamSampleData {
    val access =
        BusinessAccessDto(
            hasAccess = true,
            isOwner = true,
            roleBase = "owner",
            permissions =
                listOf(
                    "team.view",
                    "team.invite",
                    "team.manage",
                    "profile.edit",
                    "catalog.manage",
                    "reviews.respond",
                    "insights.view",
                ),
        )

    val presets =
        listOf(
            BusinessRolePresetDto(
                "business_owner",
                "Owner",
                "Full control over the business",
                "owner",
                "crown",
                10,
            ),
            BusinessRolePresetDto(
                key = "business_admin",
                displayName = "Administrator",
                description = "Manages team, finances, and all business settings",
                roleBase = "admin",
                iconKey = "shield",
                sortOrder = 20,
            ),
            BusinessRolePresetDto(
                key = "content_editor",
                displayName = "Content Editor",
                description = "Edits profile, catalog, pages, and responds to reviews",
                roleBase = "editor",
                iconKey = "edit",
                sortOrder = 30,
            ),
            BusinessRolePresetDto(
                key = "operations_staff",
                displayName = "Staff",
                description = "Handles day-to-day operations, can view catalog and post gigs",
                roleBase = "staff",
                iconKey = "briefcase",
                sortOrder = 40,
            ),
            BusinessRolePresetDto(
                "read_only",
                "Viewer",
                "Read-only access to public business info",
                "viewer",
                "eye",
                50,
            ),
        )

    val members =
        listOf(
            BusinessTeamMemberDto(
                id = "team-1",
                roleBase = "owner",
                title = "Founder",
                joinedAt = "2024-01-04T09:00:00Z",
                user = BusinessTeamUserDto(id = "user-owner", username = "marlow", name = "Marlow Reyes", email = "marlow@marlowco.com"),
            ),
            BusinessTeamMemberDto(
                id = "team-2",
                roleBase = "admin",
                title = "Operations Lead",
                joinedAt = "2024-03-18T09:00:00Z",
                user = BusinessTeamUserDto(id = "user-admin", username = "dana", name = "Dana Okafor", email = "dana@marlowco.com"),
            ),
            BusinessTeamMemberDto(
                id = "team-3",
                roleBase = "editor",
                joinedAt = "2024-06-02T09:00:00Z",
                user = BusinessTeamUserDto(id = "user-editor", username = "sam", name = "Sam Whitfield", email = "sam@marlowco.com"),
            ),
        )

    val pendingSeats =
        listOf(
            BusinessSeatDto(
                id = "seat-pending-1",
                displayName = "Front Desk",
                roleBase = "viewer",
                inviteStatus = "pending",
                inviteEmail = "frontdesk@marlowco.com",
                createdAt = "2025-05-30T12:00:00Z",
                isYou = false,
            ),
        )
}
