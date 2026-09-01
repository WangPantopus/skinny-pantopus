//
//  FanInboxView.swift
//  Pantopus
//
//  A15.5 "Fan thread". When the fan already has a thread with this
//  persona the thread surface takes over the screen; otherwise this is
//  the "Start a conversation" frame — quota gate strip above a composer
//  whose placeholder states the cost ("uses 1 of 5").
//

import SwiftUI

public struct FanInboxView: View {
    @State private var viewModel: FanInboxViewModel
    private let personaId: String
    private let onBack: @MainActor () -> Void
    private let onChangeTier: @MainActor () -> Void

    public init(
        personaId: String,
        onBack: @escaping @MainActor () -> Void = {},
        onChangeTier: @escaping @MainActor () -> Void = {}
    ) {
        self.personaId = personaId
        _viewModel = State(initialValue: FanInboxViewModel(personaId: personaId))
        self.onBack = onBack
        self.onChangeTier = onChangeTier
    }

    public var body: some View {
        Group {
            switch viewModel.state {
            case let .thread(threadId):
                PersonaDmThreadView(personaId: personaId, threadId: threadId, onBack: onBack)
            case .loading, .start, .error:
                chrome
            }
        }
        .task { await viewModel.load() }
        .accessibilityIdentifier("fanInbox")
    }

    private var chrome: some View {
        VStack(spacing: Spacing.s0) {
            topBar
            content
        }
        .background(Theme.Color.appBg)
        .offlineBanner(isOffline: !NetworkMonitor.shared.isOnline)
        .toolbar(.hidden, for: .tabBar)
    }

    // MARK: - Top bar

    private var topBar: some View {
        HStack(spacing: Spacing.s0) {
            Button(action: onBack) {
                Icon(.chevronLeft, size: 22, color: Theme.Color.appText)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back")
            .accessibilityIdentifier("fanInboxBackButton")
            Spacer()
            Text("Messages")
                .font(.system(size: 16, weight: .semibold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Spacer()
            Color.clear.frame(width: 44, height: 44)
        }
        .padding(.horizontal, Spacing.s2)
        .frame(height: 52)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .bottom) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
    }

    // MARK: - State switch

    @ViewBuilder private var content: some View {
        switch viewModel.state {
        case .loading:
            loadingFrame
        case let .start(start):
            startFrame(start)
        case let .error(message):
            errorFrame(message: message)
        case .thread:
            EmptyView()
        }
    }

    private var loadingFrame: some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Shimmer(height: 28, cornerRadius: Radii.pill)
            Shimmer(height: 120, cornerRadius: Radii.lg)
            Shimmer(height: 44, cornerRadius: Radii.lg)
            Spacer()
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
        .accessibilityIdentifier("fanInboxLoading")
    }

    private func errorFrame(message: String) -> some View {
        VStack(spacing: Spacing.s3) {
            Spacer()
            Icon(.alertCircle, size: 40, color: Theme.Color.error)
            Text("Couldn't load your messages")
                .font(.system(size: 18, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Text(message)
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .multilineTextAlignment(.center)
            Button {
                Task { await viewModel.refresh() }
            } label: {
                Text("Try again")
                    .font(.system(size: 14, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
                    .padding(.horizontal, Spacing.s5)
                    .frame(height: 44)
                    .background(Theme.Color.primary600)
                    .clipShape(Capsule())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("fanInboxRetry")
            Spacer()
        }
        .padding(Spacing.s5)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .accessibilityIdentifier("fanInboxError")
    }

    // MARK: - Start a conversation

    private func startFrame(_ start: FanInboxStartContent) -> some View {
        VStack(spacing: Spacing.s0) {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.s4) {
                    personaHeader(start)
                    if let gate = start.gate {
                        gateCard(gate)
                    } else {
                        startCard(start)
                    }
                }
                .padding(.horizontal, Spacing.s4)
                .padding(.top, Spacing.s4)
                .padding(.bottom, Spacing.s5)
            }
            .refreshable { await viewModel.refresh() }
            quotaGate(start)
        }
        .accessibilityIdentifier("fanInboxStart")
    }

    private func personaHeader(_ start: FanInboxStartContent) -> some View {
        HStack(spacing: Spacing.s3) {
            Circle()
                .fill(Theme.Color.businessBg)
                .frame(width: 44, height: 44)
                .overlay {
                    Text(start.initials)
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Theme.Color.business)
                }
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(start.personaName)
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                Text(start.personaTitle)
                    .pantopusTextStyle(.caption)
                    .foregroundStyle(Theme.Color.appTextSecondary)
            }
            Spacer(minLength: Spacing.s0)
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("fanInboxPersonaHeader")
    }

    private func startCard(_: FanInboxStartContent) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            Text("Start a conversation")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(Theme.Color.appText)
                .accessibilityAddTraits(.isHeader)
            Text(
                "Opening a thread uses one of your monthly message-thread "
                    + "credits. The creator decides if and when they reply."
            )
            .pantopusTextStyle(.caption)
            .foregroundStyle(Theme.Color.appTextSecondary)
            .fixedSize(horizontal: false, vertical: true)

            TextField("Say hi…", text: $viewModel.draft, axis: .vertical)
                .font(Theme.Font.small)
                .foregroundStyle(Theme.Color.appText)
                .lineLimit(4...8)
                .padding(Spacing.s3)
                .background(Theme.Color.appBg)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                .accessibilityIdentifier("fanInboxDraft")

            if let confirmation = viewModel.lastOpenConfirmation {
                Text(confirmation)
                    .font(.system(size: 11.5, weight: .medium))
                    .foregroundStyle(Theme.Color.success)
                    .accessibilityIdentifier("fanInboxConfirmation")
            }

            Button {
                Task { await viewModel.openThread() }
            } label: {
                HStack(spacing: Spacing.s2) {
                    if viewModel.isOpening {
                        ProgressView().tint(Theme.Color.appTextInverse)
                    } else {
                        Icon(.send, size: 15, color: Theme.Color.appTextInverse)
                    }
                    Text("Send")
                        .font(.system(size: 14, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .padding(.horizontal, Spacing.s5)
                .frame(height: 44)
                .background(viewModel.canOpen ? Theme.Color.primary600 : Theme.Color.primary200)
                .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(!viewModel.canOpen)
            .accessibilityIdentifier("fanInboxSend")
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("fanInboxStartCard")
    }

    /// The four first-class rejection states. Copy comes from `FanInboxGate`
    /// so iOS and Android read identically.
    private func gateCard(_ gate: FanInboxGate) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s3) {
            HStack(spacing: Spacing.s2) {
                Icon(
                    gate == .quotaExhausted ? .hourglass : .lock,
                    size: 16,
                    color: Theme.Color.warning
                )
                Text(gate.headline)
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
            }
            Text(gate.body)
                .pantopusTextStyle(.caption)
                .foregroundStyle(Theme.Color.appTextStrong)
                .fixedSize(horizontal: false, vertical: true)
            if let ctaTitle = gate.ctaTitle {
                Button(action: onChangeTier) {
                    Text(ctaTitle)
                        .font(.system(size: 13, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                        .padding(.horizontal, Spacing.s4)
                        .frame(height: 40)
                        .background(Theme.Color.primary600)
                        .clipShape(RoundedRectangle(cornerRadius: Radii.md, style: .continuous))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("fanInboxGateCta")
            }
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.warningBg)
        .overlay(
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .stroke(Theme.Color.warningLight, lineWidth: 1)
        )
        .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        .accessibilityIdentifier("fanInboxGate")
    }

    /// A15.5 composer quota gate — "3 of 5 left · resets when your
    /// membership renews".
    private func quotaGate(_ start: FanInboxStartContent) -> some View {
        HStack(spacing: Spacing.s2) {
            HStack(spacing: Spacing.s1) {
                Icon(.messageSquare, size: 11, color: Theme.Color.primary700)
                Text(start.quota.chipLabel)
                    .font(.system(size: 11, weight: .bold))
                    .foregroundStyle(Theme.Color.primary700)
            }
            .padding(.horizontal, Spacing.s2)
            .padding(.vertical, Spacing.s1)
            .background(Theme.Color.infoBg)
            .clipShape(Capsule())

            HStack(spacing: Spacing.s1) {
                Icon(.refreshCw, size: 10, color: Theme.Color.appTextSecondary)
                Text("Resets when your membership renews")
                    .font(.system(size: 10.5))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                    .lineLimit(1)
            }
            Spacer(minLength: Spacing.s0)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s2)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .top) {
            Rectangle().fill(Theme.Color.appBorder).frame(height: 1)
        }
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("fanInboxQuotaGate")
    }
}
