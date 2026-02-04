import SwiftUI

struct LobbyView: View {
    @StateObject private var voiceManager = VoiceManager.shared
    
    var body: some View {
        VStack {
            Text("SafeZone Lobby")
                .font(.largeTitle)
                .fontWeight(.bold)
                .foregroundColor(.white)
                .padding(.top, 40)
            
            Text("Bağlı Sunucu: TR-Istanbul-1")
                .font(.caption)
                .foregroundColor(.green)
                .padding(.bottom, 20)
            
            Spacer()
            
            // Voice Channel Card
            RoundedRectangle(cornerRadius: 16)
                .fill(Color.gray.opacity(0.2))
                .frame(height: 120)
                .overlay(
                    HStack {
                        VStack(alignment: .leading) {
                            HStack {
                                Image(systemName: "mic.fill")
                                    .foregroundColor(voiceManager.isConnected ? .green : .red)
                                Text("Genel Sohbet #1")
                                    .foregroundColor(.white)
                                    .font(.headline)
                            }
                            Text(voiceManager.isConnected ? "Bağlandı (12ms)" : "Bağlantı Kesildi")
                                .font(.caption)
                                .foregroundColor(.gray)
                        }
                        
                        Spacer()
                        
                        Button(action: {
                            voiceManager.toggleMute()
                        }) {
                            Image(systemName: voiceManager.isMuted ? "mic.slash.fill" : "mic.fill")
                                .font(.title2)
                                .foregroundColor(.white)
                                .padding()
                                .background(voiceManager.isMuted ? Color.red : Color.blue)
                                .clipShape(Circle())
                        }
                    }
                    .padding()
                )
                .padding()
            
            // Connection Control
            Button(action: {
                if voiceManager.isConnected {
                    voiceManager.disconnect()
                } else {
                    voiceManager.connect()
                }
            }) {
                Text(voiceManager.isConnected ? "Ayrıl" : "Sohbete Katıl")
                    .foregroundColor(.white)
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(voiceManager.isConnected ? Color.red.opacity(0.8) : Color.green.opacity(0.8))
                    .cornerRadius(12)
            }
            .padding(.horizontal)
            .padding(.bottom, 40)
            
            Spacer()
        }
        .background(Color.black.edgesIgnoringSafeArea(.all))
    }
}
