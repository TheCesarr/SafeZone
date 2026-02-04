import SwiftUI

struct ContentView: View {
    // In a real app, this would be in a ViewModel or EnvironmentObject
    @State private var isAuthenticated = false
    
    var body: some View {
        ZStack {
            // Background
            Color.black.edgesIgnoringSafeArea(.all)
            
            if isAuthenticated {
                LobbyView()
                    .transition(.opacity)
            } else {
                AuthenticationView(isAuthenticated: $isAuthenticated)
                    .transition(.opacity)
            }
        }
        .animation(.easeInOut, value: isAuthenticated)
    }
}
