import Cocoa
import EventKit

struct CalendarWindow {
    let start: Date
    let end: Date
    static func eventSpan(start: Date, end: Date, allDay: Bool, calendar: Calendar = .current) throws -> CalendarWindow {
        guard end > start else { throw PreviewError.invalidWindow }
        if !allDay { return CalendarWindow(start: start, end: end) }
        // All-day events cover local dates, including feeds ending at 23:59:59.
        // Preserve an already-exclusive midnight; otherwise include the final covered day.
        let first = calendar.startOfDay(for: start), lastDay = calendar.startOfDay(for: end)
        let last = end == lastDay ? lastDay : calendar.date(byAdding: .day, value: 1, to: lastDay)!
        guard last > first else { throw PreviewError.invalidWindow }
        return CalendarWindow(start: first, end: last)
    }
    static func make(start: Date, end: Date, selectedCount: Int, calendar: Calendar = .current) throws -> CalendarWindow {
        let first = calendar.startOfDay(for: start), last = calendar.startOfDay(for: end)
        let days = calendar.dateComponents([.day], from: first, to: last).day ?? 0
        guard (1...5).contains(selectedCount), (1...31).contains(days), last > first else { throw PreviewError.invalidWindow }
        return CalendarWindow(start: first, end: last)
    }
}
enum PreviewError: Error { case invalidWindow }
struct EventSnapshot {
    let title: String
    let start: Date
    let end: Date
    let allDay: Bool
    let calendarTitle: String
    var calendarId: String? = nil
    var eventId: String? = nil
    var occurrenceStart: Date? = nil
}

final class PreviewController: NSObject, NSApplicationDelegate, NSWindowDelegate {
    let fixture: Bool
    var identityReview: Bool { Bundle.main.object(forInfoDictionaryKey: "CCMacIdentityReview") as? Bool ?? false }
    var window: NSWindow!
    var store: EKEventStore?
    var calendars: [EKCalendar] = []
    var choices: [NSButton] = []
    var snapshots: [EventSnapshot] = []
    var previewRange: CalendarWindow?
    var previewCalendarCount = 0
    var previewExpiresAt: Date?
    var expiry: Timer?
    let status = NSTextField(wrappingLabelWithString: "No calendars or events have been read.")
    let calendarStack = NSStackView()
    let details = NSTextView()
    let startPicker = NSDatePicker()
    let endPicker = NSDatePicker()
    var showButton: NSButton!

    init(fixture: Bool) { self.fixture = fixture }
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 780, height: 690), styleMask: [.titled, .closable, .miniaturizable, .resizable], backing: .buffered, defer: false)
        window.title = fixture ? "Curated Chaos · Fictional Calendar Check" : "Curated Chaos · Local Calendar Preview"
        window.delegate = self; window.isRestorable = false
        let stack = NSStackView(); stack.orientation = .vertical; stack.alignment = .leading; stack.spacing = 12; stack.translatesAutoresizingMaskIntoConstraints = false
        window.contentView!.addSubview(stack)
        NSLayoutConstraint.activate([stack.leadingAnchor.constraint(equalTo: window.contentView!.leadingAnchor, constant: 24), stack.trailingAnchor.constraint(equalTo: window.contentView!.trailingAnchor, constant: -24), stack.topAnchor.constraint(equalTo: window.contentView!.topAnchor, constant: 24), stack.bottomAnchor.constraint(lessThanOrEqualTo: window.contentView!.bottomAnchor, constant: -20)])
        let title = NSTextField(labelWithString: fixture ? "Fictional calendar preview" : "Calendars synced to this Mac"); title.font = .boldSystemFont(ofSize: 24); stack.addArrangedSubview(title)
        let transferEnabled = Bundle.main.object(forInfoDictionaryKey: "CCMacBridgeFile") is String
        stack.addArrangedSubview(NSTextField(wrappingLabelWithString: identityReview ? "This review includes event/calendar identifiers and recurrence anchors to recognize repeat copies. Transfer is only to the app on this Mac for up to five minutes. This helper does not save to a database. Saving selected events in the app requires separate approval. No AI processing or calendar edits." : transferEnabled ? "Preview selected calendars first. Review in Daily Brief explicitly transfers this preview to the app on this Mac for up to five minutes. No database or AI service receives it; no calendar events are changed." : "Choose calendars and dates before previewing. This helper reads only; it cannot save, edit or delete events. It sends no event data to Curated Chaos, a database or an AI service."))
        stack.addArrangedSubview(NSTextField(wrappingLabelWithString: fixture ? "FICTIONAL MODE: no Calendar permission or real EventKit access." : "macOS requires Full Calendar Access to read events. The system permission includes editing capability, but this helper contains no event-editing operations. Calendar names are listed only after permission; events are read only after Preview."))
        let connect = NSButton(title: fixture ? "Load fictional calendars" : "Connect calendars on this Mac", target: self, action: #selector(connectCalendars)); stack.addArrangedSubview(connect)
        calendarStack.orientation = .vertical; calendarStack.alignment = .leading; calendarStack.spacing = 5
        let calendarScroll = NSScrollView(); calendarScroll.hasVerticalScroller = true; calendarScroll.documentView = calendarStack; calendarScroll.translatesAutoresizingMaskIntoConstraints = false
        stack.addArrangedSubview(calendarScroll); calendarScroll.heightAnchor.constraint(equalToConstant: 105).isActive = true; calendarScroll.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        calendarStack.translatesAutoresizingMaskIntoConstraints = false; calendarStack.widthAnchor.constraint(equalTo: calendarScroll.contentView.widthAnchor).isActive = true
        let dates = NSStackView(); dates.orientation = .horizontal; dates.spacing = 10
        for picker in [startPicker, endPicker] { picker.datePickerStyle = .textFieldAndStepper; picker.datePickerElements = .yearMonthDay; picker.target = self; picker.action = #selector(selectionChanged) }
        startPicker.dateValue = Calendar.current.startOfDay(for: Date()); endPicker.dateValue = Calendar.current.date(byAdding: .day, value: 30, to: startPicker.dateValue)!
        dates.addArrangedSubview(NSTextField(labelWithString: "From (included)")); dates.addArrangedSubview(startPicker); dates.addArrangedSubview(NSTextField(labelWithString: "To (excluded)")); dates.addArrangedSubview(endPicker); stack.addArrangedSubview(dates)
        stack.addArrangedSubview(NSTextField(wrappingLabelWithString: "Up to 5 selected calendars and 31 days. Time zone: \(TimeZone.current.identifier). This is a Mac calendar snapshot and may lag iCloud; no cloud refresh is requested by the helper."))
        let buttons = NSStackView(); buttons.orientation = .horizontal; buttons.spacing = 10
        buttons.addArrangedSubview(NSButton(title: "Preview selected dates", target: self, action: #selector(previewSelected)))
        showButton = NSButton(title: "Show event details", target: self, action: #selector(toggleDetails)); showButton.isEnabled = false; buttons.addArrangedSubview(showButton)
        buttons.addArrangedSubview(NSButton(title: "Clear preview", target: self, action: #selector(clearAll))); stack.addArrangedSubview(buttons)
        if Bundle.main.object(forInfoDictionaryKey: "CCMacBridgeFile") is String { let transfer = NSButton(title: "Review in Daily Brief", target: self, action: #selector(requestBridgeTransfer)); stack.addArrangedSubview(transfer) }
        status.setAccessibilityIdentifier("calendar-preview-status"); stack.addArrangedSubview(status)
        details.isEditable = false; details.isRichText = false; details.isAutomaticLinkDetectionEnabled = false; details.font = .systemFont(ofSize: 13)
        let detailScroll = NSScrollView(); detailScroll.hasVerticalScroller = true; detailScroll.documentView = details; detailScroll.translatesAutoresizingMaskIntoConstraints = false; stack.addArrangedSubview(detailScroll)
        detailScroll.heightAnchor.constraint(equalToConstant: 180).isActive = true; detailScroll.widthAnchor.constraint(equalTo: stack.widthAnchor).isActive = true
        window.center(); window.makeKeyAndOrderFront(nil); NSApp.activate(ignoringOtherApps: true)
    }
    @objc func connectCalendars() {
        clearAll()
        if fixture { populateChoices(["Fictional iCloud — Personal", "Fictional iCloud — Family"]); status.stringValue = "Two fictional calendars available. Select one before previewing."; armExpiry(); return }
        guard #available(macOS 14.0, *) else { status.stringValue = "This development helper requires macOS 14 or later. No calendars read."; return }
        let eventStore = EKEventStore(); store = eventStore
        if EKEventStore.authorizationStatus(for: .event) == .fullAccess { listCalendars(); return }
        status.stringValue = "Review the macOS Calendar permission prompt. No events have been read."
        eventStore.requestFullAccessToEvents { [weak self] granted, _ in
            DispatchQueue.main.async { guard let self = self else { return }; if granted { self.listCalendars() } else { self.clearAll(); self.status.stringValue = "Calendar access was not granted. No calendars or events read." } }
        }
    }
    func listCalendars() {
        guard let store = store, EKEventStore.authorizationStatus(for: .event) == .fullAccess else { clearAll(); return }
        let available = store.calendars(for: .event)
        guard available.count <= 100 else { clearAll(); status.stringValue = "Too many calendars for this bounded development preview. Nothing displayed."; return }
        calendars = available.sorted { ($0.source.title + $0.title).localizedCaseInsensitiveCompare($1.source.title + $1.title) == .orderedAscending }
        populateChoices(calendars.map { "\($0.source.title) — \($0.title)" })
        status.stringValue = "\(calendars.count) calendars available. Select the intended iCloud calendar; none is selected automatically."; armExpiry()
    }
    func populateChoices(_ names: [String]) {
        for view in calendarStack.arrangedSubviews { calendarStack.removeArrangedSubview(view); view.removeFromSuperview() }
        choices = names.enumerated().map { index, name in let button = NSButton(checkboxWithTitle: name, target: self, action: #selector(selectionChanged)); button.tag = index; calendarStack.addArrangedSubview(button); return button }
    }
    @objc func requestBridgeTransfer() { NotificationCenter.default.post(name: NSNotification.Name("CCExplicitMacTransfer"), object: self) }
    @objc func selectionChanged() { previewRange = nil; previewExpiresAt = nil; snapshots.removeAll(); details.string = ""; showButton.isEnabled = false; showButton.title = "Show event details"; status.stringValue = "Selection changed. Preview to read the selected window; nothing is saved." }
    @objc func previewSelected() {
        previewRange = nil; previewExpiresAt = nil; snapshots.removeAll(); details.string = ""; showButton.isEnabled = false; showButton.title = "Show event details"
        let selected = choices.enumerated().filter { $0.element.state == .on }.map { $0.offset }
        guard let range = try? CalendarWindow.make(start: startPicker.dateValue, end: endPicker.dateValue, selectedCount: selected.count) else { status.stringValue = "Choose 1–5 calendars and an increasing date window of 1–31 days."; return }
        if fixture {
            snapshots = [EventSnapshot(title: "Fictional appointment", start: range.start.addingTimeInterval(36000), end: range.start.addingTimeInterval(39600), allDay: false, calendarTitle: "Fictional Personal", calendarId: identityReview ? "fictional-calendar" : nil, eventId: identityReview ? "fictional-event" : nil)]
        } else {
            guard let store = store, EKEventStore.authorizationStatus(for: .event) == .fullAccess, selected.allSatisfy({ calendars.indices.contains($0) }) else { clearAll(); status.stringValue = "Calendar permission ended. Reconnect before previewing."; return }
            let selectedCalendars = selected.map { calendars[$0] }, allowed = Set(selectedCalendars.map { $0.calendarIdentifier })
            let matching = store.events(matching: store.predicateForEvents(withStart: range.start, end: range.end, calendars: selectedCalendars))
            guard matching.count <= 250 else { selectionChanged(); status.stringValue = "More than 250 events match. Choose fewer calendars or a shorter window; no partial result shown."; return }
            var result: [EventSnapshot] = []
            for event in matching {
                guard let eventCalendar = event.calendar, allowed.contains(eventCalendar.calendarIdentifier), let start = event.startDate, let end = event.endDate, end > start else { selectionChanged(); status.stringValue = "Event identity or dates could not be verified. No partial preview shown."; return }
                if identityReview && (event.eventIdentifier == nil || event.eventIdentifier.isEmpty || eventCalendar.calendarIdentifier.isEmpty) { selectionChanged(); status.stringValue = "Event identity could not be verified. Nothing transferred."; return }
                guard let span = try? CalendarWindow.eventSpan(start: start, end: end, allDay: event.isAllDay) else { selectionChanged(); status.stringValue = "Event dates could not be normalized. Nothing transferred."; return }
                if event.status == .canceled || span.start >= range.end || span.end <= range.start { continue }
                result.append(EventSnapshot(title: String((event.title ?? "Untitled event").prefix(300)), start: span.start, end: span.end, allDay: event.isAllDay, calendarTitle: eventCalendar.title, calendarId: identityReview ? eventCalendar.calendarIdentifier : nil, eventId: identityReview ? event.eventIdentifier : nil, occurrenceStart: identityReview ? event.occurrenceDate : nil))
            }
            guard EKEventStore.authorizationStatus(for: .event) == .fullAccess else { clearAll(); return }
            snapshots = result.sorted { $0.start < $1.start }
        }
        status.stringValue = "Preview ready: \(snapshots.count) events from \(selected.count) selected calendars. Details hidden. Nothing saved. Expires in five minutes."
        previewRange = range; previewCalendarCount = selected.count; previewExpiresAt = Date().addingTimeInterval(300)
        showButton.isEnabled = !snapshots.isEmpty; armExpiry()
    }
    @objc func toggleDetails() {
        guard !snapshots.isEmpty else { return }
        if !fixture && EKEventStore.authorizationStatus(for: .event) != .fullAccess { clearAll(); return }
        if !details.string.isEmpty { details.string = ""; showButton.title = "Show event details"; return }
        let formatter = DateFormatter(); formatter.dateStyle = .medium; formatter.timeStyle = .short; formatter.timeZone = .current
        details.string = snapshots.map { "\($0.title)\n\($0.calendarTitle) · \($0.allDay ? "All day · " : "")\(formatter.string(from: $0.start)) through \(formatter.string(from: $0.end)) (end excluded)" }.joined(separator: "\n\n")
        showButton.title = "Hide event details"
    }
    func armExpiry() { expiry?.invalidate(); expiry = Timer.scheduledTimer(withTimeInterval: 300, repeats: false) { [weak self] _ in self?.clearAll(); self?.status.stringValue = "Private calendar preview expired. Nothing was saved." } }
    @objc func clearAll() { previewRange = nil; previewExpiresAt = nil; expiry?.invalidate(); expiry = nil; snapshots.removeAll(); calendars.removeAll(); populateChoices([]); details.string = ""; showButton?.isEnabled = false; showButton?.title = "Show event details"; store?.reset(); store = nil; status.stringValue = "Preview cleared. No calendars or events retained in this view." }
    func applicationShouldSaveApplicationState(_ app: NSApplication) -> Bool { false }
    func applicationShouldRestoreApplicationState(_ app: NSApplication) -> Bool { false }
    func applicationDidBecomeActive(_ notification: Notification) { if !fixture && store != nil && EKEventStore.authorizationStatus(for: .event) != .fullAccess { clearAll() } }
    func windowDidResignKey(_ notification: Notification) { details.string = ""; showButton?.title = "Show event details" }
    func windowWillClose(_ notification: Notification) { clearAll(); NSApp.terminate(nil) }
    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}

func selfTest() -> Bool {
    var calendar = Calendar(identifier: .gregorian); calendar.timeZone = TimeZone(identifier: "America/New_York")!
    let start = calendar.date(from: DateComponents(year: 2026, month: 3, day: 8))!, next = calendar.date(byAdding: .day, value: 1, to: start)!
    guard let range = try? CalendarWindow.make(start: start, end: next, selectedCount: 1, calendar: calendar), range.end.timeIntervalSince(range.start) == 23 * 3600 else { return false }
    for (end, count) in [(next, 0), (next, 6), (start, 1), (calendar.date(byAdding: .day, value: 32, to: start)!, 1)] {
        if (try? CalendarWindow.make(start: start, end: end, selectedCount: count, calendar: calendar)) != nil { return false }
    }
    for day in [DateComponents(year: 2026, month: 3, day: 8), DateComponents(year: 2026, month: 11, day: 1)] {
        let first = calendar.date(from: day)!, last = calendar.date(byAdding: .day, value: 1, to: first)!
        for finish in [last, last.addingTimeInterval(-1)] {
            guard let span = try? CalendarWindow.eventSpan(start: first, end: finish, allDay: true, calendar: calendar), span.start == first, span.end == last else { return false }
        }
        let timedStart = first.addingTimeInterval(36000), timedEnd = timedStart.addingTimeInterval(3600)
        guard let timed = try? CalendarWindow.eventSpan(start: timedStart, end: timedEnd, allDay: false, calendar: calendar), timed.start == timedStart, timed.end == timedEnd else { return false }
    }
    return true
}
if CommandLine.arguments.contains("--self-test") { print(selfTest() ? "PASS: fictional calendar window checks; no EventKit access." : "FAIL: calendar window checks."); exit(selfTest() ? 0 : 1) }
if CommandLine.arguments.contains("--plan") { print("PLAN ONLY: local read-only calendar preview; no Calendar permission requested, calendars read, files written, network calls or database operations."); exit(0) }
let fixtureMode = Bundle.main.object(forInfoDictionaryKey: "CCFictionalFixtureMode") as? Bool ?? false
let app = NSApplication.shared
let controller = PreviewController(fixture: fixtureMode)
app.delegate = controller
app.run()
