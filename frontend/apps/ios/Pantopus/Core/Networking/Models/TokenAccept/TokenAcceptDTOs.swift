//
//  TokenAcceptDTOs.swift
//  Pantopus
//
//  Decoder shapes for the three invite-resolution routes used by the
//  T3.5 Token / Accept screen.
//

import Foundation

// MARK: - Home invite (GET /api/homes/invitations/token/:token)

public struct HomeInviteResponse: Decodable, Sendable {
    public let invitation: HomeInviteDetailsDTO?
    public let home: HomeInviteHomeDTO?
    public let inviter: HomeInviteInviterDTO?
    public let expired: Bool?
    public let alreadyUsed: Bool?
}

public struct HomeInviteDetailsDTO: Decodable, Sendable, Hashable {
    public let id: String
    public let status: String?
    public let proposedRole: String?
    public let inviteeEmail: String?
    public let inviteeUserId: String?
    public let expiresAt: String?
    public let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case id, status
        case proposedRole = "proposed_role"
        case inviteeEmail = "invitee_email"
        case inviteeUserId = "invitee_user_id"
        case expiresAt = "expires_at"
        case createdAt = "created_at"
    }
}

public struct HomeInviteHomeDTO: Decodable, Sendable, Hashable {
    public let id: String
    public let name: String?
    public let city: String?
    public let homeType: String?

    enum CodingKeys: String, CodingKey {
        case id, name, city
        case homeType = "home_type"
    }
}

public struct HomeInviteInviterDTO: Decodable, Sendable, Hashable {
    public let name: String?
    public let username: String?
    public let profilePicture: String?
}

// MARK: - Business seat (GET /api/businesses/seats/invite-details)

public struct BusinessSeatInviteResponse: Decodable, Sendable {
    public let seatId: String?
    public let business: BusinessSeatBusinessDTO?
    public let displayName: String?
    public let roleBase: String?
    public let inviteEmail: String?
    public let createdAt: String?

    enum CodingKeys: String, CodingKey {
        case seatId = "seat_id"
        case business
        case displayName = "display_name"
        case roleBase = "role_base"
        case inviteEmail = "invite_email"
        case createdAt = "created_at"
    }
}

public struct BusinessSeatBusinessDTO: Decodable, Sendable, Hashable {
    public let id: String?
    public let username: String?
    public let name: String?
}

// MARK: - Guest pass (GET /api/homes/guest/:token)

public struct TokenAcceptGuestPassResponse: Decodable, Sendable {
    public let pass: TokenAcceptGuestPassDTO?
}

public struct TokenAcceptGuestPassDTO: Decodable, Sendable, Hashable {
    public let label: String?
    public let kind: String?
    public let customTitle: String?
    public let expiresAt: String?
    public let homeName: String?
    public let welcomeMessage: String?

    enum CodingKeys: String, CodingKey {
        case label, kind
        case customTitle = "custom_title"
        case expiresAt = "expires_at"
        case homeName = "home_name"
        case welcomeMessage = "welcome_message"
    }
}

// MARK: - Accept envelopes

public struct HomeAcceptResponse: Decodable, Sendable {
    public let homeId: String?
    public let occupancy: HomeOccupancyEcho?
    public let merged: Bool?
    public let acceptedRoleBase: String?

    enum CodingKeys: String, CodingKey {
        case homeId
        case occupancy, merged
        case acceptedRoleBase = "accepted_role_base"
    }
}

public struct HomeOccupancyEcho: Decodable, Sendable, Hashable {
    public let id: String?
    public let role: String?
}

public struct BusinessSeatAcceptResponse: Decodable, Sendable {
    public let message: String?
    public let seatId: String?
    public let businessUserId: String?
    public let roleBase: String?

    enum CodingKeys: String, CodingKey {
        case message
        case seatId = "seat_id"
        case businessUserId = "business_user_id"
        case roleBase = "role_base"
    }
}
