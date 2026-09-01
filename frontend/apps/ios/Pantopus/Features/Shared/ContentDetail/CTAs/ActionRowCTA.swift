//
//  ActionRowCTA.swift
//  Pantopus
//
//  `action_row` CTA slot for the Public profile detail. P6.5
//  differentiates the sticky footer per profile kind:
//
//  - Persona profiles surface a single primary "Follow" CTA.
//  - Local profiles surface a primary "Message" CTA + an outline
//    "Connect" CTA.
//
//  The CTA tracks the matching `PublicProfileActionState` so the button
//  reflects in-flight / succeeded poses without re-fetching the profile.
//

import SwiftUI

/// Per-kind sticky CTA for the Public profile detail. The body is empty
/// when no kind is supplied so legacy callers (and the empty-state
/// path) keep rendering the existing no-footer layout.
@MainActor
public struct ActionRowCTA: View {
    public enum Kind {
        case persona(followState: PublicProfileActionState, onFollow: @MainActor () -> Void)
        case local(
            messageState: PublicProfileActionState,
            connectState: PublicProfileActionState,
            onMessage: @MainActor () -> Void,
            onConnect: @MainActor () -> Void
        )
    }

    private let kind: Kind?

    public init(kind: Kind? = nil) {
        self.kind = kind
    }

    public var body: some View {
        switch kind {
        case .none:
            EmptyView()
        case let .persona(state, onFollow):
            PersonaFollowFooter(state: state, onFollow: onFollow)
        case let .local(messageState, connectState, onMessage, onConnect):
            LocalMessageConnectFooter(
                messageState: messageState,
                connectState: connectState,
                onMessage: onMessage,
                onConnect: onConnect
            )
        }
    }
}

@MainActor
private struct PersonaFollowFooter: View {
    let state: PublicProfileActionState
    let onFollow: @MainActor () -> Void

    var body: some View {
        Button(action: onFollow) {
            HStack(spacing: Spacing.s2) {
                Icon(state == .succeeded ? .check : .plus, size: 16, color: Theme.Color.appTextInverse)
                Text(state == .succeeded ? "Following" : "Follow")
                    .font(.system(size: PantopusTextStyle.small.size, weight: .bold))
                    .foregroundStyle(Theme.Color.appTextInverse)
            }
            .frame(maxWidth: .infinity, minHeight: 48)
            .background(Theme.Color.primary600)
            .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
        }
        .buttonStyle(.plain)
        .disabled(state == .inFlight)
        .opacity(state == .inFlight ? 0.7 : 1)
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .top) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
        .accessibilityIdentifier("publicProfileFollowCta")
        .accessibilityLabel(state == .succeeded ? "Following" : "Follow")
    }
}

@MainActor
private struct LocalMessageConnectFooter: View {
    let messageState: PublicProfileActionState
    let connectState: PublicProfileActionState
    let onMessage: @MainActor () -> Void
    let onConnect: @MainActor () -> Void

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Button(action: onConnect) {
                HStack(spacing: Spacing.s2) {
                    Icon(
                        connectState == .succeeded ? .check : .userPlus,
                        size: 16,
                        color: Theme.Color.appText
                    )
                    Text(connectState == .succeeded ? "Requested" : "Connect")
                        .font(.system(size: PantopusTextStyle.small.size, weight: .semibold))
                        .foregroundStyle(Theme.Color.appText)
                }
                .frame(maxWidth: .infinity, minHeight: 48)
                .background(Theme.Color.appSurface)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(connectState == .inFlight)
            .opacity(connectState == .inFlight ? 0.7 : 1)
            .accessibilityIdentifier("publicProfileConnectCta")
            .accessibilityLabel(connectState == .succeeded ? "Connection requested" : "Connect")

            Button(action: onMessage) {
                HStack(spacing: Spacing.s2) {
                    Icon(.messageSquare, size: 16, color: Theme.Color.appTextInverse)
                    Text("Message")
                        .font(.system(size: PantopusTextStyle.small.size, weight: .bold))
                        .foregroundStyle(Theme.Color.appTextInverse)
                }
                .frame(maxWidth: .infinity, minHeight: 48)
                .background(Theme.Color.primary600)
                .clipShape(RoundedRectangle(cornerRadius: Radii.lg, style: .continuous))
            }
            .buttonStyle(.plain)
            .disabled(messageState == .inFlight)
            .opacity(messageState == .inFlight ? 0.7 : 1)
            .accessibilityIdentifier("publicProfileMessageCta")
            .accessibilityLabel("Message")
        }
        .padding(Spacing.s4)
        .frame(maxWidth: .infinity)
        .background(Theme.Color.appSurface)
        .overlay(alignment: .top) {
            Rectangle().fill(Theme.Color.appBorderSubtle).frame(height: 1)
        }
    }
}
