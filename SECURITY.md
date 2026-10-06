# Security and personal-data policy

## Reporting a vulnerability

Email **rubli-project@proton.me** with the subject line `SECURITY`. Please include:

- what is affected (an endpoint, page, file or commit);
- steps to reproduce, or a proof of concept;
- the impact you expect;
- whether you have already told anyone else.

**Do not open a public GitHub issue, pull request or discussion for a vulnerability.** We aim to acknowledge reports within 3 working days and to fix confirmed issues as quickly as their severity requires. We will credit you in the changelog unless you ask us not to.

This is a small volunteer project. There is no bug bounty.

### In scope

- The code in this repository.
- The production site and API at `rubli.xyz`. Test gently: no denial-of-service, no automated scanning that degrades the service, and no access to data that isn't yours.

## Reporting exposed personal data

Treat these the same way as a vulnerability, through the same email and not in public:

- the RFC (13-character tax ID) or full name of a **natural person** (persona física) shown on the site, returned by the API, or present in the repository;
- private contact details of any person;
- a secret, key, token or credential in the repository or its history.

We remove confirmed exposures first and investigate afterwards.

## What RUBLI does with personal data

- **Source data.** CompraNet lists natural persons who sold to the government. RUBLI keeps these records so that contract totals are complete.
- **RFC masking.** Natural persons' RFCs are masked server-side on every API response. Masking does not rely on the frontend.
- **No labels on individuals.** Investigation-pattern labels (for example "ghost company") are not attached to natural persons or to public bodies.
- **Not in this repository:** the database, raw SAT, SFP and RUPC downloads, investigation memos, and any analyst notes naming private individuals.
- **Corrections and removal.** People and companies can ask for a correction or for a review of how they are shown by writing to rubli-project@proton.me.

## Supported versions

Only the current `main` branch and the live site receive security fixes.
