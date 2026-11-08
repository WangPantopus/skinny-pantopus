//
//  MomentsComposer.swift
//  Pantopus
//
//  Posting a Moment, full screen over the map (boards P1–P4): the camera
//  first, Library (the last 24 hours) and Text beside it, then the Post
//  sheet. Before the first Moment it asks once whether you're 18 or older.
//  The camera, library and text card are dark; the Post sheet follows the
//  phone's light or dark.
//

import SwiftUI

struct MomentsComposer: View {
    let onClose: @MainActor () -> Void
    @State private var model = MomentsComposerModel()

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            if model.draft != nil {
                MomentsPostStage(model: model) { onClose() }
            } else {
                Group {
                    switch model.mode {
                    case .camera: MomentsCameraScreen(model: model, onClose: close)
                    case .library: MomentsLibraryScreen(model: model, onClose: close)
                    case .text: MomentsTextCardEditor(model: model, onClose: close)
                    }
                }
                .environment(\.colorScheme, .dark)
            }
        }
        .task { await model.start() }
        .sheet(isPresented: Binding(get: { model.asksAdult }, set: { model.asksAdult = $0 })) {
            MomentsAdultSheet(model: model, onDecline: close)
                .presentationDetents([.height(300)])
                .interactiveDismissDisabled()
        }
        .alert(
            "Moments are for people 18 and older.",
            isPresented: Binding(get: { model.ageRefused }, set: { model.ageRefused = $0 })
        ) {
            Button("OK", role: .cancel) { close() }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("moments.compose")
    }

    private func close() {
        model.abandon()
        onClose()
    }
}

/// The top of the camera, the library and the text card: close, "pins at" the place, and one more control.
struct MomentsComposerTopBar<Trailing: View>: View {
    let place: String
    /// The text card's smaller, lighter chip (P2).
    var onCard = false
    let onClose: () -> Void
    @ViewBuilder let trailing: () -> Trailing

    var body: some View {
        HStack {
            Button(action: onClose) {
                Icon(.x, size: 26, color: .white)
                    .frame(width: 44, height: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Close")
            .accessibilityIdentifier("moments.camera.close")
            Spacer(minLength: Spacing.s2)
            HStack(spacing: 6) {
                Icon(.mapPin, size: onCard ? 15 : 16, strokeWidth: 2.2, color: .white)
                Text(place)
                    .font(.system(size: onCard ? 13.5 : 14, weight: .semibold))
                    .foregroundStyle(.white)
                    .lineLimit(1)
            }
            .padding(.leading, onCard ? 9 : 10)
            .padding(.trailing, onCard ? 12 : 14)
            .frame(height: onCard ? 34 : 36)
            .background(Capsule().fill(Color.black.opacity(onCard ? 0.22 : 0.42)))
            .background(Capsule().fill(.ultraThinMaterial).opacity(onCard ? 0 : 1))
            .accessibilityElement(children: .ignore)
            .accessibilityLabel("This Moment will pin at \(place)")
            .accessibilityIdentifier("moments.camera.place")
            Spacer(minLength: Spacing.s2)
            trailing()
        }
        .padding(.horizontal, Spacing.s2)
        .frame(height: 48)
    }
}

/// Library · Camera · Text, under the camera and the library.
struct MomentsModeTabs: View {
    let model: MomentsComposerModel

    var body: some View {
        HStack(spacing: 26) {
            tab(.library, "Library", id: "moments.compose.library")
            tab(.camera, "Camera", id: "moments.compose.camera")
            tab(.text, "Text", id: "moments.compose.text")
        }
        .frame(height: 44)
        .accessibilityElement(children: .contain)
        .accessibilityLabel("What to post")
    }

    private func tab(_ mode: MomentsComposerModel.Mode, _ title: String, id: String) -> some View {
        let selected = model.mode == mode
        return Button {
            model.mode = mode
        } label: {
            Text(title)
                .font(.system(size: 15, weight: selected ? .bold : .semibold))
                .foregroundStyle(selected ? Color.white : Color.white.opacity(0.7))
                .padding(.horizontal, selected ? 14 : 4)
                .frame(height: 44)
                .background(Capsule().fill(Color.white.opacity(selected ? 0.18 : 0)))
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
        .accessibilityIdentifier(id)
    }
}

/// Before the first Moment: the one-time 18+ confirmation (shared with Pulse's).
struct MomentsAdultSheet: View {
    let model: MomentsComposerModel
    let onDecline: () -> Void
    @State private var isSaving = false

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s4) {
            VStack(alignment: .leading, spacing: Spacing.s2) {
                Text("Before your first Moment")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(Theme.Color.appText)
                    .accessibilityAddTraits(.isHeader)
                Text("Moments are for people 18 and older.")
                    .font(.system(size: 16))
                    .foregroundStyle(Theme.Color.appTextSecondary)
                if let error = model.error {
                    Text(error)
                        .font(.system(size: 14))
                        .foregroundStyle(Theme.Color.error)
                }
            }
            Spacer(minLength: 0)
            Button {
                isSaving = true
                Task {
                    _ = await model.confirmAdult()
                    isSaving = false
                }
            } label: {
                Text("I'm 18 or older")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .background(Capsule().fill(Theme.Color.primarySolid))
                    .contentShape(Capsule())
            }
            .buttonStyle(.plain)
            .disabled(isSaving)
            .accessibilityIdentifier("moments.adult.confirm")
            Button(action: onDecline) {
                Text("Not now")
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundStyle(Theme.Color.primaryTint)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("moments.adult.notNow")
        }
        .padding(Spacing.s5)
        .padding(.top, Spacing.s2)
        .background(Theme.Color.appSurface)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("moments.adult")
    }
}
