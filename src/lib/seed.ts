export const POLICY_V1 = `# Global Travel and Expense Policy
Effective 1 April 2026. Applies to all employees of Meridian Systems India Private Limited.

## 1. Scope and principle
Spend company money as carefully as you would spend your own. Where this policy is silent,
ask before you spend, not after. Reimbursement is not automatic.

## 2. Approval before travel
2.1 Any trip involving an overnight stay or an air ticket requires a written trip approval
    from the employee's manager before booking.
2.2 Spend that falls outside the dates of an approved trip is treated as ordinary local
    spend and is subject to the local spend limits in section 5.

## 3. Air travel
3.1 Economy class is the standard for all flights of six hours or less.
3.2 Premium economy is permitted for flights over six hours.
3.3 Business class requires prior written approval from a Vice President or above,
    regardless of flight duration or fare.
3.4 Tickets must be booked at least seven days before departure unless the trip was
    approved within that window. A ticket booked inside the window without that
    exception is reimbursable only up to the lowest fare that was available seven
    days out; the difference is borne by the employee.

## 4. Accommodation
4.1 Nightly room rate caps, excluding taxes:
    Mumbai, Delhi NCR, Bengaluru: INR 9,000
    All other Indian cities: INR 6,500
    Singapore, Dubai, London, New York, San Francisco: INR 22,000
    All other international: INR 16,000
4.2 Where the rate exceeds the cap because of a company-sponsored event at that venue,
    the excess is allowed if the event is named on the expense.
4.3 In-room minibar, laundry under two nights, movies and spa are not reimbursable.

## 5. Meals
5.1 Daily meal cap while travelling: INR 2,500 per person per day in India,
    INR 5,000 per person per day internationally.
5.2 Local meals on an ordinary working day are not reimbursable unless the meal is a
    client meal or a team meal that meets section 6.
5.3 Tips above 15 percent of the bill are not reimbursable.

## 6. Client and team meals
6.1 A client meal requires the names and companies of all attendees on the expense.
6.2 A team meal requires a stated business purpose and at least three attendees.
6.3 Team meal cap: INR 1,500 per attendee.

## 7. Alcohol
7.1 Alcohol is reimbursable only as part of a client meal that complies with section 6.
7.2 Alcohol on a solo or team meal is not reimbursable at any amount.
7.3 Where a bill mixes alcohol with food, only the food portion is reimbursable unless
    section 7.1 applies.

## 8. Ground transport
8.1 Cabs between home and office are reimbursable only after 22:00 or before 06:00.
8.2 Cabs during an approved trip are reimbursable without a time restriction.
8.3 Rental cars require prior approval. Insurance is reimbursable, fuel upgrades are not.

## 9. Receipts and evidence
9.1 An itemised receipt is required for any single expense of INR 2,000 or more.
9.2 Below INR 2,000, a card record alone is sufficient.
9.3 A missing receipt above INR 2,000 may be self-certified once per quarter per employee,
    up to INR 5,000, with a written explanation.
9.4 Reimbursement claims that have no corresponding card or bank record require an itemised
    receipt regardless of amount.

## 10. Prohibited spend
10.1 Personal entertainment, gifts to government officials, traffic fines, personal
     grooming, and any spend for a family member accompanying the employee.
10.2 Splitting a single purchase across multiple charges to stay under an approval limit
     is a policy violation independent of whether the underlying spend was allowable.

## 11. Currency and tax
11.1 Foreign currency is converted at the card network rate on the settlement date.
11.2 Where GST is charged and the vendor's GSTIN appears on the receipt, the input tax
     is recorded separately and claimed by the company.

## 12. Enforcement
12.1 A first violation is a written note to the employee and their manager.
12.2 Deliberate misrepresentation of an expense is a disciplinary matter and is escalated
     to the Corporate Controller regardless of amount.`;

export const GL_ACCOUNTS = [
  ["6100", "Travel - Airfare", "expense", "Air tickets and airline fees"],
  ["6110", "Travel - Accommodation", "expense", "Hotel room charges, excluding taxes"],
  ["6120", "Travel - Ground Transport", "expense", "Cabs, rail, rental cars, parking, tolls"],
  ["6130", "Travel - Meals (Individual)", "expense", "Meals taken by the employee while travelling"],
  ["6140", "Entertainment - Client", "expense", "Client meals and client entertainment"],
  ["6150", "Employee Welfare - Team Meals", "expense", "Internal team meals and offsites"],
  ["6160", "Conferences and Events", "expense", "Registration fees, booth costs, event tickets"],
  ["6170", "Communications - Roaming", "expense", "Mobile roaming and in-flight connectivity"],
  ["6900", "Disallowed Expense - Employee Recoverable", "asset", "Amounts to be recovered from the employee"],
  ["1310", "Input Tax Credit - GST", "tax", "Recoverable GST where the vendor GSTIN is present"],
  ["2110", "Corporate Card Liability", "liability", "Amounts owed to the card issuer"],
  ["2120", "Employee Payables - Reimbursements", "liability", "Amounts owed to employees"],
];

export const COST_CENTERS = [
  ["CC-ENG", "Engineering"],
  ["CC-SAL", "Sales"],
  ["CC-MKT", "Marketing"],
  ["CC-FIN", "Finance"],
  ["CC-CS", "Customer Success"],
  ["CC-EVT", "Events and Field Marketing"],
];

export const EMPLOYEES = [
  ["E-1001", "Ananya Rao", "ananya.rao@meridiansys.com", "M4 Senior Manager", "Sales", "CC-SAL", "Vikram Shah", "2021-06-14"],
  ["E-1002", "Rohit Menon", "rohit.menon@meridiansys.com", "M3 Manager", "Engineering", "CC-ENG", "Priya Nair", "2022-02-01"],
  ["E-1003", "Sneha Kulkarni", "sneha.kulkarni@meridiansys.com", "IC5 Staff Engineer", "Engineering", "CC-ENG", "Priya Nair", "2020-11-09"],
  ["E-1004", "Imran Qureshi", "imran.qureshi@meridiansys.com", "VP", "Sales", "CC-SAL", "Vikram Shah", "2019-03-25"],
  ["E-1005", "Divya Pillai", "divya.pillai@meridiansys.com", "IC3 Marketing Associate", "Marketing", "CC-MKT", "Nikhil Bose", "2024-08-19"],
  ["E-1006", "Arjun Sethi", "arjun.sethi@meridiansys.com", "M3 Manager", "Customer Success", "CC-CS", "Meera Iyer", "2023-01-16"],
];

export const TRIPS = [
  ["T-501", "E-1001", "Customer QBR with Larsen Retail", "Bengaluru", "Mumbai", "2026-08-03", "2026-08-06", "Vikram Shah", 95000],
  ["T-502", "E-1003", "Platform architecture summit", "Bengaluru", "Singapore", "2026-08-10", "2026-08-14", "Priya Nair", 240000],
  ["T-503", "E-1004", "Regional pipeline review", "Bengaluru", "Dubai", "2026-08-11", "2026-08-15", "Vikram Shah", 310000],
  ["T-504", "E-1005", "SaaSExpo India booth staffing", "Bengaluru", "Delhi NCR", "2026-08-17", "2026-08-19", "Nikhil Bose", 70000],
];

export const CALENDAR = [
  ["C-9001", "E-1001", "QBR - Larsen Retail leadership", "2026-08-04T10:00:00Z", "2026-08-04T13:00:00Z", "Mumbai, BKC", 7],
  ["C-9002", "E-1001", "Dinner with Larsen procurement team", "2026-08-04T14:30:00Z", "2026-08-04T17:00:00Z", "Mumbai, Lower Parel", 5],
  ["C-9003", "E-1003", "Summit day one - keynote and sessions", "2026-08-11T01:30:00Z", "2026-08-11T11:00:00Z", "Singapore, Marina Bay", 200],
  ["C-9004", "E-1002", "Engineering all-hands", "2026-08-12T05:00:00Z", "2026-08-12T06:30:00Z", "Bengaluru, HQ", 40],
  ["C-9005", "E-1004", "Regional pipeline review day one", "2026-08-12T05:00:00Z", "2026-08-12T12:00:00Z", "Dubai, DIFC", 12],
  ["C-9006", "E-1005", "SaaSExpo booth setup", "2026-08-17T04:00:00Z", "2026-08-17T10:00:00Z", "Delhi NCR, Aerocity", 6],
  ["C-9007", "E-1006", "Renewal workshop - Anand Foods", "2026-08-13T06:00:00Z", "2026-08-13T09:00:00Z", "Bengaluru, client site", 9],
];

// raw_text is what the extractor would have read. Kept as text so the panel can edit it.
export { spendDateFrom } from "./dates";

/* The date on the document, which is what the charge is matched against. Filtering
   on when the row arrived meant a receipt uploaded late, or a corpus seeded after
   the fact, fell outside the window and simply did not match. */
export const RECEIPTS: [string, string, string, string][] = [
  ["R-2001", "E-1001", "email",
    "TAJ LANDS END, MUMBAI\nGSTIN 27AAACT1234F1ZV\nFolio 88213 | Ananya Rao\nCheck-in 03 Aug 2026, Check-out 06 Aug 2026\nRoom (3 nights @ INR 8,600)   25,800.00\nCGST 9%                        2,322.00\nSGST 9%                        2,322.00\nTOTAL                         30,444.00\nPaid by card ending 4417"],
  ["R-2002", "E-1001", "email",
    "THE TABLE, LOWER PAREL, MUMBAI\nGSTIN 27AACCT9911K1Z8\n04 Aug 2026 20:41 | Table 12 | Covers 5\n2 x Burrata                     1,780.00\n3 x Main course                 4,350.00\n1 x Bottle Sula Chenin           2,400.00\n2 x Sparkling water                240.00\nSubtotal                        8,770.00\nCGST 2.5% / SGST 2.5%             438.50\nService charge 10%                877.00\nTOTAL                          10,085.50"],
  ["R-2003", "E-1003", "email",
    "SINGAPORE AIRLINES\nE-ticket 618-4471029934\nSneha Kulkarni\nBLR-SIN 10 Aug 2026 SQ 509 Economy\nSIN-BLR 14 Aug 2026 SQ 508 Economy\nFare SGD 612.00 | Taxes SGD 88.40\nTOTAL SGD 700.40"],
  ["R-2004", "E-1003", "email",
    "PAN PACIFIC SINGAPORE\nGuest: S KULKARNI | Room 2214\n10 Aug - 14 Aug 2026, 4 nights\nRoom rate SGD 310.00 per night   1,240.00\nGST 9%                             111.60\nMinibar                             46.00\nTOTAL SGD                        1,397.60"],
  ["R-2005", "E-1004", "upload",
    "EMIRATES\nBooking ref QK4T2M\nImran Qureshi\nBLR-DXB 11 Aug 2026 EK 569 BUSINESS\nDXB-BLR 15 Aug 2026 EK 568 BUSINESS\nFare AED 6,240.00 | Taxes AED 410.00\nTOTAL AED 6,650.00"],
  ["R-2006", "E-1005", "email",
    "UBER INDIA\nTrip 17 Aug 2026 09:41\nAerocity to Pragati Maidan\nFare INR 412.00 | Toll 65.00\nTOTAL INR 477.00"],
  ["R-2007", "E-1002", "upload",
    "TOIT BREWPUB, INDIRANAGAR BENGALURU\n12 Aug 2026 21:15\n6 x Craft beer                   2,940.00\n3 x Platters                     2,610.00\nSubtotal                         5,550.00\nGST                                277.50\nTOTAL                            5,827.50\nCovers: 6"],
  ["R-2008", "E-1006", "upload",
    "GRAND MERIDIEN BANQUETS\n13 Aug 2026\nCorporate lunch package\nAmount 18,000.00\nTOTAL INR 18,000.00\nThank you for your business"],
  ["R-2009", "E-1001", "email",
    "MUMBAI AIRPORT DUTY FREE\n06 Aug 2026\n1 x Glenfiddich 15YR            6,800.00\nTOTAL INR 6,800.00"],
  ["R-2010", "E-1005", "email",
    "HOTEL ROSEATE, AEROCITY DELHI\nGSTIN 07AAECR4455L1ZQ\n17 Aug - 19 Aug 2026, 2 nights\nRoom @ INR 11,400 per night     22,800.00\nCGST 6% / SGST 6%                2,736.00\nTOTAL                           25,536.00\nSaaSExpo India 2026 delegate rate"],
];

// [id, employee, merchant, mcc, amount, currency, amount_inr, date, time, card, source, memo, scenario]
// The scenario line says why the charge is in the corpus. It is shown in the console
// so the queue reads as a set of test cases rather than eighteen unexplained rows.
export const TRANSACTIONS: any[][] = [
  ["X-3001", "E-1001", "Taj Lands End Mumbai", "7011", 30444.0, "INR", 30444.0, "2026-08-06", "11:04", "4417", "card_feed", null, "Clean. Hotel inside the Mumbai cap, receipt matches the charge, inside an approved trip."],
  ["X-3002", "E-1001", "The Table Lower Parel", "5812", 10085.5, "INR", 10085.5, "2026-08-04", "22:58", "4417", "card_feed", null, "Client dinner including wine. Clause 7.1 allows it only if the attendees are named."],
  ["X-3003", "E-1003", "Singapore Airlines", "3067", 700.4, "SGD", 45526.0, "2026-08-02", "16:22", "9182", "card_feed", null, "Economy flight booked eight days out for an approved trip."],
  ["X-3004", "E-1003", "Pan Pacific Singapore", "7011", 1397.6, "SGD", 90844.0, "2026-08-14", "04:10", "9182", "card_feed", null, "Room rate is inside the cap but the folio carries a minibar line, which 4.3 disallows. The right answer is a partial allowance."],
  ["X-3005", "E-1004", "Emirates", "3040", 6650.0, "AED", 152950.0, "2026-08-05", "09:30", "7731", "card_feed", null, "Business class. Clause 3.3 needs written VP approval and none is on file. Grade alone does not satisfy it."],
  ["X-3006", "E-1005", "Uber India", "4121", 477.0, "INR", 477.0, "2026-08-17", "09:52", "5590", "card_feed", null, "Under the receipt threshold. The card record alone should be enough under 9.2."],
  ["X-3007", "E-1002", "Toit Brewpub", "5813", 5827.5, "INR", 5827.5, "2026-08-12", "21:40", "3306", "card_feed", "Team dinner after all-hands", "Team dinner with six beers on the bill. Clause 7.2 disallows alcohol on a team meal at any amount."],
  ["X-3008", "E-1006", "Grand Meridien Banquets", "5812", 18000.0, "INR", 18000.0, "2026-08-13", "15:20", "6644", "employee_claim", "Client workshop lunch", "Reimbursement claim with no card or bank record anywhere. The receipt is the only evidence the spend happened."],
  ["X-3009", "E-1001", "Mumbai Airport Duty Free", "5921", 6800.0, "INR", 6800.0, "2026-08-06", "13:15", "4417", "card_feed", null, "Spirits bought at the airport on the way home. Not part of any meal."],
  ["X-3010", "E-1005", "Hotel Roseate Aerocity", "7011", 25536.0, "INR", 25536.0, "2026-08-19", "06:40", "5590", "card_feed", null, "Over the Delhi cap, but at a named sponsored event, which 4.2 exempts."],
  ["X-3011", "E-1002", "Blue Tokai Coffee", "5814", 480.0, "INR", 480.0, "2026-08-18", "10:12", "3306", "card_feed", null, "Small local coffee on an ordinary working day."],
  ["X-3012", "E-1002", "Rapido", "4121", 1800.0, "INR", 1800.0, "2026-08-18", "19:05", "3306", "card_feed", "Office to home", "Cab home at 19:05. Clause 8.1 permits home cabs only after 22:00 or before 06:00."],
  ["X-3013", "E-1004", "Zuma Dubai", "5812", 2450.0, "AED", 56350.0, "2026-08-13", "22:30", "7731", "card_feed", "Dinner with Al Futtaim team", "Client dinner abroad. No attendee names on the charge, which 6.1 requires."],
  ["X-3014", "E-1006", "Amazon Business", "5942", 9400.0, "INR", 9400.0, "2026-08-15", "12:00", "6644", "card_feed", "Workshop supplies", "First of two identical charges a day apart at the same vendor."],
  ["X-3015", "E-1006", "Amazon Business", "5942", 9400.0, "INR", 9400.0, "2026-08-16", "12:41", "6644", "card_feed", "Workshop supplies", "Second of the pair. Near-duplicate, and only visible by looking across charges."],
  ["X-3016", "E-1005", "Pixel Print Studio", "2741", 8000.0, "INR", 8000.0, "2026-08-18", "14:20", "5590", "card_feed", "Booth collateral", "First of two identical charges ninety minutes apart at one vendor."],
  ["X-3017", "E-1005", "Pixel Print Studio", "2741", 8000.0, "INR", 8000.0, "2026-08-18", "16:05", "5590", "card_feed", "Booth collateral", "Second of the pair. Clause 10.2 makes splitting a violation in itself, whatever the spend was for."],
  ["X-3018", "E-1003", "Grab Singapore", "4121", 62.4, "SGD", 4056.0, "2026-08-12", "13:30", "9182", "card_feed", null, "Small ground transport during an approved trip."],
];

export const RECEIPT_LINKS: Record<string, string> = {
  "R-2001": "X-3001", "R-2002": "X-3002", "R-2003": "X-3003", "R-2004": "X-3004",
  "R-2005": "X-3005", "R-2006": "X-3006", "R-2007": "X-3007", "R-2008": "X-3008",
  "R-2009": "X-3009", "R-2010": "X-3010",
};

// Golden set. Expected verdicts are a human's, written against POLICY_V1.
export const EVAL_CASES: [string, any, string, string][] = [
  ["Economy flight inside approved trip", { merchant: "IndiGo", amount_inr: 8400, txn_date: "2026-08-03", grade: "M3 Manager", receipt: "INDIGO 6E-234 BLR-BOM 03 Aug 2026 Economy INR 8,400" }, "APPROVE", "Clean, in policy, well evidenced"],
  ["Hotel INR 400 over the metro cap", { merchant: "ITC Grand Central Mumbai", amount_inr: 9400, txn_date: "2026-08-04", grade: "M3 Manager", receipt: "ITC GRAND CENTRAL 1 night room INR 9,400" }, "PARTIAL", "Clause 4.1 caps Mumbai at 9,000. Allow to the cap, disallow the 400."],
  ["Business class, VP grade, no written approval on file", { merchant: "Emirates", amount_inr: 152950, txn_date: "2026-08-05", grade: "VP", receipt: "EMIRATES BLR-DXB BUSINESS AED 6,650" }, "ESCALATE", "3.3 needs written VP approval; grade alone does not satisfy it"],
  ["Solo dinner with wine while travelling", { merchant: "Olive Bar", amount_inr: 3100, txn_date: "2026-08-04", grade: "M4 Senior Manager", receipt: "1 x Main 1,400, 1 x Glass red wine 900, dessert 500, taxes 300. Covers 1" }, "REJECT", "7.2 alcohol on a solo meal"],
  ["Client dinner with wine, attendees named", { merchant: "The Table", amount_inr: 10085, txn_date: "2026-08-04", grade: "M4 Senior Manager", receipt: "Covers 5. Attendees: R Deshpande (Larsen Retail), S Menon (Larsen Retail), A Rao, K Iyer, P Joshi. Includes 1 bottle wine 2,400" }, "APPROVE", "7.1 permits alcohol on a compliant client meal"],
  ["Cab home at 19:05 on an ordinary day", { merchant: "Rapido", amount_inr: 1800, txn_date: "2026-08-18", grade: "M3 Manager", receipt: "Office to home 19:05" }, "REJECT", "8.1 only after 22:00 or before 06:00"],
  ["Cab home at 23:40 on an ordinary day", { merchant: "Uber", amount_inr: 700, txn_date: "2026-08-18", grade: "M3 Manager", receipt: "Office to home 23:40" }, "APPROVE", "8.1 satisfied"],
  ["Sub-threshold spend with no receipt", { merchant: "Mumbai Airport Parking", amount_inr: 480, txn_date: "2026-08-04", grade: "M3 Manager", memo: "Airport parking, client trip", receipt: null }, "APPROVE", "9.2 card record alone is sufficient below 2,000. Ground transport, so 5.2 does not bite."],
  ["Above threshold with no receipt at all", { merchant: "Hotel Sahara Star", amount_inr: 4200, txn_date: "2026-08-04", grade: "M3 Manager", memo: "One night, client trip, receipt lost", receipt: null }, "ESCALATE", "9.3 allows self-certification once a quarter up to 5,000, but the quarterly allowance cannot be checked from this record alone."],
  ["Team dinner, 6 attendees, beer on the bill", { merchant: "Toit Brewpub", amount_inr: 5827, txn_date: "2026-08-12", grade: "M3 Manager", receipt: "6 craft beer 2,940; 3 platters 2,610; GST 277.50; Covers 6" }, "REJECT", "7.2 disallows alcohol on a team meal; only the food portion could stand"],
  ["Team lunch, 4 attendees, INR 1,200 a head", { merchant: "Punjab Grill", amount_inr: 4800, txn_date: "2026-08-12", grade: "M3 Manager", receipt: "Team lunch, sprint close. Covers 4. No alcohol." }, "APPROVE", "6.2 and 6.3 satisfied"],
  ["Team lunch, 4 attendees, INR 1,900 a head", { merchant: "Farzi Cafe", amount_inr: 7600, txn_date: "2026-08-12", grade: "M3 Manager", receipt: "Team lunch. Covers 4. No alcohol." }, "PARTIAL", "6.3 caps at 1,500 a head. Allow 6,000, disallow 1,600."],
  ["Hotel over cap at a named sponsored event", { merchant: "Hotel Roseate Aerocity", amount_inr: 25536, txn_date: "2026-08-19", grade: "IC3 Marketing Associate", receipt: "2 nights @ 11,400. SaaSExpo India 2026 delegate rate" }, "APPROVE", "4.2 exception applies, the event is named"],
  ["Duty free whisky on the way home", { merchant: "Mumbai Airport Duty Free", amount_inr: 6800, txn_date: "2026-08-06", grade: "M4 Senior Manager", receipt: "1 x Glenfiddich 15YR 6,800" }, "REJECT", "7.2, and it is not part of any meal"],
  ["Minibar inside a hotel folio", { merchant: "Pan Pacific Singapore", amount_inr: 90844, txn_date: "2026-08-14", grade: "IC5 Staff Engineer", receipt: "4 nights SGD 310 per night, GST 111.60, Minibar 46.00" }, "PARTIAL", "Room rate is inside the Singapore cap, 4.3 disallows the minibar. Allow the stay, disallow the minibar."],
  ["Traffic fine", { merchant: "Bengaluru Traffic Police", amount_inr: 1000, txn_date: "2026-08-11", grade: "M3 Manager", receipt: "Challan 4471, no helmet" }, "REJECT", "10.1 prohibited"],
  ["Two identical charges at one merchant on one day", { merchant: "Pixel Print Studio", amount_inr: 8000, txn_date: "2026-08-18", grade: "IC3 Marketing Associate", receipt: "Booth collateral, invoice 2 of 2" }, "ESCALATE", "10.2 splitting is a violation in itself and needs a human call on intent"],
  ["Roaming pack during an approved trip", { merchant: "Airtel", amount_inr: 2999, txn_date: "2026-08-11", grade: "IC5 Staff Engineer", receipt: "International roaming pack 10 days" }, "ESCALATE", "Policy is silent on roaming; correct behaviour is to say so rather than invent a rule"],
  ["Spouse ticket on the same booking", { merchant: "IndiGo", amount_inr: 16800, txn_date: "2026-08-03", grade: "M4 Senior Manager", memo: "Booked my wife on the same flight", receipt: "6E-234 BLR-BOM. Passengers: A Rao (employee), M Rao (spouse, non-employee)" }, "REJECT", "10.1 family member spend, stated on the booking rather than inferred from a shared surname"],
  ["Rental car with an insurance line", { merchant: "Zoomcar", amount_inr: 6400, txn_date: "2026-08-12", grade: "M3 Manager", receipt: "2 day rental 5,200, insurance 1,200. Prior approval reference AP-8823" }, "APPROVE", "8.3 satisfied, insurance is reimbursable"],
  ["Rental car with a fuel upgrade line", { merchant: "Avis", amount_inr: 7300, txn_date: "2026-08-12", grade: "M3 Manager", receipt: "2 day rental 5,200, premium fuel upgrade 2,100. Approval AP-8824" }, "PARTIAL", "8.3 allows the rental and disallows the fuel upgrade. Allow 5,200, disallow 2,100."],
  ["Tip at 22 percent of the bill", { merchant: "Indian Accent", amount_inr: 6100, txn_date: "2026-08-04", grade: "M4 Senior Manager", receipt: "Food 5,000, tip 1,100. Client meal, attendees named: 3 from Larsen Retail" }, "PARTIAL", "5.3 caps the tip at 15 percent. Allow 5,750, disallow 350."],
  ["Flight booked two days out for a trip approved a month earlier", { merchant: "Air India", amount_inr: 19400, txn_date: "2026-08-09", grade: "IC5 Staff Engineer", receipt: "AI-503 BLR-SIN dep 11 Aug 2026. Booked 09 Aug 2026. Trip approved 08 Jul 2026. Lowest fare seven days out was INR 12,800." }, "PARTIAL", "3.4 caps reimbursement at the fare available seven days out. Allow 12,800, disallow 6,600."],
  ["Client meal with no attendee names", { merchant: "Smoke House Deli", amount_inr: 4400, txn_date: "2026-08-04", grade: "M4 Senior Manager", memo: "Lunch with the Larsen Retail account team", receipt: "Covers 4. Client entertainment." }, "ESCALATE", "6.1 requires the names and companies of all attendees. Stated as a client meal, so 6.2 does not rescue it."],
];
