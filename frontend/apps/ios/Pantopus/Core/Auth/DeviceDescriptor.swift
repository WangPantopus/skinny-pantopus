//
//  DeviceDescriptor.swift
//  Pantopus
//
//  The `device` object sent with `/login`, `/oauth/*`, `/api/auth/devices/register`
//  (docs/persistent-login/CONTRACT.md "Device descriptor"):
//
//    { deviceId, platform:"ios", installId, name, model, osVersion,
//      appVersion:"1.4.0 (312)", hasOsLock, keyBacking, attestation:null }
//
//  `attestation` is reserved for App Attest (Phase 3) and always `null` for
//  now — the server stores it verbatim and keeps `attestation_level='none'`.
//

import Foundation
import LocalAuthentication
import UIKit

public struct DeviceDescriptor: Encodable, Sendable, Hashable {
    public let deviceId: String
    public let platform: String
    public let installId: String
    public let name: String
    public let model: String
    public let osVersion: String
    public let appVersion: String
    public let hasOsLock: Bool
    public let keyBacking: String

    public init(
        deviceId: String,
        platform: String = "ios",
        installId: String,
        name: String,
        model: String,
        osVersion: String,
        appVersion: String,
        hasOsLock: Bool,
        keyBacking: String
    ) {
        self.deviceId = deviceId
        self.platform = platform
        self.installId = installId
        self.name = name
        self.model = model
        self.osVersion = osVersion
        self.appVersion = appVersion
        self.hasOsLock = hasOsLock
        self.keyBacking = keyBacking
    }

    private enum CodingKeys: String, CodingKey {
        case deviceId, platform, installId, name, model, osVersion, appVersion, hasOsLock, keyBacking, attestation
    }

    public func encode(to encoder: any Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        try container.encode(deviceId, forKey: .deviceId)
        try container.encode(platform, forKey: .platform)
        try container.encode(installId, forKey: .installId)
        try container.encode(name, forKey: .name)
        try container.encode(model, forKey: .model)
        try container.encode(osVersion, forKey: .osVersion)
        try container.encode(appVersion, forKey: .appVersion)
        try container.encode(hasOsLock, forKey: .hasOsLock)
        try container.encode(keyBacking, forKey: .keyBacking)
        // Reserved — explicit null so the server sees the key.
        try container.encodeNil(forKey: .attestation)
    }

    /// Snapshot of the running device. `name` is the user-assigned device
    /// name where iOS still exposes it (iOS 16+ returns the generic model
    /// name without the entitlement — acceptable: the server only shows
    /// it back to the user).
    @MainActor
    public static func current(deviceId: String, installId: String, keyBacking: DeviceKeyBacking) -> DeviceDescriptor {
        DeviceDescriptor(
            deviceId: deviceId,
            installId: installId,
            name: UIDevice.current.name,
            model: modelIdentifier,
            osVersion: UIDevice.current.systemVersion,
            appVersion: appVersion,
            hasOsLock: hasOsLock,
            keyBacking: keyBacking.rawValue
        )
    }

    /// `1.4.0 (312)` — marketing version + build number.
    public static var appVersion: String {
        let info = Bundle.main.infoDictionary
        let short = (info?["CFBundleShortVersionString"] as? String) ?? "0.0.0"
        let build = (info?["CFBundleVersion"] as? String) ?? "0"
        return "\(short) (\(build))"
    }

    /// Hardware identifier such as `iPhone16,2` (`x86_64` / `arm64` on the
    /// Simulator, where the model is in the environment instead).
    public static var modelIdentifier: String {
        if let simulator = ProcessInfo.processInfo.environment["SIMULATOR_MODEL_IDENTIFIER"], !simulator.isEmpty {
            return simulator
        }
        var systemInfo = utsname()
        uname(&systemInfo)
        let mirror = Mirror(reflecting: systemInfo.machine)
        let identifier = mirror.children.reduce(into: "") { result, element in
            guard let value = element.value as? Int8, value != 0 else { return }
            result.append(String(UnicodeScalar(UInt8(value))))
        }
        return identifier.isEmpty ? "unknown" : identifier
    }

    /// Whether the device has a passcode / biometric the OS can check
    /// (`LAContext.canEvaluatePolicy(.deviceOwnerAuthentication)`). No OS
    /// lock ⇒ the server grants no one-tap resume (design §2.2).
    public static var hasOsLock: Bool {
        LAContext().canEvaluatePolicy(.deviceOwnerAuthentication, error: nil)
    }
}
