import Foundation

struct User: Identifiable, Codable {
    let id: UUID
    let phoneNumber: String
    let username: String
    let isVerified: Bool // TCKN Verified
    let profileImageURL: URL?
    
    // Privacy-focused masking
    var maskedPhone: String {
        return String(phoneNumber.prefix(3)) + "***" + String(phoneNumber.suffix(2))
    }
}
