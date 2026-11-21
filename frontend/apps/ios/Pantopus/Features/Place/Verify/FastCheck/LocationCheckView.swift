//
//  LocationCheckView.swift
//  Pantopus
//
//  "Location check" (FASTVERIFY drawing L1), then B3 on a match or the
//  miss's words with the other ways.
//

import SwiftUI
import UIKit

struct LocationCheckView: View {
    @State private var viewModel: LocationCheckViewModel
    @State private var showsOtherWays = false
    private let isRenter: Bool
    private let onStart: (PlaceVerifyMethod) -> Void
    private let onMailCode: () -> Void
    private let onGoToPlace: () -> Void
    private let onBack: () -> Void

    init(
        viewModel: LocationCheckViewModel,
        isRenter: Bool,
        onStart: @escaping (PlaceVerifyMethod) -> Void,
        onMailCode: @escaping () -> Void,
        onGoToPlace: @escaping () -> Void,
        onBack: @escaping () -> Void
    ) {
        _viewModel = State(initialValue: viewModel)
        self.isRenter = isRenter
        self.onStart = onStart
        self.onMailCode = onMailCode
        self.onGoToPlace = onGoToPlace
        self.onBack = onBack
    }

    var body: some View {
        Group {
            if viewModel.stage == .verified {
                FastCheckVerifiedView(
                    kind: .location,
                    address: viewModel.address,
                    isRenter: isRenter,
                    onMailCode: onMailCode,
                    onGoToPlace: onGoToPlace
                )
            } else {
                VStack(spacing: 0) {
                    FastCheckTopBar(title: "Location check", onBack: onBack)
                    ScrollView {
                        VStack(alignment: .leading, spacing: Spacing.s4) {
                            intro
                            if case let .missed(words) = viewModel.stage { missed(words) }
                            if showsOtherWays { otherWays }
                        }
                        .padding(.horizontal, Spacing.s4)
                        .padding(.top, Spacing.s3)
                        .padding(.bottom, Spacing.s5)
                    }
                    dock
                }
            }
        }
        .background(Theme.Color.appBg)
        .navigationBarBackButtonHidden(true)
        .toolbar(.hidden, for: .navigationBar)
        .accessibilityIdentifier("locationCheck")
    }

    private var intro: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            Text("Are you at home right now?")
                .scaledFont(28, weight: .bold)
                .foregroundStyle(Theme.Color.appText)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityAddTraits(.isHeader)
            (Text("We check your \(DeviceWords.plainName)'s location once and compare it with ")
                + Text(viewModel.address).bold() + Text("."))
                .scaledFont(16)
                .foregroundStyle(Theme.Color.appTextSecondary)
                .fixedSize(horizontal: false, vertical: true)
            LocationCheckPicture()
            VStack(alignment: .leading, spacing: Spacing.s3) {
                point("Works when you're inside your home, in the \(DeviceWords.isPad ? "iPhone, iPad" : "iPhone") and Android apps.")
                point("We keep match or no match and the date. Never where you were.")
                point(
                    "We check once more on another day when you open Pantopus at home.",
                    detail: "If that doesn't happen within 14 days, the Verified mark comes off until it does."
                )
            }
        }
    }

    private func point(_ text: String, detail: String? = nil) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: Spacing.s3) {
            Icon(.check, size: 15, strokeWidth: 2.5, color: Theme.Color.success)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: 2) {
                Text(text)
                    .scaledFont(16)
                    .foregroundStyle(Theme.Color.appText)
                    .fixedSize(horizontal: false, vertical: true)
                if let detail {
                    Text(detail)
                        .scaledFont(13)
                        .foregroundStyle(Theme.Color.appTextSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
        .accessibilityElement(children: .combine)
    }

    private func missed(_ words: String) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s2) {
            HStack(alignment: .top, spacing: Spacing.s3) {
                Icon(.info, size: 16, color: Theme.Color.warning)
                    .accessibilityHidden(true)
                Text(words)
                    .scaledFont(15)
                    .foregroundStyle(Theme.Color.appText)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityIdentifier("locationCheck.missed")
            }
            if viewModel.locationDenied {
                Button {
                    if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
                } label: {
                    Text("Open Settings")
                        .scaledFont(15, weight: .semibold)
                        .foregroundStyle(Theme.Color.primaryInk)
                        .frame(minHeight: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("locationCheck.settings")
            }
        }
        .padding(Spacing.s3)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: Radii.md, style: .continuous).fill(Theme.Color.warningBg))
    }

    private var otherWays: some View {
        let rows = PlaceVerifySheet.otherWays(HomeVerifyOptionsStore.shared.cached(homeId: viewModel.homeId), excluding: .location)
        return VStack(alignment: .leading, spacing: Spacing.s2) {
            Text("Try another way", style: .overline)
                .foregroundStyle(Theme.Color.appTextSecondary)
            FastCheckRowList(rows: rows, onStart: onStart)
        }
    }

    private var dock: some View {
        FastCheckDock {
            PrimaryButton(title: "Check my location", isLoading: viewModel.stage == .checking) {
                showsOtherWays = false
                await viewModel.check()
            }
            .accessibilityIdentifier("locationCheck.check")
            Button {
                showsOtherWays.toggle()
            } label: {
                Text("Verify another way")
                    .scaledFont(16, weight: .semibold)
                    .foregroundStyle(Theme.Color.primaryInk)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("locationCheck.otherWays")
        }
    }
}

/// The drawing's small picture: the home between two others, its lot outlined, the phone's dot inside.
private struct LocationCheckPicture: View {
    var body: some View {
        ZStack(alignment: .bottom) {
            RoundedRectangle(cornerRadius: Radii.lg, style: .continuous)
                .fill(Theme.Color.appSurfaceSunken)
            Rectangle()
                .fill(Theme.Color.appBorder)
                .frame(height: 10)
                .padding(.bottom, 26)
            HStack(alignment: .bottom, spacing: Spacing.s4) {
                nextHouse
                ZStack(alignment: .bottomTrailing) {
                    RoundedRectangle(cornerRadius: 4, style: .continuous)
                        .fill(Theme.Color.successBg)
                    RoundedRectangle(cornerRadius: 4, style: .continuous)
                        .strokeBorder(Theme.Color.success, style: StrokeStyle(lineWidth: 1.5, dash: [4, 3]))
                    Icon(.house, size: 30, strokeWidth: 1.75, color: Theme.Color.success)
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    Circle()
                        .fill(Theme.Color.primary600)
                        .frame(width: 10, height: 10)
                        .padding(3)
                        .background(Circle().fill(Theme.Color.primary200))
                        .padding(Spacing.s3)
                }
                .frame(width: 86, height: 54)
                nextHouse
            }
            .padding(.bottom, 36)
        }
        .frame(height: 104)
        .accessibilityHidden(true)
    }

    private var nextHouse: some View {
        RoundedRectangle(cornerRadius: 2, style: .continuous)
            .strokeBorder(Theme.Color.appBorderStrong, lineWidth: 1.5)
            .frame(width: 70, height: 42)
    }
}
