// Headless, bounded read only. Requires existing permission; never requests access or writes events/files.
import Foundation
import EventKit
enum CalendarOpenFailure: Int32, Error { case permission = 20, selection = 21, tooMany = 22 }
func calendarOpenAccessStatus() -> String { EKEventStore.authorizationStatus(for: .event) == .fullAccess ? "granted" : "not-granted" }
struct CalendarOpenRequest: Decodable {
    let kind: String; let calendarIds: [String]; let startDate: String; let endDateExclusive: String; let timeZone: String; let maxEvents: Int
    func validate() throws -> (Calendar, Date, Date) {
        guard kind == "mac-calendar-read-on-open-v1", timeZone == "America/New_York", (1...5).contains(calendarIds.count), Set(calendarIds).count == calendarIds.count, calendarIds.allSatisfy({ !$0.isEmpty && $0.utf8.count <= 4096 && !$0.unicodeScalars.contains(where: { CharacterSet.controlCharacters.contains($0) }) }), (1...250).contains(maxEvents) else { throw PreviewError.invalidWindow }
        var calendar = Calendar(identifier: .gregorian); calendar.timeZone = TimeZone(identifier: timeZone)!
        let formatter = DateFormatter(); formatter.locale = Locale(identifier: "en_US_POSIX"); formatter.calendar = calendar; formatter.timeZone = calendar.timeZone; formatter.dateFormat = "yyyy-MM-dd"; formatter.isLenient = false
        guard startDate.range(of: "^(20[0-9]{2}|2100)-[0-9]{2}-[0-9]{2}$", options: .regularExpression) != nil, endDateExclusive.range(of: "^(20[0-9]{2}|2100)-[0-9]{2}-[0-9]{2}$", options: .regularExpression) != nil, let start = formatter.date(from: startDate), let end = formatter.date(from: endDateExclusive), formatter.string(from: start) == startDate, formatter.string(from: end) == endDateExclusive else { throw PreviewError.invalidWindow }
        _ = try CalendarWindow.make(start: start, end: end, selectedCount: calendarIds.count, calendar: calendar); return (calendar, start, end)
    }
}
func calendarOpenReadSelfTest() -> Bool {
    let good = CalendarOpenRequest(kind: "mac-calendar-read-on-open-v1", calendarIds: ["fictional-calendar"], startDate: "2026-10-31", endDateExclusive: "2026-11-30", timeZone: "America/New_York", maxEvents: 5)
    guard let (_, start, end) = try? good.validate(), end.timeIntervalSince(start) == 30 * 86400 + 3600 else { return false }
    return (try? CalendarOpenRequest(kind: good.kind, calendarIds: good.calendarIds, startDate: "2026-02-30", endDateExclusive: "2026-03-05", timeZone: good.timeZone, maxEvents: 5).validate()) == nil
}
func calendarOpenReadData(_ request: CalendarOpenRequest, fixture: Bool) throws -> Data {
    let (calendar, start, end) = try request.validate()
        var events: [[String:Any]] = []
        if fixture {
            let eventStart = start.addingTimeInterval(36000), iso = ISO8601DateFormatter()
            events = [["title":"Fictional calendar-open appointment", "calendarTitle":"Fictional Personal", "calendarId":request.calendarIds[0], "eventId":"fictional-open-event", "occurrenceStart":NSNull(), "start":iso.string(from:eventStart), "end":iso.string(from:eventStart.addingTimeInterval(3600)), "allDay":false]]
        } else {
            guard EKEventStore.authorizationStatus(for: .event) == .fullAccess else { throw CalendarOpenFailure.permission }
            let store = EKEventStore(); defer { store.reset() }
            let calendars = try request.calendarIds.map { id -> EKCalendar in guard let c = store.calendar(withIdentifier:id), c.calendarIdentifier == id else { throw CalendarOpenFailure.selection }; return c }
            let matching = store.events(matching: store.predicateForEvents(withStart:start, end:end, calendars:calendars)); guard matching.count <= 250 else { throw CalendarOpenFailure.tooMany }
            let iso = ISO8601DateFormatter()
            for event in matching where event.status != .canceled {
                guard let c = event.calendar, request.calendarIds.contains(c.calendarIdentifier), let first = event.startDate, let last = event.endDate, let eventId = event.eventIdentifier, !eventId.isEmpty else { throw PreviewError.invalidWindow }
                let span = try CalendarWindow.eventSpan(start:first, end:last, allDay:event.isAllDay, calendar:calendar)
                if span.start >= end || span.end <= start { continue }
                let title = event.title ?? "Untitled event"; guard title.count <= 300, c.title.count <= 300, eventId.count <= 1024 else { throw PreviewError.invalidWindow }
                events.append(["title":title, "calendarTitle":c.title, "calendarId":c.calendarIdentifier, "eventId":eventId, "occurrenceStart":event.occurrenceDate.map { iso.string(from:$0) } as Any? ?? NSNull(), "start":iso.string(from:span.start), "end":iso.string(from:span.end), "allDay":event.isAllDay])
                guard events.count <= request.maxEvents else { throw CalendarOpenFailure.tooMany }
            }
            guard EKEventStore.authorizationStatus(for: .event) == .fullAccess else { throw CalendarOpenFailure.permission }
        }
        events.sort { String(describing:$0["start"]!) < String(describing:$1["start"]!) }
        let result: [String:Any] = ["kind":"mac-calendar-preview-v1", "identityReview":true, "calendarCount":request.calendarIds.count, "startDate":request.startDate, "endDateExclusive":request.endDateExclusive, "timeZone":request.timeZone, "events":events]
        let output = try JSONSerialization.data(withJSONObject:result); guard output.count <= 262144 else { throw PreviewError.invalidWindow }; return output
}
func runCalendarOpenRead() -> Int32 {
    do {
        guard CommandLine.arguments.count == 2, Bundle.main.object(forInfoDictionaryKey: "CCCalendarReadOnOpen") as? Bool == true, let input = try FileHandle.standardInput.read(upToCount: 16385), input.count <= 16384 else { throw PreviewError.invalidWindow }
        let request = try JSONDecoder().decode(CalendarOpenRequest.self, from: input), fixture = Bundle.main.object(forInfoDictionaryKey: "CCFictionalFixtureMode") as? Bool ?? false
        FileHandle.standardOutput.write(try calendarOpenReadData(request, fixture: fixture)); return 0
    } catch let reason as CalendarOpenFailure { return reason.rawValue } catch { FileHandle.standardError.write(Data("Calendar read unavailable or outside approved bounds. No partial events returned.\n".utf8)); return 1 }
}
