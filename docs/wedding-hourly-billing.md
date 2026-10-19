# Wedding hourly billing

New team requests offer **Wedding · hourly billing** or **Other event · fixed price**. Existing events and bookings retain fixed pricing; event names alone never change an agreed price.

Wedding customers choose their professionals without fixing a total budget. Each professional applies with a net hourly rate. The customer sees the service hourly rate including commission, and agrees that rate when accepting. Rates are snapshotted for that booking. Planned coverage (1–24 hours) reserves availability; it does not set the final bill.

The professional can start the journey without prepayment. The customer's verified start OTP records `service_started_at` on the server. Complete service requests the end OTP; verified end OTP records `service_ended_at` and finalizes the invoice atomically.

Billable hours are the elapsed server time divided by 3600 seconds, rounded up to whole hours, with a minimum of one. Exactly two hours bills two; two hours and one second bills three. Two hours ten minutes therefore bills three hours. Waiting for the end OTP remains part of elapsed service time until verification.

Each professional has a separate invoice:

- Service subtotal = agreed customer service hourly rate × billable hours.
- Professional earnings = agreed net hourly rate × billable hours.
- The existing booking fee is added once to the customer invoice, using the existing fee formula and cap. It is shown separately.

Example: net rate ₹1,500/hour produces a customer service rate of ₹1,630/hour under existing commission. At 2h10m, service subtotal is ₹4,890, booking fee ₹147, final customer amount ₹5,037, and professional earnings ₹4,500.

Hourly payment is blocked until the end OTP finalizes the invoice, both by `cashfree-order` and a database payment-order trigger. Finalized money, rates and service timestamps cannot change. Completion alone does not queue payout: verified payment queues exactly one payout using the final professional amount. The customer invoice reminder stays visible until payment; review follows settlement. Professionals see only their own net amounts in the UI.

The existing paid-only chat rule remains: hourly bookings do not open chat before payment, and completed services do not reopen messaging. Journey tracking, participant names, OTPs and service controls remain available without prepayment for hourly weddings.

Migration: `202610160008_wedding_hourly_billing.sql`. Deploy with the updated `cashfree-order` function. Other bookings still require payment before travel/service. All payments remain in the existing Cashfree sandbox configuration. Device verification and a real sandbox checkout of a wedding invoice remain manual checks; automated tests use the database and mocked UI requests.
