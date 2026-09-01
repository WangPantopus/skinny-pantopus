//
//  NotificationPromptInputs.swift
//  Pantopus
//
//  H15 · Stream I18. The verify-frame inputs — a 6-box one-time-code field and a
//  phone-number field — built to the H14 accessibility contract: the boxes are
//  decorative, a single real labelled input captures the code (reachable with
//  assistive tech, auto-fills the OTP), targets stay ≥44pt, and the focused box
//  carries a visible focus ring. Tokens only.
//

import SwiftUI

/// A 6-box code entry backed by one hidden, labelled `TextField` (so VoiceOver
/// and OTP autofill work). Filters to digits and caps at `length`.
struct CodeBoxField: View {
    @Binding var code: String
    let accent: Color
    var length = 6

    @FocusState private var focused: Bool

    var body: some View {
        ZStack {
            TextField("", text: $code)
                .keyboardType(.numberPad)
                .textContentType(.oneTimeCode)
                .focused($focused)
                .opacity(0.02)
                .onChange(of: code) { _, newValue in
                    code = String(newValue.filter(\.isNumber).prefix(length))
                }
                .accessibilityLabel("Verification code")
                .accessibilityValue(code.isEmpty ? "Empty" : code.map(String.init).joined(separator: " "))

            HStack(spacing: Spacing.s2) {
                ForEach(0..<length, id: \.self) { index in
                    box(at: index)
                }
            }
            .allowsHitTesting(false)
            .accessibilityHidden(true)
        }
        .contentShape(Rectangle())
        .onTapGesture { focused = true }
    }

    private func box(at index: Int) -> some View {
        let digits = Array(code)
        let hasDigit = index < digits.count
        let isCursor = index == digits.count && focused
        return Text(hasDigit ? String(digits[index]) : "")
            .pantopusTextStyle(.h3)
            .monospacedDigit()
            .foregroundStyle(Theme.Color.appText)
            .frame(width: 40, height: 48)
            .background(Theme.Color.appSurfaceSunken)
            .overlay(
                RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                    .stroke(
                        hasDigit ? accent : Theme.Color.appBorder,
                        lineWidth: hasDigit ? 1.5 : 1
                    )
            )
            .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
            .a11yFocusRing(active: isCursor, accent: accent)
    }
}

/// Phone-number field with a fixed +1 country chip leading the digits input.
struct PhoneEntryField: View {
    @Binding var phone: String

    var body: some View {
        HStack(spacing: Spacing.s2) {
            Text("+1")
                .pantopusTextStyle(.body)
                .fontWeight(.semibold)
                .foregroundStyle(Theme.Color.appText)
                .padding(.horizontal, Spacing.s3)
                .frame(minHeight: 44)
                .background(Theme.Color.appSurfaceSunken)
                .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                .accessibilityHidden(true)
            TextField("Phone number", text: $phone)
                .keyboardType(.phonePad)
                .textContentType(.telephoneNumber)
                .font(Theme.Font.role(.body))
                .padding(.horizontal, Spacing.s3)
                .frame(minHeight: 44)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Theme.Color.appSurfaceSunken)
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.sm, style: .continuous)
                        .stroke(Theme.Color.appBorder, lineWidth: 1)
                )
                .clipShape(RoundedRectangle(cornerRadius: Radii.sm, style: .continuous))
                .accessibilityLabel("Phone number, United States")
        }
    }
}

#if DEBUG
#Preview {
    struct Harness: View {
        @State private var code = "1234"
        @State private var phone = "5551234567"
        var body: some View {
            VStack(spacing: Spacing.s5) {
                CodeBoxField(code: $code, accent: Theme.Color.primary600)
                PhoneEntryField(phone: $phone)
            }
            .padding()
            .background(Theme.Color.appSurface)
        }
    }
    return Harness()
}
#endif
