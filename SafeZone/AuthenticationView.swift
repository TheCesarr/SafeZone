import SwiftUI

struct AuthenticationView: View {
    @Binding var isAuthenticated: Bool
    @State private var phoneNumber: String = ""
    @State private var verificationCode: String = ""
    @State private var showVerification: Bool = false
    
    var body: some View {
        VStack(spacing: 20) {
            Image(systemName: "shield.checkerboard")
                .resizable()
                .aspectRatio(contentMode: .fit)
                .frame(width: 80, height: 80)
                .foregroundColor(.blue)
                .padding(.bottom, 40)
            
            Text("SafeZone Giriş")
                .font(.title2)
                .fontWeight(.bold)
                .foregroundColor(.white)
            
            if !showVerification {
                // Phone Number Input
                TextField("Telefon Numarası (5XX...)", text: $phoneNumber)
                    .padding()
                    .background(Color.gray.opacity(0.2))
                    .cornerRadius(10)
                    .foregroundColor(.white)
                    .keyboardType(.numberPad)
                    .padding(.horizontal)
                
                Button(action: {
                    withAnimation {
                        showVerification = true
                    }
                }) {
                    Text("SMS Gönder")
                        .font(.headline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.blue)
                        .cornerRadius(10)
                }
                .padding(.horizontal)
                
            } else {
                // Verification Code Input
                TextField("Doğrulama Kodu (1234)", text: $verificationCode)
                    .padding()
                    .background(Color.gray.opacity(0.2))
                    .cornerRadius(10)
                    .foregroundColor(.white)
                    .keyboardType(.numberPad)
                    .padding(.horizontal)
                
                Button(action: {
                    // Simulate Verification
                    if verificationCode == "1234" {
                        isAuthenticated = true
                    }
                }) {
                    Text("Doğrula ve Gir")
                        .font(.headline)
                        .foregroundColor(.white)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.green)
                        .cornerRadius(10)
                }
                .padding(.horizontal)
                
                Button(action: {
                    withAnimation {
                        showVerification = false
                    }
                }) {
                    Text("Numarayı Düzenle")
                        .font(.caption)
                        .foregroundColor(.gray)
                }
            }
            
            Spacer()
        }
        .padding()
        .background(Color.black)
    }
}
