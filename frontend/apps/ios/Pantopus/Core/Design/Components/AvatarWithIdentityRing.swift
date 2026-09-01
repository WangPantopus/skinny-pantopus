//
//  AvatarWithIdentityRing.swift
//  Pantopus
//
//  40pt avatar with a conic-gradient ring that tracks profile completion
//  for the current identity pillar.
//

import SwiftUI

/// Identity pillar, used for the ring tint.
public enum IdentityPillar: Sendable, Hashable {
    case personal, home, business

    var color: Color {
        switch self {
        case .personal: Theme.Color.personal
        case .home: Theme.Color.home
        case .business: Theme.Color.business
        }
    }

    var backgroundColor: Color {
        switch self {
        case .personal: Theme.Color.personalBg
        case .home: Theme.Color.homeBg
        case .business: Theme.Color.businessBg
        }
    }
}

/// Avatar tile with an identity-tinted progress ring.
///
/// - Parameters:
///   - name: User's display name — used to generate initials when no image.
///   - imageURL: Optional avatar URL. Falls back to initials on nil / failure.
///   - identity: Identity pillar determining ring color.
///   - ringProgress: Completion in `0...1`.
///   - size: Outer diameter; defaults to 40pt.
@MainActor
public struct AvatarWithIdentityRing: View {
    private let name: String
    private let imageURL: URL?
    private let identity: IdentityPillar
    private let ringProgress: Double
    private let size: CGFloat

    public init(
        name: String,
        imageURL: URL? = nil,
        identity: IdentityPillar,
        ringProgress: Double,
        size: CGFloat = 40
    ) {
        self.name = name
        self.imageURL = imageURL
        self.identity = identity
        self.ringProgress = max(0, min(1, ringProgress))
        self.size = size
    }

    public var body: some View {
        let ringWidth: CGFloat = 2.5
        let inner = size - ringWidth * 2
        ZStack {
            Circle().stroke(Theme.Color.appBorder, lineWidth: ringWidth)
            Circle()
                .trim(from: 0, to: CGFloat(ringProgress))
                .stroke(identity.color, style: StrokeStyle(lineWidth: ringWidth, lineCap: .round))
                .rotationEffect(.degrees(-90))
            avatarBody
                .frame(width: inner, height: inner)
                .clipShape(Circle())
        }
        .frame(width: size, height: size)
        .accessibilityElement()
        .accessibilityLabel("\(name), \(Int(ringProgress * 100))% profile complete")
    }

    @ViewBuilder private var avatarBody: some View {
        if let imageURL {
            AsyncImage(url: imageURL) { phase in
                switch phase {
                case let .success(image): image.resizable().scaledToFill()
                default: initialsView
                }
            }
        } else {
            initialsView
        }
    }

    private var initialsView: some View {
        ZStack {
            identity.backgroundColor
            Text(initials(from: name))
                .pantopusTextStyle(.small)
                .foregroundStyle(identity.color)
        }
    }

    private func initials(from name: String) -> String {
        let parts = name.split(separator: " ").prefix(2)
        return parts.compactMap { $0.first.map(String.init) }.joined().uppercased()
    }
}

#Preview("Progress variants") {
    HStack(spacing: Spacing.s4) {
        AvatarWithIdentityRing(name: "Alice Doe", identity: .personal, ringProgress: 0.25)
        AvatarWithIdentityRing(name: "Bob Roy", identity: .home, ringProgress: 0.6)
        AvatarWithIdentityRing(name: "Carmen Lee", identity: .business, ringProgress: 1.0, size: 56)
    }
    .padding()
}
