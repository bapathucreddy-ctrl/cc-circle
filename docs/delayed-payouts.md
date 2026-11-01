# Payments and next-day professional payouts

Customer payments remain processed and verified through Cashfree. A professional payout becomes eligible **24 hours after both service completion and verified payment**. The later event starts the delay. For example, completion on Monday at 4 pm with payment already verified makes the payout eligible Tuesday at 4 pm. A later invoice payment starts its own 24-hour delay. Arrival or a professional accepting a booking does not release payment.

`payout_jobs.available_at` records eligibility separately from retry timing. The server worker checks both timestamps and reconfirms completion, verified payment, environment, amount and Cashfree beneficiary verification. A minute scheduler dispatches due jobs. Eligibility is a transfer-initiation target; provider/bank processing and available funds affect actual receipt.

Professionals can connect or update their bank account from Payouts. Account-holder name, bank account number and IFSC are sent server-side to Cashfree. Artist House stores the beneficiary ID, last four digits and IFSC, not the full account number. A deterministic account-specific beneficiary supports safe retries. Compare-and-set saving rejects simultaneous conflicting edits. Transfers whose destination has already been frozen continue to that beneficiary; future submissions use the updated account. Failed transfers are not automatically reissued with a new transfer ID.

Migration: `202611010001_delayed_payouts.sql`. Deploy schema before `cashfree-beneficiary` and `cashfree-payouts`. The scheduler uses `private.dispatch_cashfree_payouts()` and encrypted Vault secret `artist_house_payout_worker_secret`, matched to Edge secret `CASHFREE_WORKER_SECRET`. Never place provider keys or worker secrets in the mobile bundle.

Existing pending jobs with no frozen beneficiary get the 24-hour eligibility boundary from the recorded timestamps. Previously submitted/processing jobs retain their existing timing and transfer identity. Deployment does not submit new bank-account registrations or manually send payouts.

Cashfree Payment Gateway settlement and Cashfree Payouts funding are separate. Live operations require activated production PG and Payouts credentials, verified beneficiaries, a supported funding/settlement arrangement and sufficient payout balance. The deployed environment remains **sandbox**. No production-money transfer or real bank-account update was tested.

The bank-edit controls and eligibility date are source updates that require a new Professional APK. Version 0.2.2 predates these UI changes.
