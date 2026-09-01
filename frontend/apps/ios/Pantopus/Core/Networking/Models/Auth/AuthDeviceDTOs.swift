//
//  AuthDeviceDTOs.swift
//  Pantopus
//
//  DTOs for the trusted-device / session registry router mounted at
//  `/api/auth` (`backend/routes/authDevices.js`). Wire shapes are pinned by
//  docs/persistent-login/CONTRACT.md ("New router /api/auth"). All fields
//  are camelCase on the wire, so no `CodingKeys` remapping is needed.
//

import Foundation

// MARK: - Challenge

/// `POST /api/auth/challenge` `{ purpose }`.
public struct AuthChallengeRequest: Encodable, Sendable, Hashable {
    public let purpose: String

    public init(purpose: AuthChallengePurpose) {
        self.purpose = purpose.rawValue
    }
}

public enum AuthChallengePurpose: String, Sendable, Hashable {
    case stepUp = "step_up"
    case resume
    case attestation
}

/// `{ challengeId, challenge (base64url, 32 B), expiresAt }`.
public struct AuthChallengeResponse: Decodable, Sendable, Hashable {
    public let challengeId: String
    public let challenge: String
    public let expiresAt: LenientTimestamp?
}

// MARK: - Device registration

/// `POST /api/auth/devices/register` `{ device, pushToken?, pushProvider? }`.
public struct RegisterDeviceRequest: Encodable, Sendable, Hashable {
    public let device: DeviceDescriptor
    public let pushToken: String?
    public let pushProvider: String?

    public init(device: DeviceDescriptor, pushToken: String?, pushProvider: String? = "apns") {
        self.device = device
        self.pushToken = pushToken
        self.pushProvider = pushToken == nil ? nil : pushProvider
    }
}

/// `{ device: { id, deviceId, trustLevel, trustedAt }, resumeGrant? }` —
/// `resumeGrant` is Android-only and ignored on iOS.
public struct RegisterDeviceResponse: Decodable, Sendable, Hashable {
    public let device: RegisteredDevice?
    public let resumeGrant: String?

    public struct RegisteredDevice: Decodable, Sendable, Hashable {
        public let id: String?
        public let deviceId: String?
        public let trustLevel: String?
        public let trustedAt: LenientTimestamp?
    }
}

// MARK: - Devices list

/// `GET /api/auth/devices` → `{ devices, sessions, events }`.
public struct AuthDevicesResponse: Decodable, Sendable, Hashable {
    public let devices: [AuthDeviceDTO]
    public let sessions: [AuthSessionDTO]
    public let events: [AuthSecurityEventDTO]

    public init(devices: [AuthDeviceDTO], sessions: [AuthSessionDTO], events: [AuthSecurityEventDTO]) {
        self.devices = devices
        self.sessions = sessions
        self.events = events
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        devices = try container.decodeIfPresent([AuthDeviceDTO].self, forKey: .devices) ?? []
        sessions = try container.decodeIfPresent([AuthSessionDTO].self, forKey: .sessions) ?? []
        events = try container.decodeIfPresent([AuthSecurityEventDTO].self, forKey: .events) ?? []
    }

    private enum CodingKeys: String, CodingKey {
        case devices, sessions, events
    }
}

/// One row of the trusted-device registry (`AuthDevice`).
public struct AuthDeviceDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let deviceId: String?
    public let platform: String?
    public let name: String?
    public let model: String?
    public let osVersion: String?
    public let appVersion: String?
    public let isCurrent: Bool?
    public let trustLevel: String?
    public let trustedAt: LenientTimestamp?
    public let lastSeenAt: LenientTimestamp?
    public let lastIp: String?
    public let createdAt: LenientTimestamp?
}

/// One non-device (web) session row (`AuthSession` with `device_id NULL`).
public struct AuthSessionDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let platform: String?
    public let userAgent: String?
    public let isCurrent: Bool?
    public let lastSeenAt: LenientTimestamp?
    public let issuedAt: LenientTimestamp?
}

/// One `AuthSecurityEvent` row. `meta` is free-form JSON; decoded as a
/// string map of its scalar members (nested values are dropped).
public struct AuthSecurityEventDTO: Decodable, Sendable, Hashable, Identifiable {
    public let id: String
    public let type: String
    public let createdAt: LenientTimestamp?
    public let deviceId: String?
    public let meta: [String: String]?

    private enum CodingKeys: String, CodingKey {
        case id, type, createdAt, deviceId, meta
    }

    /// Memberwise init — previews, tests and the locally-synthesised
    /// timeline rows the Devices screen inserts before the next fetch.
    public init(id: String, type: String, createdAt: LenientTimestamp?, deviceId: String?, meta: [String: String]?) {
        self.id = id
        self.type = type
        self.createdAt = createdAt
        self.deviceId = deviceId
        self.meta = meta
    }

    public init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        // `bigserial` on the server — tolerate a number or a string.
        if let numeric = try? container.decode(Int.self, forKey: .id) {
            id = String(numeric)
        } else {
            id = try container.decode(String.self, forKey: .id)
        }
        type = try container.decodeIfPresent(String.self, forKey: .type) ?? "unknown"
        createdAt = try container.decodeIfPresent(LenientTimestamp.self, forKey: .createdAt)
        deviceId = try container.decodeIfPresent(String.self, forKey: .deviceId)
        meta = try container.decodeIfPresent(ScalarMap.self, forKey: .meta)?.values
    }

    /// Decodes a JSON object into `[String: String]`, stringifying scalars
    /// and skipping nested containers.
    private struct ScalarMap: Decodable {
        let values: [String: String]

        init(from decoder: any Decoder) throws {
            let container = try decoder.container(keyedBy: AnyKey.self)
            var result: [String: String] = [:]
            for key in container.allKeys {
                if let string = try? container.decode(String.self, forKey: key) {
                    result[key.stringValue] = string
                } else if let int = try? container.decode(Int.self, forKey: key) {
                    result[key.stringValue] = String(int)
                } else if let double = try? container.decode(Double.self, forKey: key) {
                    result[key.stringValue] = String(double)
                } else if let bool = try? container.decode(Bool.self, forKey: key) {
                    result[key.stringValue] = String(bool)
                }
            }
            values = result
        }

        struct AnyKey: CodingKey {
            var stringValue: String
            var intValue: Int? {
                nil
            }

            init?(stringValue: String) {
                self.stringValue = stringValue
            }

            init?(intValue _: Int) {
                nil
            }
        }
    }
}

// MARK: - Revocation

/// `POST /api/auth/sessions/revoke-others` → `{ revoked: n }`.
public struct RevokeOthersResponse: Decodable, Sendable, Hashable {
    public let revoked: Int?
}

/// `{ ok: true }` — `DELETE /api/auth/devices/:id`, `revoke-all`,
/// `step-up-key`.
public struct AuthOkResponse: Decodable, Sendable, Hashable {
    public let ok: Bool?
}

// MARK: - Step-up

/// Step-up purposes (CONTRACT): one-shot for the destructive three.
public enum StepUpPurpose: String, Sendable, Hashable, CaseIterable {
    case deleteAccount = "delete_account"
    case revokeDevice = "revoke_device"
    case revokeSessions = "revoke_sessions"
    case changeSecurityPrefs = "change_security_prefs"
    /// Wildcard, minted by `/api/users/reauthenticate`.
    case generic
}

public enum StepUpMethod: String, Sendable, Hashable {
    case password
    case deviceKey = "device_key"
}

/// `POST /api/auth/step-up` — either
/// `{ purpose, method:"password", password }` or
/// `{ purpose, method:"device_key", challengeId, signature }`.
public struct StepUpRequest: Encodable, Sendable, Hashable {
    public let purpose: String
    public let method: String
    public let password: String?
    public let challengeId: String?
    /// base64url raw `r || s` ES256 signature over the raw challenge bytes.
    public let signature: String?

    public static func password(_ password: String, purpose: StepUpPurpose) -> StepUpRequest {
        StepUpRequest(
            purpose: purpose.rawValue,
            method: StepUpMethod.password.rawValue,
            password: password,
            challengeId: nil,
            signature: nil
        )
    }

    public static func deviceKey(challengeId: String, signature: String, purpose: StepUpPurpose) -> StepUpRequest {
        StepUpRequest(
            purpose: purpose.rawValue,
            method: StepUpMethod.deviceKey.rawValue,
            password: nil,
            challengeId: challengeId,
            signature: signature
        )
    }
}

/// `{ stepUpToken, expiresAt, purpose }`.
public struct StepUpResponse: Decodable, Sendable, Hashable {
    public let stepUpToken: String
    public let expiresAt: LenientTimestamp?
    public let purpose: String?
}

/// `POST /api/auth/step-up-key` `{ publicKeyJwk, keyBacking }`.
public struct StepUpKeyRequest: Encodable, Sendable, Hashable {
    public let publicKeyJwk: JWK
    public let keyBacking: String

    public init(publicKeyJwk: JWK, keyBacking: String) {
        self.publicKeyJwk = publicKeyJwk
        self.keyBacking = keyBacking
    }
}

// MARK: - Security prefs / events

/// `GET|PATCH /api/auth/security-prefs` `{ allowRestoreGrants, newDeviceEmail }`.
public struct SecurityPrefs: Codable, Sendable, Hashable {
    public let allowRestoreGrants: Bool?
    public let newDeviceEmail: Bool?

    public init(allowRestoreGrants: Bool?, newDeviceEmail: Bool?) {
        self.allowRestoreGrants = allowRestoreGrants
        self.newDeviceEmail = newDeviceEmail
    }
}

/// `GET /api/auth/security-events?limit=50` → `{ events }`.
public struct SecurityEventsResponse: Decodable, Sendable, Hashable {
    public let events: [AuthSecurityEventDTO]
}
