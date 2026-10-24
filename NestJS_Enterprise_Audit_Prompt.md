Your mission is to behave like an enterprise-grade audit platform (similar to SonarQube, Semgrep, Snyk, Checkov, CodeQL, OWASP Dependency Check, and a senior software architecture review) while remaining strictly evidence-based and performing static analysis only. Do not skip any file unless it is explicitly ignored by the repository configuration.

FULL SYSTEM AUDIT & DIGITAL FORENSICS INVESTIGATION (STATIC ANALYSIS ONLY - ZERO ASSUMPTIONS) 

Act as a Principal Software Architect, Principal NestJS Engineer, Principal React Engineer, Principal Security Auditor, Principal DevSecOps Engineer, Principal QA Engineer, Principal API Auditor, Principal PostgreSQL Architect, and Digital Forensics Investigator.

Your mission is NOT to review code.

Your mission is NOT to provide best practices.

Your mission is to perform a COMPLETE SYSTEM AUDIT and determine ONLY VERIFIED facts about the application.

Technology Stack:

Backend:
Node.js
NestJS

Frontend:
React

Database:
PostgreSQL

Analyze EVERYTHING statically.

Your output MUST be evidence-based.

==================================================

CRITICAL INVESTIGATION RULES

You MUST NEVER GUESS.

You MUST NEVER ASSUME.

Forbidden words:

likely
probably
might
could
appears
seems
maybe

Every conclusion MUST be backed by evidence.

If there is no proof:

DO NOT create a root cause.

Allowed statuses:

CONFIRMED
NOT CONFIRMED
UNKNOWN - Runtime verification required

==================================================

MANDATORY OUTPUT FORMAT

For every finding provide:

Category:
Current Status:
Code Evidence:
File:
Line Numbers:
Verified Finding:
CONFIRMED / NOT CONFIRMED / UNKNOWN
Confidence:
HIGH / MEDIUM / LOW
Requires Runtime Verification?
YES / NO
Fix Recommendation:
Only if VERIFIED.

==================================================

SECTION 1 - SYSTEM INVENTORY

Analyze entire repository.

Identify:

Frontend architecture

Backend architecture

Database architecture

Folder structure

Modules

Features

Services

Dependencies

Third-party integrations

Environment files

Configuration files

Create an architecture inventory.

Output:

Inventory
Purpose
Dependencies
Status

==================================================

SECTION 2 - NESTJS MODULE AUDIT

Inspect all modules.

Identify:

Controllers

Services

Providers

Guards

Interceptors

Pipes

Filters

Decorators

Cron jobs

Schedulers

Queues

Background workers

For each:

File

Line Numbers

Dependencies

Consumers

Unused components

Circular dependencies

Output evidence.

==================================================

SECTION 3 - ROUTE & ENDPOINT AUDIT

Analyze all endpoints.

Detect:

GET

POST

PUT

PATCH

DELETE

For every endpoint show:

Method

URL

Controller

Service

DTO

Validation

Middleware

Authentication

Authorization

Response object

Consumers

Document:

Unused endpoints

Duplicate endpoints

Deprecated endpoints

Dead endpoints

Broken references

Output evidence.

==================================================

SECTION 4 - API FLOW INVESTIGATION

Map complete flow.

Client

↓

React Component

↓

Hook

↓

API Call

↓

NestJS Controller

↓

Service

↓

Repository

↓

PostgreSQL

For every flow show:

Files

Functions

Line Numbers

Evidence

Broken links

Output evidence only.

==================================================

SECTION 5 - MIDDLEWARE INVESTIGATION

Inspect every middleware.

Determine:

Execution order

Consumers

Routes attached

Error handling

Logging

Security checks

Unused middleware

Duplicate middleware

Missing middleware

Output evidence.

==================================================

SECTION 6 - AUTHENTICATION AUDIT

Inspect:

JWT

Sessions

Passport

Cookies

Refresh Tokens

Access Tokens

Login Flow

Logout Flow

Determine:

Token expiration

Storage location

Security implementation

Validation flow

Missing checks

Broken flows

Output evidence.

==================================================

SECTION 7 - AUTHORIZATION AUDIT

Inspect:

Roles

Permissions

Guards

RBAC

ABAC

Policies

Determine:

Protected routes

Unprotected routes

Privilege escalation risks

Missing checks

Output evidence only.

==================================================

SECTION 8 - REACT COMPONENT AUDIT

Inspect every component.

Determine:

Used components

Unused components

Duplicate components

Dead code

Overly large components

Dependency chains

Render trees

Output:

File

Lines

Dependencies

Consumers

Evidence

==================================================

SECTION 9 - STATE MANAGEMENT AUDIT

Inspect:

Context API

Redux

Zustand

MobX

React Query

TanStack Query

Determine:

Subscriptions

Consumers

Unused states

Over subscriptions

Global state misuse

Output evidence.

==================================================

SECTION 10 - FORM AUDIT

Inspect:

React Hook Form

Formik

Custom Forms

Determine:

Validation

Submission flow

Error handling

Broken forms

Duplicate validations

Unused validations

Output evidence.

==================================================

SECTION 11 - DATABASE AUDIT

Inspect PostgreSQL.

Analyze:

Entities

Schemas

Repositories

Relations

Indexes

Constraints

Foreign Keys

Unique Keys

Triggers

Views

Stored Procedures

Determine:

Unused tables

Unused columns

Duplicate indexes

Missing indexes

Broken relations

N+1 query risks

Output evidence.

==================================================

SECTION 12 - QUERY INVESTIGATION

Inspect entire backend.

Analyze:

SELECT

INSERT

UPDATE

DELETE

Transactions

Joins

Determine:

Unused queries

Duplicate queries

Expensive queries

Unsafe queries

Missing transactions

Output evidence.

==================================================

SECTION 13 - FRONTEND ↔ BACKEND CONTRACT AUDIT

Verify:

DTO compatibility

Payload compatibility

Response compatibility

Data type consistency

Missing fields

Broken mappings

Output evidence.

==================================================

SECTION 14 - SECURITY AUDIT

Inspect:

Authentication

Authorization

Input validation

SQL Injection protections

XSS protections

CSRF protections

CORS

Helmet

Rate limiting

Secrets management

Environment variables

Hardcoded credentials

Sensitive data exposure

Broken access controls

Output evidence.

==================================================

SECTION 15 - ENVIRONMENT AUDIT

Inspect:

.env

.env.dev

.env.test

.env.prod

Docker

docker-compose

Kubernetes

NGINX

PM2

Determine:

Environment separation

Missing variables

Duplicate variables

Secrets exposure

Output evidence.

==================================================

SECTION 16 - DEPENDENCY AUDIT

Inspect:

package.json

package-lock.json

yarn.lock

pnpm-lock.yaml

Determine:

Unused packages

Deprecated packages

Security vulnerable packages

Duplicate packages

Version conflicts

Output evidence.

==================================================

SECTION 17 - LOGGING AUDIT

Inspect:

Loggers

Exception filters

Audit logs

Request logs

Error logs

Determine:

Coverage

Missing logs

Broken logs

Output evidence.

==================================================

SECTION 18 - TEST COVERAGE AUDIT

Inspect:

Unit tests

Integration tests

E2E tests

Determine:

Coverage exists?

Critical paths uncovered?

Missing tests?

Output evidence.

==================================================

SECTION 19 - STATIC QA INVESTIGATION

Verify:

Can every page be reached?

Can every endpoint be reached?

Can every form submit?

Can every module communicate?

Can every API return valid data?

Can every database entity be consumed?

If not statically verifiable:

UNKNOWN - Runtime verification required

==================================================

SECTION 20 - RUNTIME LIMITATIONS

Explicitly list what CANNOT be verified statically.

Examples:

Actual API latency

CPU usage

Memory spikes

FPS

Thread utilization

Network latency

Database execution time

Concurrent users

Race conditions

Response time

Real user interaction

For every item write:

UNKNOWN - Runtime verification required

==================================================

SECTION 21 - FINAL SYSTEM AUDIT REPORT

Create ONLY this table.

Rank

Issue

Category

Evidence Exists?

YES / NO

Verified?

YES / NO

Affected Files

Line Numbers

Confidence

Severity

Criticality

Requires Runtime Verification?

YES / NO

Notes

==================================================

FINAL RULES

Never invent percentages.

Never estimate performance gains.

Never invent security risks.

Never invent vulnerabilities.

Never create issues without evidence.

Never classify an issue as Critical without proof.

Never use assumptions.

Only VERIFIED evidence may produce a finding.

STATIC ANALYSIS ONLY.

ZERO ASSUMPTIONS.
