# Artist House Professional 0.2.3

Professional release, version code 25, package `com.cccircle.professional`.

Payouts now shows when a pending transfer becomes eligible: 24 hours after both verified payment and service completion. Professionals can connect or update their bank account and see its masked ending and IFSC. Submitted transfers keep their original beneficiary; future submissions use the updated account. Details are registered with Cashfree server-side and the full bank account number is not stored in application tables.

The server migration, beneficiary worker, payout worker and minute schedule are deployed. Cashfree remains in sandbox. No production bank transfer or physical-device installation was tested.

The APK retains the existing release certificate, package name, authentication storage and OAuth scheme. Install over the existing Professional app without uninstalling.

Includes the offline crafts splash, optional Instagram connection at professional registration and questionnaire placeholders from 0.2.2.

Validation: TypeScript and 173 mobile tests pass. Release verification checks the original certificate, package/version, production bundle, native map libraries, 16 KB alignment and the new bank-edit/payout UI markers.
