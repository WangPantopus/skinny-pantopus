//
//  MomentsComposer.swift
//  Pantopus
//
//  Posting a Moment, full screen over the map (boards P1–P4): the camera
//  first, Library (any photo or video) and Text beside it, then the Post
//  sheet. Before the first Moment it asks once whether you're 18 or older.
//  The camera, library and text card are dark; the Post sheet follows the
//  phone's light or dark. On the iPhone Duo each takes the layout for how the
//  Duo is held (the founder's Duo boards C6–C8, O7–O9, B2, U3); what's being
//  written lives in the model, which the Moments tab holds, so a fold keeps it.
//

import SwiftUI

struct MomentsComposer: View {
    /// Held by the Moments tab, above this cover: on the iPhone Duo a fold can build the composer again.
    let model: MomentsComposerModel
    let onClose: @MainActor () -> Void
    @State private var asksDiscard = false
    /// How the iPhone Duo is held, as this cover reads it; until then, as the Moments tab read it.
    @State private var ownScreen: MomentsDuoScreen?
    @Environment(\.momentsDuoScreen) private var openerScreen

    private var duo: MomentsDuoScreen {
        ownScreen ?? openerScreen
    }

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            if model.draft != nil {
                MomentsPostStage(model: model) { onClose() }
            } else if model.gate != .open {
                // Where you are first, then the 18+ question: nothing can be taken, picked or written before both.
                MomentsComposeGate(model: model, onClose: close)
                    .environment(\.colorScheme, .dark)
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
        // The screens inside know how the Duo is held from their first frame.
        .environment(\.momentsDuoScreen, duo)
        // Its own task, which a screen going away (a fold) never cancels; it runs once.
        .onAppear { Task { await model.start() } }
        // The camera runs only while it's what's showing; a fold doesn't stop it, closing does.
        .onChange(of: model.wantsCamera, initial: true) { _, wants in
            if wants {
                Task { await model.camera.start() }
            } else {
                model.camera.stop()
            }
        }
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
        .alert("Discard this Moment?", isPresented: $asksDiscard) {
            Button("Discard", role: .destructive) { leave() }
                .accessibilityIdentifier("moments.compose.discard")
            Button("Keep editing", role: .cancel) {}
                .accessibilityIdentifier("moments.compose.keep")
        } message: {
            Text("What you wrote won't be saved.")
        }
        // A fold or a turn switches layouts at once.
        .readsMomentsDuoScreen(Binding(get: { duo }, set: { screen in
            var transaction = Transaction()
            transaction.disablesAnimations = true
            withTransaction(transaction) { ownScreen = screen }
        }))
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("moments.compose")
    }

    /// Close asks first when a written card would be lost.
    private func close() {
        if model.draft == nil, !model.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            asksDiscard = true
        } else {
            leave()
        }
    }

    private func leave() {
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
            MomentsPlaceChip(place: place, style: onCard ? .onCard : .overPicture)
            Spacer(minLength: Spacing.s2)
            trailing()
        }
        .padding(.horizontal, Spacing.s2)
        .frame(height: 48)
    }
}

/// "pins at" the place: over the camera's picture, on the text card (P2's smaller, lighter chip), or on black beside
/// the text card on the open iPhone Duo (board O8).
struct MomentsPlaceChip: View {
    enum Style {
        case overPicture, onCard, onBlack
    }

    let place: String
    var style: Style = .overPicture

    var body: some View {
        let small = style != .overPicture
        HStack(spacing: 6) {
            Icon(.mapPin, size: small ? 15 : 16, strokeWidth: 2.2, color: .white)
            Text(place)
                .font(.system(size: small ? 13.5 : 14, weight: .semibold))
                .foregroundStyle(.white)
                .lineLimit(1)
        }
        .padding(.leading, small ? 9 : 10)
        .padding(.trailing, small ? 12 : 14)
        .frame(height: small ? 34 : 36)
        .background(Capsule().fill(style == .onBlack ? Color.white.opacity(0.14) : Color.black.opacity(small ? 0.22 : 0.42)))
        .background(Capsule().fill(.ultraThinMaterial).opacity(small ? 0 : 1))
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("This Moment will pin at \(place == "Your home" ? "your home" : place)")
        .accessibilityIdentifier("moments.camera.place")
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

/// Before the camera (the same on Android): location first, then the 18+
/// question, which is its own sheet over this. The camera, the library and
/// the text card wait behind both.
struct MomentsComposeGate: View {
    let model: MomentsComposerModel
    let onClose: () -> Void
    @State private var asking = false
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                Button(action: onClose) {
                    Icon(.x, size: 26, color: .white)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Close")
                .accessibilityIdentifier("moments.camera.close")
                Spacer(minLength: 0)
            }
            .padding(.horizontal, Spacing.s2)
            .frame(height: 48)
            Spacer(minLength: 0)
            switch model.gate {
            case .needsLocation:
                locationCard
            case .locating:
                Text("Finding where you are…")
                    .font(.system(size: 15, weight: .medium))
                    .foregroundStyle(Color.white.opacity(0.8))
            case .needsAdult, .open:
                EmptyView()
            }
            Spacer(minLength: 0)
        }
        // Back from Settings with location allowed: carry on.
        .onChange(of: scenePhase) { _, phase in
            if phase == .active, model.gate == .needsLocation { Task { await model.recheckLocation() } }
        }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("moments.gate")
    }

    private var locationCard: some View {
        VStack(spacing: Spacing.s3) {
            Icon(.mapPin, size: 34, color: Color.white.opacity(0.85))
            Text("Turn on location")
                .font(.system(size: 20, weight: .bold))
                .foregroundStyle(.white)
                .accessibilityAddTraits(.isHeader)
            Text("A Moment pins where you are when you post it. Pantopus never shows your live location.")
                .font(.system(size: 15))
                .foregroundStyle(Color.white.opacity(0.78))
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            Button {
                if model.locationRefused {
                    if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
                } else {
                    asking = true
                    Task {
                        await model.allowLocation()
                        asking = false
                    }
                }
            } label: {
                Text(model.locationRefused ? "Open Settings" : "Allow location")
                    .font(.system(size: 16, weight: .bold))
                    .foregroundStyle(.white)
                    .frame(maxWidth: .infinity, minHeight: 50)
                    .background(Capsule().fill(Theme.Color.primarySolid))
                    .contentShape(Capsule())
            }
            .buttonStyle(.plain)
            .disabled(asking)
            .padding(.top, Spacing.s2)
            .accessibilityIdentifier("moments.gate.allow")
        }
        .padding(.horizontal, Spacing.s8)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("moments.gate.location")
    }
}
