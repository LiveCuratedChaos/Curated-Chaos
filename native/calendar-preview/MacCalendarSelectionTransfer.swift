// Opt-in selection metadata handoff only. Never queries events or writes files.
import Foundation
import Darwin
struct CalendarSelectionGrant: Decodable { let kind: String; let endpoint: String; let capability: String; let expiresAt: Double }
final class NoSelectionRedirects: NSObject, URLSessionTaskDelegate {
    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) }
}
func readSelectionGrant(_ path: String, fixture: Bool) throws -> CalendarSelectionGrant {
    let fd = open(path, O_RDONLY | O_NOFOLLOW); guard fd >= 0 else { throw PreviewError.invalidWindow }; defer { close(fd) }
    var info = stat(); guard fstat(fd, &info) == 0, info.st_uid == getuid(), (info.st_mode & S_IFMT) == S_IFREG, (info.st_mode & 0o777) == 0o600, info.st_nlink == 1, info.st_size > 0, info.st_size <= 4096 else { throw PreviewError.invalidWindow }
    var bytes = [UInt8](repeating: 0, count: Int(info.st_size) + 1); let count = read(fd, &bytes, bytes.count); guard count == Int(info.st_size) else { throw PreviewError.invalidWindow }
    let grant = try JSONDecoder().decode(CalendarSelectionGrant.self, from: Data(bytes.prefix(count)))
    let expected = fixture ? "http://127.0.0.1:5313/auth/workspace/calendar-selection/transfer" : "http://127.0.0.1:5312/auth/workspace/calendar-selection/transfer"
    guard grant.kind == "mac-calendar-selection-grant-v1", grant.endpoint == expected, grant.capability.range(of: "^[A-Za-z0-9_-]{43}$", options: .regularExpression) != nil, grant.expiresAt > Date().timeIntervalSince1970 * 1000, grant.expiresAt <= Date().addingTimeInterval(301).timeIntervalSince1970 * 1000 else { throw PreviewError.invalidWindow }; return grant
}
extension PreviewController {
    func rememberReviewedSelection() {
        let selected = choices.enumerated().filter { $0.element.state == .on }.map { $0.offset }
        guard selectionReview, let expiryDate = previewExpiresAt, expiryDate > Date(), selected == selectionReviewedIndexes, (1...5).contains(selected.count), let path = Bundle.main.object(forInfoDictionaryKey: "CCCalendarSelectionFile") as? String, fixture || (store != nil && EKEventStore.authorizationStatus(for: .event) == .fullAccess && selected.allSatisfy({ calendars.indices.contains($0) })) else { status.stringValue = "Review selected calendars first. Nothing remembered; no events read."; return }
        do {
            let grant = try readSelectionGrant(path, fixture: fixture)
            let ids = selected.map { fixture ? "fictional-calendar-\($0)" : calendars[$0].calendarIdentifier }, labels = selected.map { choices[$0].title }
            guard ids.allSatisfy({ !$0.isEmpty && $0.count <= 1024 }), labels.allSatisfy({ !$0.isEmpty && $0.count <= 300 }), Set(ids).count == ids.count else { throw PreviewError.invalidWindow }
            var request = URLRequest(url: URL(string: grant.endpoint)!); request.httpMethod = "POST"; request.timeoutInterval = 15; request.setValue("application/json", forHTTPHeaderField: "Content-Type"); request.setValue(grant.capability, forHTTPHeaderField: "X-CC-Calendar-Selection")
            request.httpBody = try JSONSerialization.data(withJSONObject: ["kind":"mac-calendar-selection-v1", "calendarIds":ids, "calendarLabels":labels]); guard request.httpBody!.count <= 12000 else { throw PreviewError.invalidWindow }
            let config = URLSessionConfiguration.ephemeral; config.httpShouldSetCookies = false; config.httpCookieStorage = nil; config.urlCredentialStorage = nil; config.urlCache = nil; config.timeoutIntervalForResource = 15
            let session = URLSession(configuration: config, delegate: NoSelectionRedirects(), delegateQueue: nil); previewExpiresAt = nil; selectionReviewedIndexes = []; status.stringValue = "Remembering calendar names and identifiers privately on this Mac. No events read."
            session.dataTask(with: request) { [weak self] data, response, error in
                session.finishTasksAndInvalidate(); let receipt = data.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String:Any] }; let success = error == nil && (response as? HTTPURLResponse)?.statusCode == 200 && receipt?["remembered"] as? Bool == true && receipt?["eventsRead"] as? Int == 0 && receipt?["eventAccessEnabled"] as? Bool == false
                DispatchQueue.main.async { guard let self = self else { return }; self.status.stringValue = success ? "Selected calendars remembered on this Mac. No events read; event access is still disabled." : "Remembering was not confirmed. Check setup before retrying. No events read." }
            }.resume()
        } catch { status.stringValue = "Prepare a fresh selection setup in the private app, then review your calendars. Nothing remembered; no events read." }
    }
}
func installSelectionRememberObserver() -> NSObjectProtocol { NotificationCenter.default.addObserver(forName: NSNotification.Name("CCRememberCalendarSelection"), object: nil, queue: .main) { notice in (notice.object as? PreviewController)?.rememberReviewedSelection() } }
