//
//  VerificationCenterViewModel.swift
//  Pantopus
//
//  P8 / T6.2c — Settings → Verification sub-route. Read-only status
//  grid for the four verification anchors: Email · Phone · Home
//  address · Photo ID. Renders today's `user.verified` flag via the
//  Identity Center endpoint and offers a Resend CTA for unverified
//  email (`POST /api/users/resend-verification`).
//
//  Per Q7's decision the screen is intentionally lean: read-only +
//  one CTA. The phone / home / ID flows aren't wired yet — the rows
//  show "Coming soon" subtext rather than placeholders so the user
//  can see the lay of the land.
//

import Foundation
import Observation

@Observable
@MainActor
public final class VerificationCenterViewModel: GroupedListDataSource {
    public var title: String {
        "Verification"
    }

    public var footerCaption: String? {
        "Verified neighbors can find you in search and reach you with confidence."
    }

    public private(set) var state: GroupedListState = .loading

    private let api: APIClient
    private let auth: AuthManager
    private var emailVerified: Bool = false
    private var emailAddress: String?
    private var isSendingVerification: Bool = false
    private var lastResendStatus: ResendStatus = .idle

    enum ResendStatus: Equatable {
        case idle
        case sending
        case sent
        case failed(message: String)
    }

    init(api: APIClient = .shared, auth: AuthManager = .shared) {
        self.api = api
        self.auth = auth
    }

    public func load() async {
        state = .loading
        if case let .signedIn(user) = auth.state {
            emailAddress = user.email
        }
        do {
            let response: IdentityCenterResponse = try await api.request(IdentityCenterEndpoints.overview)
            emailVerified = response.privateAccount?.verified ?? false
            rebuild()
        } catch {
            // Without identity-center, fall back to false. The user can
            // still trigger Resend.
            emailVerified = false
            rebuild()
        }
    }

    public func tapRow(_ rowId: String) async {
        switch rowId {
        case "email.resend":
            await resendVerification()
        default:
            break
        }
    }

    public func toggleRow(_: String, isOn _: Bool) async {}
    public func selectRadio(_: String) async {}
    public func setSlider(_: String, index _: Int) async {}

    private func resendVerification() async {
        guard let email = emailAddress, !email.isEmpty, !isSendingVerification else { return }
        isSendingVerification = true
        lastResendStatus = .sending
        rebuild()
        defer {
            isSendingVerification = false
            rebuild()
        }
        do {
            _ = try await api.request(AuthMethodsEndpoints.resendVerification(.init(email: email)))
            lastResendStatus = .sent
        } catch {
            lastResendStatus = .failed(message: "Couldn't send the verification email.")
        }
    }

    private func rebuild() {
        let emailControl: RowControl
        let emailSubtext: String?
        if emailVerified {
            emailControl = .chipStatus(label: "Verified", tone: .success, includesChevron: false)
            emailSubtext = emailAddress
        } else {
            emailControl = .chipStatus(label: "Unverified", tone: .warning, includesChevron: false)
            emailSubtext = emailAddress
        }
        let emailRow = GroupedListRow(
            id: "email.status",
            label: "Email",
            subtext: emailSubtext,
            control: emailControl
        )
        let resendLabel = switch lastResendStatus {
        case .idle: "Resend verification email"
        case .sending: "Sending…"
        case .sent: "Sent — check your inbox"
        case .failed: "Try again"
        }
        let emailGroup: GroupedListGroup
        if emailVerified {
            emailGroup = GroupedListGroup(id: "email", overline: "Email", rows: [emailRow])
        } else {
            let resendRow = GroupedListRow(
                id: "email.resend",
                label: resendLabel,
                subtext: {
                    if case let .failed(message) = lastResendStatus { return message }
                    return nil
                }(),
                control: .chevron
            )
            emailGroup = GroupedListGroup(
                id: "email",
                overline: "Email",
                helper: "Verify your email to unlock posting and trust signals.",
                rows: [emailRow, resendRow]
            )
        }

        let idGroup = GroupedListGroup(
            id: "photoid",
            overline: "Photo ID",
            rows: [
                GroupedListRow(
                    id: "photoid.status",
                    label: "Government-issued ID",
                    subtext: "Used by business listings only",
                    control: .chipStatus(label: "Optional", tone: .neutral, includesChevron: false)
                )
            ]
        )
        state = .loaded([emailGroup, idGroup])
    }
}
