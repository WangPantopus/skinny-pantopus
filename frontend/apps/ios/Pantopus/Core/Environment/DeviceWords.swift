//
//  DeviceWords.swift
//  Pantopus
//
//  What the app calls the device it runs on. Its words were written for
//  iPhones ("This iPhone", "saved on this phone"); on an iPad they say iPad.
//  "Phone number" and the phone company are not the device and keep their word.
//

import UIKit

@MainActor
enum DeviceWords {
    /// "iPhone" or "iPad", where the app names the device: "This iPhone", "Add to iPhone Calendar".
    static var name: String {
        isPad ? "iPad" : "iPhone"
    }

    /// "phone" or "iPad", in a plain sentence: "saved on this phone", "your phone's location".
    static var plainName: String {
        isPad ? "iPad" : "phone"
    }

    /// An iPad, for a sentence that lists the apps: "in the iPhone, iPad and Android apps". Words only: layouts
    /// go by the room they have, never by the device.
    static var isPad: Bool {
        UIDevice.current.userInterfaceIdiom == .pad
    }
}
