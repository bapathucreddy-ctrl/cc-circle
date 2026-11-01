# Circle landing page custom domain

Current domain: `artisthouse.cclabs.space`. Registrar/DNS provider: GoDaddy.

The new domain and HTTPS were verified active on 1 November 2026. Public URL: https://artisthouse.cclabs.space. The previous `circle.cclabs.space` remains attached as a compatibility address.

Sites confirmed the custom domain and HTTPS as **active** on 30 October 2026. Public URL: https://circle.cclabs.space.

The user authorized public access to the marketing landing page. The admin app and Supabase account permissions are not changed.

Add these records in the `cclabs.space` DNS zone:

| Type | Name | Value |
| --- | --- | --- |
| CNAME | circle | custom-domains.chatgpt.site |
| TXT | _openai-site-verification.circle | openai-site-verification=RY9QrRq0QYenCbVBOsuwOYCmwCcAygT3WgFbCx0wfnQ |
| TXT | _cf-custom-hostname.circle | 8d528cdc-425f-4e04-9d16-f8f6c2986263 |

Use the default TTL. Do not alter the apex/root, `www`, MX, SPF, DKIM or other email records. If the `circle` hostname already has a record for another site, inspect it before replacing it; a CNAME cannot coexist with other records at that same hostname.

Custom domain ID: `appgdom_6ae41cda0038819180fa42235e6bc51a`. Site ID: `appgprj_6ae2f90a72488191a870f5a7eca72cf3`. After DNS is saved, refresh domain status using Sites. HTTPS is provisioned after domain validation; domain registration alone does not mean it is live.
