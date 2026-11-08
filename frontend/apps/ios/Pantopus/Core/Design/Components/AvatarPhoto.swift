//
//  AvatarPhoto.swift
//  Pantopus
//
//  A person's photo inside an avatar circle, drawn over the initials the
//  circle already shows: they stay visible while the photo loads, when it
//  fails, and when the person has no photo.
//

import SwiftUI

/// The photo in an avatar circle (a business's logo for a business); nothing until it loads.
struct AvatarPhoto: View {
    let url: URL?

    var body: some View {
        if let url {
            CachedAsyncImage(url: url) { image in
                image.resizable().scaledToFill()
            } placeholder: {
                Color.clear
            }
            .clipShape(Circle())
        }
    }
}
