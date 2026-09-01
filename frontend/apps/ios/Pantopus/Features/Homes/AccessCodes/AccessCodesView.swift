//
//  AccessCodesView.swift
//  Pantopus
//
//  T6.4a — Thin wrapper around `ListOfRowsView`. The chrome (chip strip,
//  card-style sections, secondary-create FAB tinted home-green, 2-line
//  top bar with the home subtitle) is delivered by the shared shell;
//  this view only adds the transient toast overlay because the shell
//  doesn't host one yet.
//

import SwiftUI

struct AccessCodesView: View {
    @State private var viewModel: AccessCodesViewModel

    init(viewModel: AccessCodesViewModel) {
        _viewModel = State(initialValue: viewModel)
    }

    var body: some View {
        ListOfRowsView(dataSource: viewModel)
            .accessibilityIdentifier(AccessCodesA11y.screen)
            .sensitiveScreen()
            .overlay(alignment: .bottom) {
                if let message = viewModel.toastMessage {
                    AccessCodesToast(message: message)
                        .padding(.bottom, Spacing.s12)
                        .transition(.move(edge: .bottom).combined(with: .opacity))
                        .accessibilityIdentifier(AccessCodesA11y.toast)
                }
            }
            .pantopusAnimation(.componentState, value: viewModel.toastMessage)
    }
}

/// Compact "code copied" toast — dark pill, white text, check icon.
/// Mirrors the Android `Snackbar` style used elsewhere in the app.
private struct AccessCodesToast: View {
    let message: String

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Icon(.check, size: 14, color: Theme.Color.appSurface)
            Text(message)
                .pantopusTextStyle(.small)
                .foregroundStyle(Theme.Color.appSurface)
        }
        .padding(.horizontal, Spacing.s4)
        .padding(.vertical, Spacing.s2)
        .background(
            Capsule(style: .continuous)
                .fill(Theme.Color.appTextStrong)
        )
        .shadow(color: Color.black.opacity(0.18), radius: 12, x: 0, y: 6)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(message)
    }
}
