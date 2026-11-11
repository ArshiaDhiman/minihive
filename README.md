# MiniHive

Multi-tenant user, licence and seat management platform. Amazon Cognito auth, role- and policy-based permissions, PostgreSQL with PL/pgSQL auditing, and event-driven provisioning via outbox → SNS → SQS → Lambda → DynamoDB. NestJS, React, TypeScript, AWS CDK.

## Seed accounts

`npm run db:seed` and `npm run db:seed-users` create these users. They all use the password in `SEED_USER_PASSWORD` from your `.env`.

| User  | Email                 | Organisation | Role           | Seat                       |
| ----- | --------------------- | ------------ | -------------- | -------------------------- |
| Alice | `alice@minihive.test` | none         | platform admin | none                       |
| Bob   | `bob@minihive.test`   | Garage A     | org admin      | none                       |
| Carol | `carol@minihive.test` | Garage A     | member         | Garage A RepairInfo        |
| Dave  | `dave@minihive.test`  | Garage A     | member         | none                       |
| Erin  | `erin@minihive.test`  | Garage B     | org admin      | none                       |

### Licences

| Organisation | Product    | Seats | Status  |
| ------------ | ---------- | ----- | ------- |
| Garage A     | RepairInfo | 2     | active  |
| Garage B     | RepairInfo | 1     | expired |

### What each user can do

- **Alice** can create organisations and licences (`POST /orgs`, `POST /orgs/:orgId/licences`). There is no admin page for this yet, so she only sees her account in the web app.
- **Bob** manages Garage A: sees its users, licences and audit log, and assigns or revokes seats.
- **Carol** and **Dave** see their own account and seats. They can't manage Garage A.
- **Erin** manages Garage B, but its licence has expired, so she can't assign seats.

Nobody can see or change another organisation's data: the API answers 404 for an organisation you don't belong to.

### RepairInfo access

RepairInfo only knows about seats that reached it as events, after an assign or revoke in the app.
Carol's seed seat is written straight to Postgres, so RepairInfo doesn't show her as having access until Bob revokes and reassigns it.
