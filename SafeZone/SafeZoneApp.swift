import SwiftUI

@main
struct SafeZoneApp: App {
    var body: some Scene {
        WindowGroup {
            ContentView()
                .preferredColorScheme(.dark) // Enforce the 'Premium Dark' look
        }
    }
}
