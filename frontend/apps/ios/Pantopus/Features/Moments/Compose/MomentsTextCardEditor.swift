//
//  MomentsTextCardEditor.swift
//  Pantopus
//
//  Board P2, a text card: up to 200 characters in white on one of six
//  backgrounds (teal, sky, green, amber, rose, slate), with the count under
//  it and Next to the Post sheet. On the iPhone Duo it takes the Duo's
//  layouts (`MomentsTextCardEditor+Duo.swift`); the words and the color live
//  in the composer's model, so a fold keeps them.
//

import SwiftUI

struct MomentsTextCardEditor: View {
    let model: MomentsComposerModel
    let onClose: () -> Void
    @FocusState var focused: Bool
    @Environment(\.momentsDuoScreen) var duo

    var body: some View {
        Group {
            switch duo.pose {
            case .closed:
                closedLayout
            case .wide:
                wideLayout
            case .phone, .upright, .table:
                phoneLayout
            }
        }
        // Folding or turning the Duo takes the keyboard just before the new layout: the words get it back, a few
        // times while the new screen settles.
        .onChange(of: duo.pose) { _, _ in
            for delay in [80, 250, 500, 1000] {
                Task {
                    try? await Task.sleep(for: .milliseconds(delay))
                    if !focused { focused = true }
                }
            }
        }
    }

    @ViewBuilder private var phoneLayout: some View {
        @Bindable var model = model
        let colors = MomentsPalette.card(model.background)
        ZStack(alignment: .top) {
            LinearGradient(colors: [colors.top, colors.bottom], startPoint: UnitPoint(x: 0.33, y: 0), endPoint: UnitPoint(x: 0.67, y: 1))
                .ignoresSafeArea()
                .onTapGesture { focused = true }
            VStack(spacing: 0) {
                MomentsComposerTopBar(place: model.placeChip, onCard: true, onClose: onClose) { nextButton(ink: colors.top) }
                    .padding(.trailing, Spacing.s1)
                Spacer(minLength: Spacing.s4)
                TextField(
                    "",
                    text: $model.text,
                    prompt: Text("What's happening here?").foregroundColor(Color.white.opacity(0.6)),
                    axis: .vertical
                )
                .font(.system(size: 29, weight: .semibold))
                .lineSpacing(8)
                .multilineTextAlignment(.center)
                .foregroundStyle(.white)
                .tint(.white)
                .lineLimit(1...8)
                .focused($focused)
                .padding(.horizontal, Spacing.s8)
                .accessibilityLabel("Your text")
                .accessibilityIdentifier("moments.textCard.field")
                Spacer(minLength: Spacing.s4)
                Text("\(model.text.count) / \(MomentsComposerModel.textLimit)")
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Color.white.opacity(0.78))
                    .accessibilityIdentifier("moments.textCard.count")
                swatches
                    .padding(.top, 14)
                    .padding(.bottom, focused ? Spacing.s4 : Spacing.s3)
                if !focused {
                    MomentsModeTabs(model: model)
                        .padding(.bottom, Spacing.s1)
                }
            }
        }
        .onAppear { focused = true }
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("moments.textCard")
    }

    func nextButton(ink: Color) -> some View {
        let isEmpty = model.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        return Button {
            focused = false
            model.finishText()
        } label: {
            Text("Next")
                .font(.system(size: 15, weight: .bold))
                .foregroundStyle(ink)
                .padding(.horizontal, 18)
                .frame(height: 36)
                .background(Capsule().fill(Color.white))
                .contentShape(Capsule())
        }
        .buttonStyle(.plain)
        .opacity(isEmpty ? 0.55 : 1)
        .disabled(isEmpty)
        .accessibilityIdentifier("moments.textCard.next")
    }

    var swatches: some View {
        swatches(spacing: Spacing.s3)
    }

    /// The six backgrounds: 12 pt apart on the phone, 10 on the Duo (boards C7, O8).
    func swatches(spacing: CGFloat) -> some View {
        HStack(spacing: spacing) {
            ForEach(MomentsComposerModel.backgrounds, id: \.self) { name in
                let selected = model.background == name
                Button { model.background = name } label: {
                    Circle()
                        .fill(MomentsPalette.card(name).top)
                        .frame(width: selected ? 34 : 28, height: selected ? 34 : 28)
                        .overlay(Circle().strokeBorder(Color.white.opacity(selected ? 1 : 0.85), lineWidth: selected ? 3 : 2))
                        .shadow(color: .black.opacity(0.25), radius: 2, x: 0, y: 1)
                        .frame(width: 44, height: 44)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityLabel(name.capitalized)
                .accessibilityAddTraits(selected ? [.isButton, .isSelected] : .isButton)
                .accessibilityIdentifier("moments.textCard.bg.\(name)")
            }
        }
        .accessibilityElement(children: .contain)
        .accessibilityLabel("Background color")
    }
}
