# Full System Audit Report

**System:** ABCH Hospital Ticketing CRM
**Date:** 2026-07-17
**Auditor:** Static Analysis — Automated Code Review
**Methodology:** Static source code analysis only. No runtime tests, penetration tests, or infrastructure scans were performed.
**Scope:** 54 API endpoints, 24+ database tables, 18 React pages, 21 test files, 3 backend modules (auth, tickets, admin), 8 frontend store/core files, 1 infrastructure file (docker-compose.yml)

---

## 1. System Summary

### What Was Audited

The ABCH Hospital Ticketing CRM is a full-stack hospital help desk application built on NestJS (backend), React (frontend), PostgreSQL (primary database), Redis (job queues, rate limiting), and Socket.IO (real-time). The system supports 4 user roles (super_admin, supervisor, agent, end_user) and manages ticket lifecycle, department routing, knowledge base, team collaboration notes, asset management, and analytics.

### Composition

| Layer | Technology | Files Audited |
|---|---|---|
| Backend API | NestJS + Prisma + PostgreSQL | 81 `.ts` files across 12 modules |
| Database | Prisma schema | 1 `schema.prisma` — 24 models |
| Frontend | React + Vite + Zustand + TypeScript | 32 `.ts/.tsx` files — 18 pages, 3 stores, 5 core modules |
| Tests | Vitest | 21 `.test.ts` files — ~105 test cases |
| Infrastructure | Docker Compose | 1 `docker-compose.yml` |
| Real-Time | Socket.IO + BullMQ | 3 gateway/processor files |
| Auth | JWT (jsonwebtoken) + bcrypt + csrf-csrf | 5 auth-related files |

### Endpoint Inventory

| Controller | Base Route | Endpoints | Auth | Guard |
|---|---|---|---|---|
| Auth | `/api/auth` | 3 (login, refresh, logout) | login/refresh: none; logout: JWT | Rate-limited |
| Tickets | `/api/tickets` | 21 | JWT | — |
| Admin: Users | `/api/admin/users` | 5 | JWT | super_admin |
| Admin: Depts | `/api/admin/departments` | 5 | JWT | super_admin |
| Admin: Buildings | `/api/admin/buildings` | 4 | JWT | super_admin+ |
| Admin: Floors | `/api/admin/floors` | 4 | JWT | super_admin+ |
| Admin: Ticket Types | `/api/admin/ticket-types` | 5 | JWT | super_admin+ |
| Admin: Roles | `/api/admin/roles` | 2 | JWT | super_admin |
| Analytics | `/api/analytics` | 10 | JWT | role-based |
| Audit | `/api/audit` | 2 | JWT | super_admin |
| Uploads | `/api/uploads` | 2 | JWT | — |
| Users | `/api/users` | 3 | JWT | — |
| Profile | `/api/profile` | 4 | JWT | — |
| Assets | `/api/assets` | 5 | JWT | — |
| Team Notes | `/api/team-notes` | 6 | JWT | — |
| Knowledge | `/api/knowledge` | 8 | JWT | perm-based |
| Notifications | `/api/notifications` | 2 | JWT | — |
| Health | `/health` | 1 | None | — |
| **Total** | — | **~91 route handlers across ~54 logical endpoints** | — | — |

### Audit Methodology

Every finding in this report is derived from one or more of the following techniques:
1. **Text search** — pattern matching across the entire codebase for specific identifiers
2. **Control flow analysis** — tracing function calls from controller → service → DB
3. **Schema comparison** — comparing Prisma model fields against their actual usage in service code
4. **Import chain verification** — confirming whether exported modules are imported by any consumer
5. **Dependency cross-reference** — matching declared npm packages against their actual usage in source files

No runtime verification was performed. Findings marked "Requires Runtime Verification: YES" indicate areas where static analysis provides high confidence but could be confirmed only through live testing.

---

## 2. Final Ranked Audit Table

All issues ranked by severity (Critical > High > Medium > Low). Each row is backed by code evidence.

| Rank | Issue | Category | Evidence Exists (Y/N) | Verified (Y/N) | Affected Files | Line Numbers | Confidence | Severity | Criticality | Requires Runtime Verification (Y/N) | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Hardcoded secrets in docker-compose.yml — DB credentials, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET committed as plaintext | Infrastructure / Secret Management | Y | Y | docker-compose.yml | 7-8, 40, 43-44 | HIGH | Critical | 10 | NO | 4 secrets exposed in version control. Must rotate immediately and switch to .env/Docker secrets |
| 2 | Refresh token not invalidated on logout — stolen token valid for 7 days | Authentication / Token Lifecycle | Y | Y | backend/src/modules/auth/auth.service.ts | 123-125 | HIGH | High | 8 | NO | logout() returns static string; no Redis blacklist, no DB revocation, no token rotation |
| 3 | Input validation covers only 1 of 54 endpoints — 53 endpoints accept body: any | Web Security / Input Validation | Y | Y | backend/src/modules/tickets/tickets.controller.ts | 20-26 | HIGH | High | 8 | NO | Zod schema + pipe exist but are unused by 53 of 54 endpoints. Only POST /api/tickets validates |
| 4 | IP and UserAgent not captured in audit logs — schema columns exist but never populated | Audit / Completeness | Y | Y | backend/prisma/schema.prisma | 456-457 | HIGH | Medium | 6 | NO | Grepping for `ipAddress` across all backend source yields 0 results. 36 auditLog.create() calls omit these fields |
| 5 | getDepartmentPerformance() ignores controller-supplied params — supervisor sees all departments | RBAC / Permission Bypass | Y | Y | backend/src/modules/analytics/analytics.service.ts | 150-152 | HIGH | Medium | 6 | NO | Controller passes role+deptId at analytics.controller.ts:51; service method accepts zero parameters |
| 6 | Hard deletes without audit trail for buildings and floors | Data Integrity / Audit Trail | Y | Y | backend/src/modules/admin/controllers/admin-buildings.controller.ts<br>backend/src/modules/admin/controllers/admin-floors.controller.ts | 58-61<br>57-62 | HIGH | Medium | 5 | NO | Uses prisma.building.delete() and prisma.floor.delete() with no auditLog.create() and no soft delete |
| 7 | Low test coverage thresholds — 50%/39%/35%/50% far below production standards | Quality Assurance | Y | Y | vitest.config.ts | 15-19 | HIGH | Medium | 5 | NO | Combined with 10+ untested pages and entire common/ core/ gateways/ directories lacking tests |
| 8 | ~~Dead code: Passport JwtStrategy registered but never invoked~~ **FIXED — removed** | Maintainability / Dead Code | Y | Y | ~~backend/src/modules/auth/strategies/jwt.strategy.ts~~ **DELETED** | — | HIGH | ~~Low~~ **RESOLVED** | ~~2~~ **0** | NO | ~~Custom JwtAuthGuard at jwt-auth.guard.ts performs manual verification. defaultStrategy: 'jwt' has no effect~~ **File removed in Phase 2** |
| 9 | ~~Dead code: Frontend permissionCache.ts never imported~~ **FIXED — removed** | Maintainability / Dead Code | Y | Y | ~~frontend/src/core/permissionCache.ts~~ **DELETED** | — | HIGH | ~~Low~~ **RESOLVED** | ~~1~~ **0** | NO | ~~Identical to backend version but no file in frontend imports it~~ **File removed in Phase 2** |
| 10 | ~~Dead code: Frontend refreshStore.ts never imported~~ **FIXED — removed** | Maintainability / Dead Code | Y | Y | ~~frontend/src/store/refreshStore.ts~~ **DELETED** | — | HIGH | ~~Low~~ **RESOLVED** | ~~1~~ **0** | NO | ~~Zustand store with ticketRefreshKey that no component consumes~~ **File removed in Phase 2** |
| 11 | ~~Dead code: Frontend paths.ts never imported~~ **FIXED — removed** | Maintainability / Dead Code | Y | Y | ~~frontend/src/core/paths.ts~~ **DELETED** | — | HIGH | ~~Low~~ **RESOLVED** | ~~1~~ **0** | NO | ~~Server-side path module (process.cwd()) in browser bundle~~ **File removed in Phase 2** |
| 12 | ~~Dead code: Frontend ErrorBoundary component never used~~ **FIXED — removed** | Maintainability / Dead Code | Y | Y | ~~frontend/src/components/ErrorBoundary.tsx~~ **DELETED** | — | HIGH | ~~Low~~ **RESOLVED** | ~~1~~ **0** | NO | ~~Error boundary defined but never imported in App.tsx or any page~~ **File removed in Phase 2** |
| 13 | No CI/CD pipeline — no automated testing or deployment gating | DevOps / CI-CD | Y | Y | .github/ | — | HIGH | Medium | 5 | NO | No .github/ directory exists. No workflow files. Builds and deploys are entirely manual |
| 14 | relatedTickets stored as JSON string — not normalized, not indexable | Data Integrity / Schema Design | Y | Y | backend/prisma/schema.prisma | 231 | HIGH | Medium | 4 | NO | Manual JSON.parse/stringify at tickets.service.ts:865-898. Cannot query "find tickets related to X" |
| 15 | CSRF_SECRET fallback is random per restart | Web Security / CSRF | Y | Y | backend/src/main.ts | 71 | HIGH | Low | 3 | NO | `getSecret: () => process.env.CSRF_SECRET \|\| crypto.randomBytes(32).toString('hex')` — if secret not set, tokens become invalid on each server restart |
| 16 | Ticket denormalization: buildingName, floorName, creatorDeptName stored as strings at time of creation | Data Integrity / Schema Design | Y | Y | backend/prisma/schema.prisma | 216-218 | HIGH | Low | 2 | NO | If building or department name changes, ticket records show stale names. No cascade update mechanism |
| 17 | allowedTransferDeptIds stored as JSON string in UserPermissionOverride | Data Integrity / Schema Design | Y | Y | backend/prisma/schema.prisma | 183 | HIGH | Low | 2 | NO | Non-normalized array. Not queryable. No format validation on writes |
| 18 | No response caching — every analytics and list endpoint hits the database | Performance | Y | Y | backend/src/modules/analytics/analytics.service.ts<br>backend/src/modules/tickets/tickets.service.ts | 35-115<br>184-205 | HIGH | Low | 3 | NO | Dashboard summary fires 18+ queries per request. No Redis cache layer for read-through |
| 19 | No structured logging — all logging via string interpolation with NestJS Logger | Operations / Observability | Y | Y | backend/src/common/interceptors/mutation-logger.interceptor.ts | 1-20 | MEDIUM | Low | 2 | NO | No pino, winston, or JSON logging. Difficult to parse logs at scale. Correlation via x-request-id present |
| 20 | ZodValidationPipe defined but never applied to any endpoint | Web Security / Input Validation | Y | Y | backend/src/common/pipes/zod-validation.pipe.ts | 1-21 | HIGH | High | 2 | NO | Pipe exists with correct implementation but zero imports across all controllers |
| 21 | Search and archived endpoints lack pagination max enforcement | Performance / DoS | Y | Y | backend/src/modules/tickets/tickets.service.ts | 272-293 | HIGH | Low | 3 | NO | `search()` at line 275-276 uses `parseInt(query.page)` and `parseInt(query.limit)` with no `MAX_PAGE_SIZE` cap. `findArchived()` at line 300 does cap at 100 |
| 22 | Profile update not wrapped in transaction | Data Integrity | Y | N | backend/src/modules/users/users.service.ts | 36-65 | MEDIUM | Low | 1 | NO | updateProfile performs a single update — transaction not needed but audit log is also absent from this mutation |
| 23 | User profile update not audit-logged | Audit / Completeness | Y | Y | backend/src/modules/users/users.service.ts<br>backend/src/modules/profile/profile.service.ts | 36-65<br>36 | MEDIUM | Low | 3 | NO | users.service.ts:updateProfile has no auditLog.create(). profile.service.ts:36 logs PROFILE_UPDATED, but users.service.ts path does not |
| 24 | No email notification infrastructure | Feature / Notifications | N | Y | — | — | HIGH | Low | 1 | NO | Out of scope per project requirements. System relies on Web Push via PushSubscription model |
| 25 | Hard delete of KB articles (audit logged but data lost permanently) | Data Integrity / Audit Trail | Y | Y | backend/src/modules/knowledge/knowledge.service.ts | 182 | HIGH | Low | 2 | NO | `prisma.knowledgeArticle.delete()` at line 182; audit logged at line 183-188. No soft delete pattern used |

---

## 3. Severity Distribution

| Severity | Count | Percentage |
|---|---|---|
| Critical | 1 | 4% |
| High | 3 | 12% |
| Medium | 7 | 28% |
| Low | 14 | 56% |
| **Total** | **25** | **100%** |

---

## 4. Category Distribution

| Category | Count |
|---|---|
| Authentication / Token Lifecycle | 1 |
| Audit / Completeness | 3 |
| Data Integrity / Schema Design | 5 |
| DevOps / CI-CD | 1 |
| Infrastructure / Secret Management | 1 |
| Maintainability / Dead Code | 5 |
| Operations / Observability | 1 |
| Performance / DoS | 2 |
| Quality Assurance | 1 |
| RBAC / Permission Bypass | 1 |
| Web Security / CSRF | 1 |
| Web Security / Input Validation | 2 |
| **Total** | **25** |

---

## 5. Recommended Remediation Priority

### Phase 1 — Immediate (Before Any Deployment)

| Priority | Issue | Rationale |
|---|---|---|
| P1 | Rotate all secrets in docker-compose.yml and move to .env | Current secrets are in git history |
| P2 | Implement refresh token invalidation on logout | 7-day exposure window for stolen tokens |
| P3 | Apply Zod validation to all mutation endpoints | Prevents injection, type confusion, and malformed data at 53 unprotected endpoints |

### Phase 2 — Short Term (Sprint 1-2)

| Priority | Issue | Rationale |
|---|---|---|
| P4 | Capture IP/UserAgent in audit logs | Compliance and forensic requirements |
| P5 | Fix getDepartmentPerformance to filter by supervisor department | RBAC bypass — supervisor can view all department data |
| P6 | Convert hard deletes to soft deletes on buildings/floors | Audit trail completeness |
| P7 | Set up CI/CD pipeline | Automated quality gates for all future changes |

### Phase 3 — Medium Term (Sprint 3-4)

| Priority | Issue | Rationale |
|---|---|---|
| P8 | Normalize relatedTickets to junction table | Queryability and data integrity |
| P9 | Add response caching for analytics endpoints | Performance under concurrent load |
| P10 | Remove dead code (JwtStrategy, frontend unused modules) | Reduce maintenance burden and security surface |
| P11 | Upgrade test coverage thresholds | Minimum 80% statements, 70% branches |

### Phase 4 — Long Term (Sprint 5+)

| Priority | Issue | Rationale |
|---|---|---|
| P12 | Implement structured JSON logging | Production observability |
| P13 | Add response pagination hard limit to search endpoint | DoS protection |
| P14 | Add audit logging to profile updates | Complete audit trail |
| P15 | Consider soft delete for KB articles | Data recovery capability |

---

## 6. Positive Findings

The following security and quality controls are CONFIRMED as properly implemented and require no remediation:

1. **JWT fail-fast on missing secrets** — dual-layer at application bootstrap and module load
2. **bcrypt password hashing** — bcryptjs with max 128-char input validation
3. **Account lockout** — 5 attempts / 15-minute lock, with automatic unlock
4. **Rate limiting** — 6-tier configuration with Redis backend
5. **CSRF protection** — double-cookie pattern via csrf-csrf
6. **Helmet CSP** — restrictive policy with only `unsafe-inline` for styles
7. **CORS whitelist** — origin-restricted, credentials-aware
8. **File upload security** — magic byte validation, path traversal prevention, extension whitelist, 5MB limit
9. **XSS protection** — Helmet xssFilter + CSP script-src: self
10. **SQL injection protection** — 100% Prisma parameterized queries
11. **Prisma transactions** — all multi-step mutations wrapped in `$transaction()`
12. **Soft deletes** — confirmed on users, departments, tickets (via archive)
13. **Global exception filter** — production-safe, no stack trace leakage
14. **Permission caching** — 30-second TTL reduces redundant DB queries
15. **Audit logging** — 36 write points cover nearly all mutations
16. **Swagger documentation** — complete OpenAPI spec in development

---

**End of Report**

---

# Phase 2 — Gap Resolution Summary

## What Was Fixed (Low-Risk, Unambiguous)

### Dead Code Removal (9 files deleted, 1 file edited)

| Finding | Files Removed | Impact |
|---|---|---|
| Passport JwtStrategy (Rank 8) | `backend/src/modules/auth/strategies/jwt.strategy.ts`, `strategies/` dir | JwtAuthGuard uses manual verification; Passport never invoked |
| Unused frontend modules (Ranks 9-12) | `frontend/src/core/permissionCache.ts`, `frontend/src/store/refreshStore.ts`, `frontend/src/core/paths.ts`, `frontend/src/components/ErrorBoundary.tsx` | Zero imports across entire codebase |
| Unused backend core files | `backend/src/core/api.ts`, `backend/src/core/translations.ts`, `backend/src/lib/utils.ts` | Frontend code accidentally duplicated in backend source tree; zero backend imports |
| Unused NestJS modules | `@nestjs/jwt`, `@nestjs/passport` removed from `auth.module.ts` imports; JwtStrategy removed from providers | JwtModule/JwtService never injected; all JWT ops use `jsonwebtoken` directly via `auth.utils.ts` |

**Verification:** `tsc --noEmit` passes cleanly on all source code. No remaining imports to deleted files.

### What Was NOT Fixed (Flagged for Human Review)

| Rank | Issue | Why Flagged |
|---|---|---|
| 1 | Hardcoded secrets in docker-compose.yml | Requires secret rotation — operational decision, not code change |
| 2 | Refresh token not invalidated on logout | Touches auth/data model — needs architectural decision (Redis blacklist vs. DB table) |
| 3 | Input validation covers only 1/54 endpoints | Requires per-endpoint DTO design — significant blast radius |
| 4 | IP/UserAgent not captured in audit logs | Requires changes to 36+ audit log write points across all modules |
| 5 | getDepartmentPerformance() ignores params | RBAC bypass — fix direction unclear (filter departments? filter ticket counts?) |
| 6 | Hard deletes without audit (buildings/floors) | Schema and business logic change — needs human approval |
| 8-12 (extended) | ZodValidationPipe unused (Rank 20) | Applying validation requires per-endpoint schema design |

## Updated Findings

- **5 dead code findings resolved** (Ranks 8-12 in table, marked FIXED)
- **3 additional dead files removed** (backend core/api.ts, core/translations.ts, lib/utils.ts)
- **1 module cleaned** (auth.module.ts — removed PassportModule, JwtModule, JwtStrategy)
- **20 findings remain open** (1 Critical, 3 High, 7 Medium, 9 Low)