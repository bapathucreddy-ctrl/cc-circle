# Service verification

Payment remains after acceptance and before the journey/service.

1. The professional starts the journey and marks arrival.
2. The customer opens the booking to see a six-digit **start service OTP**. The professional enters it in their app to start the service.
3. While work is in progress, the professional remains busy. Journey location sharing stops at the verified service start.
4. The professional taps **Complete service**, which requests completion without marking the booking done.
5. The customer now sees a separate **end service OTP**. They share it after confirming that the work is finished.
6. The professional verifies the end OTP. The booking becomes completed, payout can be queued, availability is released according to their online setting, and the customer can leave a rating/review.

Codes last ten minutes. Five incorrect attempts lock that code until its expiry. Refreshing a valid code keeps the same code and attempt count; an expired code is replaced. A customer cannot retrieve the end code before completion is requested, and a professional cannot retrieve either code. Failed verification returns a normal JSON result so the attempt counter commits.

Migration `202610150006_service_otps.sql` adds timestamps without changing booking status enums. In-progress and completion-pending services retain `arrived` status, preserving overlap/overrun protection. Direct `transition_booking(...,'completed')` calls are blocked; only successful end verification can invoke the private transition. Codes are stored in an inaccessible private table and removed after use, never included in booking rows/messages. Database administrators can inspect this table; these service codes are customer confirmations, not sign-in credentials.

Existing completed bookings remain completed. Existing arrived bookings require a start code before requesting completion. An unavailable customer or repeated lockout leaves the service active; manual support/dispute resolution is a separate operation and is not exposed as a completion bypass.

Backend tests cover participant isolation, forbidden direct/private completion, phase ordering, invalid/expired codes, lockout persistence, code renewal, payout gating, review gating, location shutdown and availability through both phases. Physical-device testing with two signed-in participants is still required.
