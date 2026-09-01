//
//  BusinessTeamSampleData.swift
//  Pantopus
//
//  Preview + test fixtures for the Business Team screen. The view-model
//  keeps these as the seam used by SwiftUI previews and unit tests; the
//  live `load()` path replaces them with real fetches.
//

import Foundation

/// Static fixtures mirroring the businessIam `/members`, businessSeats
/// `/seats`, `/role-presets`, and `/me` payload shapes.
public enum BusinessTeamSampleData {
    public static let access = BusinessTeamAccessDTO(
        hasAccess: true,
        isOwner: true,
        roleBase: "owner",
        permissions: [
            "team.view", "team.invite", "team.manage",
            "profile.edit", "catalog.manage", "pages.publish",
            "reviews.respond", "gigs.manage", "finance.manage", "insights.view"
        ]
    )

    public static let presets: [BusinessRolePresetDTO] = [
        BusinessRolePresetDTO(
            key: "business_owner",
            displayName: "Owner",
            description: "Full control over the business",
            roleBase: "owner",
            iconKey: "crown",
            sortOrder: 10
        ),
        BusinessRolePresetDTO(
            key: "business_admin",
            displayName: "Administrator",
            description: "Manages team, finances, and all business settings",
            roleBase: "admin",
            iconKey: "shield",
            sortOrder: 20
        ),
        BusinessRolePresetDTO(
            key: "content_editor",
            displayName: "Content Editor",
            description: "Edits profile, catalog, pages, and responds to reviews",
            roleBase: "editor",
            iconKey: "edit",
            sortOrder: 30
        ),
        BusinessRolePresetDTO(
            key: "operations_staff",
            displayName: "Staff",
            description: "Handles day-to-day operations, can view catalog and post gigs",
            roleBase: "staff",
            iconKey: "briefcase",
            sortOrder: 40
        ),
        BusinessRolePresetDTO(
            key: "read_only",
            displayName: "Viewer",
            description: "Read-only access to public business info",
            roleBase: "viewer",
            iconKey: "eye",
            sortOrder: 50
        )
    ]

    public static let members: [BusinessTeamMemberDTO] = [
        BusinessTeamMemberDTO(
            id: "team-1",
            roleBase: "owner",
            title: "Founder",
            joinedAt: "2024-01-04T09:00:00Z",
            user: BusinessTeamUserDTO(
                id: "user-owner",
                username: "marlow",
                name: "Marlow Reyes",
                email: "marlow@marlowco.com",
                profilePictureUrl: nil
            )
        ),
        BusinessTeamMemberDTO(
            id: "team-2",
            roleBase: "admin",
            title: "Operations Lead",
            joinedAt: "2024-03-18T09:00:00Z",
            user: BusinessTeamUserDTO(
                id: "user-admin",
                username: "dana",
                name: "Dana Okafor",
                email: "dana@marlowco.com",
                profilePictureUrl: nil
            )
        ),
        BusinessTeamMemberDTO(
            id: "team-3",
            roleBase: "editor",
            title: "Content",
            joinedAt: "2024-06-02T09:00:00Z",
            user: BusinessTeamUserDTO(
                id: "user-editor",
                username: "sam",
                name: "Sam Whitfield",
                email: "sam@marlowco.com",
                profilePictureUrl: nil
            )
        ),
        BusinessTeamMemberDTO(
            id: "team-4",
            roleBase: "staff",
            title: nil,
            joinedAt: "2024-09-21T09:00:00Z",
            user: BusinessTeamUserDTO(
                id: "user-staff",
                username: "rio",
                name: "Rio Tanaka",
                email: "rio@marlowco.com",
                profilePictureUrl: nil
            )
        )
    ]

    public static let pendingSeats: [BusinessSeatDTO] = [
        BusinessSeatDTO(
            id: "seat-pending-1",
            displayName: "Front Desk",
            roleBase: "viewer",
            inviteStatus: "pending",
            inviteEmail: "frontdesk@marlowco.com",
            createdAt: "2025-05-30T12:00:00Z",
            isYou: false
        )
    ]
}
