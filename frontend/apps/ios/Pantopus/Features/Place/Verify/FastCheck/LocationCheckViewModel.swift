//
//  LocationCheckViewModel.swift
//  Pantopus
//
//  "At home now" (FASTVERIFY phase 5, drawing L1): one precise reading, a
//  one-time challenge from the server and the App Attest proof, then the
//  server's answer. A first match verifies the person; a match on a later day
//  confirms it. Nothing about where the phone was is kept here.
//

import Foundation
import Observation

@Observable
@MainActor
final class LocationCheckViewModel {
    enum Stage: Equatable {
        case ready
        case checking
        case verified
        /// A miss or a refusal, in the SPEC's words, with the ways on.
        case missed(String)
    }

    let homeId: String
    let address: String
    private let api: APIClient
    private let reader: FastCheckLocationReader

    private(set) var stage: Stage = .ready
    /// Location is off for Pantopus: the way to Settings is offered.
    private(set) var locationDenied = false

    init(homeId: String, address: String, api: APIClient = .shared, reader: FastCheckLocationReader? = nil) {
        self.homeId = homeId
        self.address = address
        self.api = api
        self.reader = reader ?? FastCheckLocationReader()
    }

    func check() async {
        guard stage != .checking else { return }
        stage = .checking
        locationDenied = false
        switch await reader.read() {
        case .denied:
            locationDenied = true
            stage = .missed("Location is off for Pantopus. Turn it on in Settings, or verify another way.")
        case .unavailable:
            stage = .missed(Self.tooRough)
        case let .reading(reading):
            await send(reading)
        }
    }

    private func send(_ reading: FastCheckReading) async {
        do {
            let challenge: LocationChallengeResponse = try await api.request(HomeFastVerifyEndpoints.locationChallenge(homeId: homeId))
            let readingJSON = Self.readingJSON(reading)
            let proof = await AppAttestProof.make(challenge: challenge.challenge, reading: readingJSON)
            let response: LocationCheckResponse = try await api.request(HomeFastVerifyEndpoints.location(
                homeId: homeId,
                request: LocationCheckRequest(
                    challenge: challenge.challenge,
                    latitude: reading.latitude,
                    longitude: reading.longitude,
                    accuracyM: reading.accuracyMeters,
                    mocked: reading.mocked,
                    platform: "ios",
                    proof: proof
                )
            ))
            switch response.result {
            case "verified", "confirmed":
                HomeVerifyOptionsStore.shared.forget(homeId: homeId)
                stage = .verified
            case "too_rough":
                stage = .missed(Self.tooRough)
            case "no_match":
                stage = .missed(
                    "We couldn't place your \(DeviceWords.plainName) at \(address). "
                        + "Step inside and try again, or verify another way."
                )
            default:
                // Not counted: the reading couldn't be tied to a real copy of the app on a real phone.
                stage = .missed("This check couldn't be counted on this \(DeviceWords.plainName). Verify another way.")
            }
        } catch {
            stage = .missed(PhoneCheckViewModel.message(for: error))
        }
    }

    func tryAgain() {
        stage = .ready
    }

    static var tooRough: String {
        "Your \(DeviceWords.plainName)'s location was too rough to tell. Try again near a window, or verify another way."
    }

    /// The reading as JSON text, which the proof signs with the challenge: the same values the body sends.
    static func readingJSON(_ reading: FastCheckReading) -> String {
        struct Reading: Encodable {
            let latitude: Double
            let longitude: Double
            let accuracyM: Double
            let mocked: Bool
            let platform: String

            enum CodingKeys: String, CodingKey {
                case latitude, longitude, mocked, platform
                case accuracyM = "accuracy_m"
            }
        }
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys]
        let data = (try? encoder.encode(Reading(
            latitude: reading.latitude,
            longitude: reading.longitude,
            accuracyM: reading.accuracyMeters,
            mocked: reading.mocked,
            platform: "ios"
        ))) ?? Data()
        return String(bytes: data, encoding: .utf8) ?? ""
    }
}
