//
//  CodeInput.swift
//  Pantopus
//
//  Six-character mono-letter input for postcard / 2FA codes. Visual boxes
//  reflect a single bound string; a hidden TextField receives keyboard
//  input so the boxes auto-advance and respect backspace without juggling
//  six discrete focus states. Disabled state surfaces a lock overlay
//  with a caption — used by A12.7 while the postcard is in transit.
//

import SwiftUI

/// Six-character monospace code field. Mirrors the design's `CodeInput`
/// primitive in `verify-postcard-frames.jsx` and the breach-locked variant
/// inferred from the in-transit frame.
@MainActor
public struct CodeInput: View {
    @Binding private var value: String
    private let isDisabled: Bool
    private let lockedCaption: String
    private let onComplete: ((String) -> Void)?
    private let identifier: String?

    @FocusState private var isFocused: Bool

    public init(
        value: Binding<String>,
        isDisabled: Bool = false,
        lockedCaption: String = "Code unlocks on delivery",
        identifier: String? = nil,
        onComplete: ((String) -> Void)? = nil
    ) {
        _value = value
        self.isDisabled = isDisabled
        self.lockedCaption = lockedCaption
        self.identifier = identifier
        self.onComplete = onComplete
    }

    public var body: some View {
        ZStack {
            boxes
                .opacity(isDisabled ? 0.5 : 1)
            hiddenInput
            if isDisabled {
                lockOverlay
            }
        }
        .contentShape(Rectangle())
        .onTapGesture { if !isDisabled { isFocused = true } }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Verification code")
        .accessibilityValue(accessibilityValue)
    }

    private var boxes: some View {
        HStack(spacing: Spacing.s2) {
            ForEach(0..<6, id: \.self) { index in
                box(at: index)
            }
        }
    }

    private func box(at index: Int) -> some View {
        let char = character(at: index)
        let isCaretSlot = isFocused && !isDisabled && index == value.count && index < 6
        let isFilled = !char.isEmpty
        return RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
            .fill(isDisabled ? Theme.Color.appSurfaceSunken : Theme.Color.appSurface)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(
                        borderColor(isFilled: isFilled, isCaretSlot: isCaretSlot),
                        lineWidth: isCaretSlot ? 2 : 1.5
                    )
            )
            .overlay(
                RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                    .stroke(Theme.Color.primary100, lineWidth: isCaretSlot ? 3 : 0)
                    .blur(radius: isCaretSlot ? 0.5 : 0)
                    .opacity(isCaretSlot ? 1 : 0)
                    .padding(-2)
            )
            .frame(width: 44, height: 56)
            .overlay(
                Text(char)
                    .font(.system(size: 22, weight: .bold, design: .monospaced))
                    .foregroundStyle(
                        isDisabled ? Theme.Color.appTextMuted : Theme.Color.appText
                    )
            )
    }

    /// Normalises raw keyboard input into the bound value: uppercased and
    /// clamped to six chars. Fires `onComplete` exactly once on the
    /// <6 → 6 transition. Internal so the test target can exercise the
    /// auto-advance / backspace / completion-once contract without
    /// driving the keyboard through XCUITest.
    func applyInput(_ raw: String) {
        let filtered = String(raw.uppercased().prefix(6))
        let oldCount = value.count
        guard filtered != value else { return }
        value = filtered
        if filtered.count == 6 && oldCount < 6 {
            onComplete?(filtered)
        }
    }

    private var hiddenInput: some View {
        TextField("", text: Binding(
            get: { value },
            set: { applyInput($0) }
        ))
        .textContentType(.oneTimeCode)
        .keyboardType(.asciiCapable)
        .autocorrectionDisabled(true)
        .textInputAutocapitalization(.characters)
        .focused($isFocused)
        .opacity(0.01)
        .frame(width: 1, height: 1)
        .allowsHitTesting(false)
        .disabled(isDisabled)
        .modifier(CodeInputIdentifierModifier(identifier: identifier))
    }

    private var lockOverlay: some View {
        HStack(spacing: Spacing.s1) {
            Icon(.lock, size: 12, color: Theme.Color.appTextSecondary)
            Text(lockedCaption)
                .font(.system(size: 11, weight: .medium))
                .foregroundStyle(Theme.Color.appTextSecondary)
        }
        .padding(.horizontal, Spacing.s3)
        .padding(.vertical, Spacing.s1)
        .background(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .fill(Theme.Color.appSurface.opacity(0.85))
        )
        .overlay(
            RoundedRectangle(cornerRadius: Radii.md, style: .continuous)
                .stroke(Theme.Color.appBorder, lineWidth: 1)
        )
        .accessibilityLabel("\(lockedCaption), input locked")
    }

    private func character(at index: Int) -> String {
        guard index < value.count else { return "" }
        let i = value.index(value.startIndex, offsetBy: index)
        return String(value[i])
    }

    private func borderColor(isFilled: Bool, isCaretSlot: Bool) -> Color {
        if isCaretSlot { return Theme.Color.primary600 }
        if isFilled { return Theme.Color.appBorderStrong }
        return Theme.Color.appBorder
    }

    private var accessibilityValue: String {
        if isDisabled { return "Locked" }
        if value.isEmpty { return "Empty" }
        return "\(value.count) of 6 characters entered"
    }
}

/// Conditional `accessibilityIdentifier` on the hidden TextField so UI tests
/// can `typeText(...)` directly without focus juggling.
private struct CodeInputIdentifierModifier: ViewModifier {
    let identifier: String?

    func body(content: Content) -> some View {
        if let identifier {
            content.accessibilityIdentifier(identifier)
        } else {
            content
        }
    }
}

#Preview("Code input states") {
    @Previewable @State var empty = ""
    @Previewable @State var partial = "4Q2"
    @Previewable @State var filled = "4Q2K7B"
    return VStack(spacing: Spacing.s5) {
        CodeInput(value: $empty)
        CodeInput(value: $partial)
        CodeInput(value: $filled)
        CodeInput(value: .constant(""), isDisabled: true)
    }
    .padding(Spacing.s4)
    .background(Theme.Color.appBg)
}
