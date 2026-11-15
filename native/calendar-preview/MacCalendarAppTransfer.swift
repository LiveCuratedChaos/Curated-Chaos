// Runs authorized reads inside the launched app's Calendar permission context.
import Foundation
import Darwin
struct CalendarAppReadGrant: Decodable { let kind: String; let endpoint: String; let capability: String; let expiresAt: Double; let request: CalendarOpenRequest }
final class NoCalendarReadRedirects: NSObject, URLSessionTaskDelegate { func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void) { completionHandler(nil) } }
func readCalendarAppGrant(_ path: String) throws -> CalendarAppReadGrant {
    let fd = open(path, O_RDONLY | O_NOFOLLOW); guard fd >= 0 else { throw PreviewError.invalidWindow }; defer { close(fd) }
    var info = stat(); guard fstat(fd, &info) == 0, info.st_uid == getuid(), (info.st_mode & S_IFMT) == S_IFREG, (info.st_mode & 0o777) == 0o600, info.st_nlink == 1, info.st_size > 0, info.st_size <= 16384 else { throw PreviewError.invalidWindow }
    var bytes = [UInt8](repeating:0,count:Int(info.st_size)+1); let count = read(fd, &bytes, bytes.count); guard count == Int(info.st_size) else { throw PreviewError.invalidWindow }
    let grant = try JSONDecoder().decode(CalendarAppReadGrant.self, from:Data(bytes.prefix(count)))
    guard grant.kind == "mac-calendar-app-read-v1", grant.endpoint == "http://127.0.0.1:5313/auth/workspace/calendar-source/native-transfer", grant.capability.range(of:"^[A-Za-z0-9_-]{43}$",options:.regularExpression) != nil, grant.expiresAt > Date().timeIntervalSince1970*1000, grant.expiresAt <= Date().addingTimeInterval(61).timeIntervalSince1970*1000 else { throw PreviewError.invalidWindow }; _ = try grant.request.validate(); return grant
}
var usedCalendarAppGrants = Set<String>()
extension PreviewController {
    func acceptCalendarOpening(_ paths: [String]) {
        guard Bundle.main.object(forInfoDictionaryKey:"CCCalendarReadOnOpen") as? Bool == true, paths.count == 1, usedCalendarAppGrants.count < 100 else { return }
        do {
            let grant = try readCalendarAppGrant(paths[0]); guard !usedCalendarAppGrants.contains(grant.capability) else { throw PreviewError.invalidWindow }; usedCalendarAppGrants.insert(grant.capability)
            var payload: [String:Any]
            do { let data = try calendarOpenReadData(grant.request, fixture:fixture); guard grant.expiresAt > Date().timeIntervalSince1970*1000, let preview = try JSONSerialization.jsonObject(with:data) as? [String:Any] else { throw PreviewError.invalidWindow }; payload = ["preview":preview] }
            catch let failure as CalendarOpenFailure { payload = ["reason":Int(failure.rawValue)] }
            catch { payload = ["reason":23] }
            var request = URLRequest(url:URL(string:grant.endpoint)!); request.httpMethod = "POST"; request.timeoutInterval = 15; request.setValue("application/json",forHTTPHeaderField:"Content-Type");request.setValue(grant.capability,forHTTPHeaderField:"X-CC-Mac-Opening"); request.httpBody = try JSONSerialization.data(withJSONObject:payload); guard request.httpBody!.count <= 262144 else { throw PreviewError.invalidWindow }
            let config = URLSessionConfiguration.ephemeral;config.httpShouldSetCookies=false;config.httpCookieStorage=nil;config.urlCredentialStorage=nil;config.urlCache=nil;config.timeoutIntervalForResource=15
            let session=URLSession(configuration:config,delegate:NoCalendarReadRedirects(),delegateQueue:nil);status.stringValue="Checking the approved temporary Calendar opening. No events saved."
            session.dataTask(with:request) { [weak self] _,response,error in session.finishTasksAndInvalidate();DispatchQueue.main.async { self?.status.stringValue = error == nil && (response as? HTTPURLResponse)?.statusCode == 200 ? "Temporary Calendar response returned to your private preview. Nothing saved." : "Calendar response was not confirmed. No automatic retry; nothing saved." } }.resume()
        } catch { status.stringValue="The Calendar opening was not authorized or expired. No automatic retry." }
    }
}
func installCalendarAppReadObserver() -> NSObjectProtocol { NotificationCenter.default.addObserver(forName:NSNotification.Name("CCReadCalendarOpening"),object:nil,queue:.main) { notice in guard let controller=notice.object as? PreviewController,let paths=notice.userInfo?["paths"] as? [String] else { return };controller.acceptCalendarOpening(paths) } }
