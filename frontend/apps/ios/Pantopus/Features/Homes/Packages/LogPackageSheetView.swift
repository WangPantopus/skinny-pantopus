//
//  LogPackageSheetView.swift
//  Pantopus
//
//  T6.3d (P14) — Sheet-presented "Log a package" form. Posts to
//  `POST /api/homes/:id/packages` (route `backend/routes/home.js:4706`).
//
//  Intentionally a single-page form (not a multi-step Wizard) — the
//  carrier + tracking + description + drop fields are short enough to
//  fit one screen, and the design's empty-state CTA reads "Track
//  package" / "Log Package", not "Start wizard".
//

import Foundation
import Observation
import SwiftUI

@Observable
@MainActor
final class LogPackageViewModel {
    var carrier: String = ""
    var trackingNumber: String = ""
    var description: String = ""
    var deliveryInstructions: String = ""

    private(set) var isSubmitting: Bool = false
    private(set) var submitError: String?

    private let homeId: String
    private let api: APIClient
    private let onCreated: @Sendable (String) -> Void

    init(
        homeId: String,
        api: APIClient = .shared,
        onCreated: @escaping @Sendable (String) -> Void
    ) {
        self.homeId = homeId
        self.api = api
        self.onCreated = onCreated
    }

    /// The submit button is enabled whenever at least one of carrier,
    /// tracking number, or description is filled — a totally-blank
    /// package is never useful and the server would have nothing to
    /// surface in the list.
    var canSubmit: Bool {
        !carrier.trimmingCharacters(in: .whitespaces).isEmpty ||
            !trackingNumber.trimmingCharacters(in: .whitespaces).isEmpty ||
            !description.trimmingCharacters(in: .whitespaces).isEmpty
    }

    func submit() async {
        guard canSubmit, !isSubmitting else { return }
        isSubmitting = true
        submitError = nil
        defer { isSubmitting = false }

        let request = CreatePackageRequest(
            carrier: nonEmpty(carrier),
            trackingNumber: nonEmpty(trackingNumber),
            vendorName: nil,
            description: nonEmpty(description),
            deliveryInstructions: nonEmpty(deliveryInstructions),
            expectedAt: nil
        )
        do {
            let response: HomePackageResponse = try await api.request(
                HomesEndpoints.createPackage(homeId: homeId, request: request)
            )
            Analytics.track(.ctaLogPackageSubmit(result: .success))
            onCreated(response.package.id)
        } catch {
            Analytics.track(.ctaLogPackageSubmit(result: .error))
            submitError = (error as? APIError)?.errorDescription
                ?? "Couldn't log this package."
        }
    }

    private func nonEmpty(_ value: String) -> String? {
        let trimmed = value.trimmingCharacters(in: .whitespaces)
        return trimmed.isEmpty ? nil : trimmed
    }
}

struct LogPackageSheetView: View {
    @State private var viewModel: LogPackageViewModel
    @FocusState private var focused: Field?
    private let onClose: () -> Void

    private enum Field { case carrier, tracking, description, drop }

    init(
        homeId: String,
        onClose: @escaping () -> Void,
        onCreated: @escaping @Sendable (String) -> Void
    ) {
        _viewModel = State(initialValue: LogPackageViewModel(
            homeId: homeId,
            onCreated: onCreated
        ))
        self.onClose = onClose
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.s4) {
                Text("Track an incoming delivery so the household can see what's arriving and where to leave it.")
                    .pantopusTextStyle(.small)
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .padding(.top, Spacing.s2)

                field(
                    label: "Carrier",
                    placeholder: "Amazon · UPS · USPS · FedEx",
                    text: $viewModel.carrier,
                    focus: .carrier,
                    identifier: "logPackage_carrier"
                )

                field(
                    label: "Tracking number",
                    placeholder: "1Z9X4… or TBA303…",
                    text: $viewModel.trackingNumber,
                    focus: .tracking,
                    identifier: "logPackage_tracking"
                )

                field(
                    label: "What's inside",
                    placeholder: "Side table · Lego set · Dog food",
                    text: $viewModel.description,
                    focus: .description,
                    identifier: "logPackage_description"
                )

                field(
                    label: "Drop instructions",
                    placeholder: "Front porch · Side door · Mailbox",
                    text: $viewModel.deliveryInstructions,
                    focus: .drop,
                    identifier: "logPackage_drop"
                )

                if let saveError = viewModel.submitError {
                    Text(saveError)
                        .pantopusTextStyle(.small)
                        .foregroundStyle(Theme.Color.error)
                        .accessibilityIdentifier("logPackage_error")
                }

                PrimaryButton(
                    title: "Log package",
                    isLoading: viewModel.isSubmitting,
                    isEnabled: viewModel.canSubmit && !viewModel.isSubmitting
                ) {
                    await viewModel.submit()
                }
                .accessibilityIdentifier("logPackage_submit")
                .padding(.top, Spacing.s2)
            }
            .padding(.horizontal, Spacing.s4)
            .padding(.bottom, Spacing.s10)
        }
        .background(Theme.Color.appBg.ignoresSafeArea())
        .navigationTitle("Log a package")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarLeading) {
                Button("Cancel", action: onClose)
                    .accessibilityIdentifier("logPackage_cancel")
            }
        }
        .accessibilityIdentifier("logPackageSheet")
    }

    private func field(
        label: String,
        placeholder: String,
        text: Binding<String>,
        focus: Field,
        identifier: String
    ) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            Text(label)
                .pantopusTextStyle(.caption)
                .fontWeight(.semibold)
                .foregroundStyle(Theme.Color.appTextSecondary)
            TextField(placeholder, text: text)
                .focused($focused, equals: focus)
                .font(Theme.Font.body)
                .foregroundStyle(Theme.Color.appText)
                .textInputAutocapitalization(.sentences)
                .autocorrectionDisabled(false)
                .padding(Spacing.s3)
                .background(Theme.Color.appSurface)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md)
                        .stroke(Theme.Color.appBorderSubtle, lineWidth: 1)
                )
                .accessibilityIdentifier(identifier)
        }
    }
}

#Preview {
    LogPackageSheetView(homeId: "preview", onClose: {}, onCreated: { _ in })
}
