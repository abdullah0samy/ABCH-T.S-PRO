# Knowledge Base Documentation

## Overview

The Knowledge Base module provides bilingual (Arabic/English) article management with categories, search, and autocomplete suggestions. Read access is open to all authenticated users; write access is gated by `canManageKnowledgeBase` permission.

---

## Models

### KnowledgeCategory

**File:** `backend/prisma/schema.prisma:518-526`

| Field | Type | Description |
|-------|------|-------------|
| `id` | Int | Auto-increment PK |
| `nameAr` | String | Arabic name |
| `nameEn` | String | English name |
| `articles[]` | KnowledgeArticle[] | Related articles |
| `createdAt` | DateTime | Timestamp |

### KnowledgeArticle

**File:** `backend/prisma/schema.prisma:528-547`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `id` | Int | autoincrement | PK |
| `titleAr` | String | — | Arabic title |
| `titleEn` | String | — | English title |
| `contentAr` | String | — | Arabic content |
| `contentEn` | String | — | English content |
| `categoryId` | Int | — | FK → KnowledgeCategory |
| `authorId` | Int | — | FK → User |
| `views` | Int | 0 | View counter |
| `isActive` | Boolean | true | Soft activation flag |
| `createdAt` | DateTime | now() | — |
| `updatedAt` | DateTime | updatedAt | — |

**Indexes** (`schema.prisma:542-544`):
- `@@index([categoryId])`
- `@@index([isActive])`
- `@@index([views])`

---

## Endpoints (11 total)

**Controller:** `backend/src/modules/knowledge/knowledge.controller.ts`

All endpoints require `JwtAuthGuard` (`knowledge.controller.ts:10`). Write endpoints enforce `canManageKnowledgeBase` in the service layer.

### Read Endpoints (Open to all authenticated users)

| # | Method | Endpoint | Description | Source |
|---|--------|----------|-------------|--------|
| 1 | GET | `/api/knowledge/articles` | List articles (paginated, filterable by search + categoryId) | `knowledge.controller.ts:14-27` |
| 2 | GET | `/api/knowledge/categories` | List all categories with article counts | `knowledge.controller.ts:29-32` |
| 3 | GET | `/api/knowledge/search` | Full-text search across titles and content | `knowledge.controller.ts:33-41` |
| 4 | GET | `/api/knowledge/suggest` | Autocomplete suggestions (top-3 with snippets) | `knowledge.controller.ts:43-46` |
| 5 | POST | `/api/knowledge/articles/:id/view` | Increment view counter | `knowledge.controller.ts:66-69` |

### Write Endpoints (Gated by `canManageKnowledgeBase`)

| # | Method | Endpoint | Description | Source | Permission Check |
|---|--------|----------|-------------|--------|-----------------|
| 6 | POST | `/api/knowledge/articles` | Create article | `knowledge.controller.ts:48-52` | `knowledge.service.ts:136` |
| 7 | PUT | `/api/knowledge/articles/:id` | Update article | `knowledge.controller.ts:54-57` | `knowledge.service.ts:153` |
| 8 | DELETE | `/api/knowledge/articles/:id` | Delete article | `knowledge.controller.ts:59-63` | `knowledge.service.ts:179` |
| 9 | POST | `/api/knowledge/categories` | Create category | `knowledge.controller.ts:71-75` | `knowledge.service.ts:198` |
| 10 | PUT | `/api/knowledge/categories/:id` | Update category | `knowledge.controller.ts:77-80` | `knowledge.service.ts:208` |
| 11 | DELETE | `/api/knowledge/categories/:id` | Delete category (blocked if articles exist) | `knowledge.controller.ts:82-86` | `knowledge.service.ts:227` |

---

## Permission Gate: checkKbPermission

**File:** `backend/src/modules/knowledge/knowledge.service.ts:9-21`

Resolution chain:
1. **Super admin bypass** — `userRole === 'super_admin'` returns `true` immediately (`knowledge.service.ts:10`)
2. **User override** — Check `UserPermissionOverride.canManageKnowledgeBase`; if non-null, use its value (`knowledge.service.ts:11-12`)
3. **Department default** — Check `DeptPermissions.canManageKnowledgeBase` (`knowledge.service.ts:13-18`)
4. **Fall through** — Return `false` (`knowledge.service.ts:20`)

---

## Search Implementation

### findAll with Search (`knowledge.service.ts:23-51`)

Searches across `titleAr`, `titleEn`, `contentAr`, `contentEn`, `category.nameAr`, `category.nameEn` using `contains` (case-insensitive). Results are paginated (default: 20 per page, max 100), ordered by `createdAt DESC`. Only `isActive: true` articles are returned.

Arabic normalization via `normalizeArabic()` from `backend/src/core/arabic.ts` is applied to the search string (`knowledge.service.ts:29`).

### Dedicated Search Endpoint (`knowledge.service.ts:59-85`)

Similar to `findAll` search but searches only article fields (not category names): `titleAr/En`, `contentAr/En`. Returns pagination metadata.

---

## Autocomplete Suggest

**File:** `backend/src/modules/knowledge/knowledge.service.ts:87-131`

Algorithm:
1. **Minimum length:** Query must be at least 3 characters trimmed, or returns empty (`knowledge.service.ts:88`)
2. **Exact matches:** `contains` on `titleAr/En`, `contentAr/En`, ordered by `views DESC`, taken top-3 (`knowledge.service.ts:91-104`)
3. **If 3+ exact matches:** Return them with 120-char snippets (`knowledge.service.ts:105-110`)
4. **Word-level fallback:** Split query into words >= 4 chars (`knowledge.service.ts:90`). For each word, generate conditions against `titleAr/En`, `contentAr/En` (`knowledge.service.ts:112-117`). Query for remaining slots (`3 - exactMatches.length`), excluding already-matched IDs (`knowledge.service.ts:118-125`)
5. **Combine:** Exact matches + word matches, ordered by views (`knowledge.service.ts:126`)

Each result includes:
- `id`, `titleAr`, `titleEn`, `views`, `category`
- `snippetEn`: First 120 characters of `contentEn` + `...` if truncated
- `snippetAr`: First 120 characters of `contentAr` + `...` if truncated

---

## Bilingual Support

All text fields have AR/EN variants:

| Model | AR Fields | EN Fields |
|-------|-----------|-----------|
| `KnowledgeCategory` | `nameAr` | `nameEn` |
| `KnowledgeArticle` | `titleAr`, `contentAr` | `titleEn`, `contentEn` |

Both languages are required on article creation (`knowledge.service.ts:138: if (!titleAr || !titleEn || !contentAr || !contentEn || !categoryId)`).

---

## Audit Trail

All write operations create `AuditLog` entries:

| Action | Trigger | Source |
|--------|---------|--------|
| `ARTICLE_CREATED` | `create()` | `knowledge.service.ts:145-147` |
| `ARTICLE_UPDATED` | `update()` | `knowledge.service.ts:166-172` |
| `ARTICLE_DELETED` | `remove()` | `knowledge.service.ts:183-188` |
| `CATEGORY_CREATED` | `createCategory()` | `knowledge.service.ts:201-203` |
| `CATEGORY_UPDATED` | `updateCategory()` | `knowledge.service.ts:213-220` |
| `CATEGORY_DELETED` | `removeCategory()` | `knowledge.service.ts:233-238` |

---

## Constraints & Edge Cases

1. **Category deletion blocked with articles:** `removeCategory()` checks `knowledgeArticle.count({ where: { categoryId: id } })` and throws `BadRequestException` if `> 0` (`knowledge.service.ts:228-229`)
2. **Soft activation:** Articles are filtered by `isActive: true` for read queries. Deactivation is done via partial update of `isActive` field (`knowledge.service.ts:161`)
3. **View increment no auth check:** `POST /api/knowledge/articles/:id/view` only requires JWT, no additional permission check (`knowledge.controller.ts:66-69`) — any logged-in user can increment views