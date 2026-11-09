// Included only in the opt-in transfer build. Never reads EventKit or writes files.
import Foundation
import Darwin

struct MacTransferGrant: Decodable {
    struct Scope: Decodable { let calendarCount: Int; let maxEvents: Int; let startDate: String; let endDateExclusive: String; let timeZone: String }
    let endpoint: String
    let capability: String
    let identityReview: Bool?
    let expiresAt: Double
    let scope: Scope
}
final class NoTransferRedirects: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
func readMacTransferGrant(_ path: String) throws -> MacTransferGrant {
    let descriptor = open(path, O_RDONLY | O_NOFOLLOW)
    guard descriptor >= 0 else { throw PreviewError.invalidWindow }
    defer { close(descriptor) }
    var info = stat()
    guard fstat(descriptor, &info) == 0, info.st_uid == getuid(), (info.st_mode & S_IFMT) == S_IFREG, (info.st_mode & 0o777) == 0o600, info.st_size > 0, info.st_size <= 4096 else { throw PreviewError.invalidWindow }
    var bytes = [UInt8](repeating: 0, count: Int(info.st_size) + 1)
    let count = read(descriptor, &bytes, bytes.count)
    guard count == Int(info.st_size) else { throw PreviewError.invalidWindow }
    let grant = try JSONDecoder().decode(MacTransferGrant.self, from: Data(bytes.prefix(count)))
    guard grant.endpoint == "http://127.0.0.1:5301/auth/google/mac-calendar-transfer", grant.capability.range(of: "^[A-Za-z0-9_-]{43}$", options: .regularExpression) != nil, grant.expiresAt > Date().timeIntervalSince1970 * 1000, grant.expiresAt <= Date().addingTimeInterval(301).timeIntervalSince1970 * 1000 else { throw PreviewError.invalidWindow }
    return grant
}
extension PreviewController {
    func transferCurrentPreview() {
        guard let path = Bundle.main.object(forInfoDictionaryKey: "CCMacBridgeFile") as? String, let range = previewRange, let expiryDate = previewExpiresAt, expiryDate > Date(), fixture || EKEventStore.authorizationStatus(for: .event) == .fullAccess else { status.stringValue = "Create a fresh preview before transferring. Nothing transferred."; return }
        do {
            let grant = try readMacTransferGrant(path)
            guard (grant.identityReview ?? false) == identityReview else { throw PreviewError.invalidWindow }
            let date = DateFormatter(); date.locale = Locale(identifier: "en_US_POSIX"); date.calendar = Calendar(identifier: .gregorian); date.timeZone = .current; date.dateFormat = "yyyy-MM-dd"
            guard grant.scope.calendarCount == previewCalendarCount, snapshots.count <= grant.scope.maxEvents, grant.scope.startDate == date.string(from: range.start), grant.scope.endDateExclusive == date.string(from: range.end), grant.scope.timeZone == TimeZone.current.identifier else { throw PreviewError.invalidWindow }
            let events = try macCalendarTransferEvents(snapshots, identityReview: identityReview)
            let payload: [String: Any] = ["kind": "mac-calendar-preview-v1", "identityReview": identityReview, "calendarCount": previewCalendarCount, "startDate": grant.scope.startDate, "endDateExclusive": grant.scope.endDateExclusive, "timeZone": grant.scope.timeZone, "events": events]
            var request = URLRequest(url: URL(string: grant.endpoint)!)
            request.httpMethod = "POST"; request.timeoutInterval = 15; request.setValue("application/json", forHTTPHeaderField: "Content-Type"); request.setValue(grant.capability, forHTTPHeaderField: "X-CC-Mac-Transfer"); request.httpBody = try JSONSerialization.data(withJSONObject: payload)
            guard request.httpBody!.count <= 262144 else { throw PreviewError.invalidWindow }
            let config = URLSessionConfiguration.ephemeral; config.httpShouldSetCookies = false; config.httpCookieStorage = nil; config.urlCredentialStorage = nil; config.urlCache = nil; config.timeoutIntervalForResource = 15
            let session = URLSession(configuration: config, delegate: NoTransferRedirects(), delegateQueue: nil)
            status.stringValue = "Transferring this preview to the local Daily Brief. Nothing is being saved."
            session.dataTask(with: request) { [weak self] data, response, error in
                session.finishTasksAndInvalidate()
                let receipt = data.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
                let reason = receipt?["reason"] as? String
                let labels = ["all-day-boundaries": "All-day dates need adjustment.", "event-window": "An event did not overlap the approved window.", "event-timestamp": "An event timestamp was invalid.", "event-metadata": "Event metadata was invalid.", "selection-scope": "Selection differed from the approved scope.", "session-ended": "The app session ended.", "expired-or-used": "The one-use handoff expired or was already used.", "expired": "The handoff expired."]
                let explanation = reason.flatMap { labels[$0] } ?? "Transfer was not confirmed."
                let success = error == nil && (response as? HTTPURLResponse)?.statusCode == 200 && data != nil
                DispatchQueue.main.async { guard let self = self, self.previewExpiresAt == expiryDate, expiryDate > Date() else { return }; self.status.stringValue = success ? "Preview transferred. View temporary Mac calendar Brief in the app. Nothing saved; expires within five minutes." : explanation + " Nothing saved. No automatic retry; prepare a fresh transfer if needed." }
            }.resume()
        } catch { status.stringValue = "No matching approved transfer is ready. Prepare one in the local app; check dates, time zone and selected calendars. Nothing transferred." }
    }
}
func macCalendarTransferEvents(_ snapshots: [EventSnapshot], identityReview: Bool) throws -> [[String: Any]] {
            let iso = ISO8601DateFormatter()
            return try snapshots.map { event in
                var value: [String: Any] = ["title": event.title, "calendarTitle": String(event.calendarTitle.prefix(300)), "start": iso.string(from: event.start), "end": iso.string(from: event.end), "allDay": event.allDay]
                if identityReview { guard let calendarId = event.calendarId, let eventId = event.eventId, !calendarId.isEmpty, !eventId.isEmpty else { throw PreviewError.invalidWindow }; value["calendarId"] = calendarId; value["eventId"] = eventId; value["occurrenceStart"] = event.occurrenceStart.map { iso.string(from: $0) } as Any? ?? NSNull() }
                return value
            }
}
func installMacTransferObserver() -> NSObjectProtocol {
    NotificationCenter.default.addObserver(forName: NSNotification.Name("CCExplicitMacTransfer"), object: nil, queue: .main) { notice in (notice.object as? PreviewController)?.transferCurrentPreview() }
}
