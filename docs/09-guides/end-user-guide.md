# End User Guide

This guide is for end users (patients, staff members, or anyone submitting service requests through the ABCH Hospital Ticketing CRM).

## Getting Started

Sign in using your hospital badge number or username and password.

### Login

**Frontend**: `Login.tsx`  
**API**: `POST /api/auth/login`

1. Enter your badge number or username
2. Enter your password
3. Click "Sign In"

**Important**: After 5 consecutive failed login attempts, your account is locked for 15 minutes. Contact your system administrator if you need to be unlocked early (`backend/src/modules/auth/auth.service.ts:58-60`).

If your account has `forcePasswordChange = true`, you will be prompted to set a new password on login.

## Creating a Ticket

**Frontend**: `NewTicketPage.tsx`  
**API**: `POST /api/tickets`

### Steps

1. Navigate to "New Ticket" from the main menu
2. Fill in the ticket details:
   - **Subject**: Brief description of your issue
   - **Description**: Detailed explanation of your request
   - **Department**: Select the department that should handle your request
   - **Ticket Type**: Select the category (e.g., IT support, Facilities, Medical Equipment)
   - **Building**: Select your building
   - **Floor**: Select your floor (populated based on building selection)
   - **Room Extension**: Your room or phone extension (optional)
   - **Priority**: low, normal, high, or critical (default: `normal`)
3. Attach relevant files or voice notes (optional)
4. Click "Submit"

### Ticket Creation Details

Your ticket is created with:
- Auto-generated ticket number (unique, `Ticket.ticketNumber`, `schema.prisma:L207`)
- Status: `pending` (awaiting agent acceptance)
- SLA deadline calculated from department's `slaHours` and priority modifier
- Creator information saved (name, phone, extension, department)

### SLA Expectations

| Priority  | Time Adjustment       | Example (24h dept) |
|-----------|-----------------------|--------------------|
| Low       | 50% more time         | 36 hours           |
| Normal    | Standard time         | 24 hours           |
| High      | 50% less time         | 12 hours           |
| Critical  | 75% less time         | 6 hours            |

## Tracking Your Tickets ("My Tickets")

**Frontend**: `MyTicketsPage.tsx`  
**API**: `GET /api/tickets/my`

View all tickets you've created in the "My Tickets" section.

### What You See

Each ticket shows:
- Ticket number (e.g., `TK-2024-0001`)
- Subject
- Current status (pending, open, in_progress, resolved, closed)
- Priority
- Assigned department
- Assigned agent (if assigned)
- SLA deadline and whether it's met or exceeded
- Creation date

### Ticket Statuses

| Status       | Meaning                                                  |
|-------------|----------------------------------------------------------|
| pending     | Waiting for an agent to accept it                        |
| open        | An agent has accepted the ticket                         |
| in_progress | An agent is actively working on it                       |
| resolved    | Agent has completed the work, awaiting your confirmation |
| closed      | Ticket is fully closed (you confirmed or auto-closed)    |

## Ticket Details View

**Frontend**: `TicketDetailsPage.tsx`  
**API**: `GET /api/tickets/:id`

Click on any ticket to see the full details page:

### Sections

1. **Header**: Ticket number, subject, status, priority, department
2. **Description**: Original description and attachments
3. **Timeline**: Chronological view of all status changes and comments
4. **Comments**: Public comments from agents (internal notes are not visible to you)
5. **Attachments**: Any files attached to the ticket or messages
6. **Creator Info**: Your submitted information (name, phone, extension, location)
7. **Agent Info**: Assigned agent name and department (if assigned)
8. **SLA Info**: Deadline and current status (with warning/breach indicators)
9. **Resolution Rating**: Appears when ticket is `resolved` (see below)

## Confirming Resolution

**API**: `PUT /api/tickets/:id/confirm`

When an agent marks a ticket as `resolved`, you have the opportunity to either:
1. **Confirm** → Ticket moves to `closed`
2. **Reject** → Ticket reopens to `in_progress` for further work

### Steps to Confirm with Rating

1. Open the resolved ticket
2. You'll see a rating prompt
3. Rate the resolution from 1-5 stars:
   - 1 = Very unsatisfied
   - 3 = Neutral
   - 5 = Very satisfied
4. Optionally add feedback comments
5. Click "Confirm Resolution"

Your rating is saved to `Ticket.rating` and `Ticket.feedback` (`schema.prisma:L242-243`).

### If You're Not Satisfied

1. Reject the resolution (ticket goes back to `in_progress`)
2. Add a comment explaining what's still needed
3. The assigned agent will see the reopened ticket

## Knowledge Base Search

**Frontend**: `KnowledgeBasePage.tsx`  
**API**: `GET /api/knowledge/*`

Before creating a ticket, check the Knowledge Base for existing solutions.

### Browsing Articles

1. Navigate to "Knowledge Base" from the main menu
2. Browse by category
3. Click an article to read its content
4. Search by keyword (if search is available)

Articles are available in both Arabic and English (`titleAr`/`titleEn`, `contentAr`/`contentEn`).

## Profile Management

**Frontend**: `UserProfilePage.tsx`  
**API**: `PATCH /api/users/me`, `PATCH /api/users/me/avatar`

### Update Your Profile

1. Click your profile icon or name
2. Navigate to "Profile Settings"
3. Edit your details:
   - Arabic name (required, `fullNameAr`)
   - English name (optional, `fullNameEn`)
   - Email address (optional, validated format)
   - Language preference (`ar` or `en`)
4. Click "Save Changes"

### Change Avatar

1. Go to Profile Settings
2. Click "Change Avatar"
3. Upload an image (JPEG, PNG supported — validated by magic byte inspection)
4. Your avatar is resized to 200x200 pixels via Sharp (`backend/src/modules/users/users.service.ts:77-79`)

## Notifications

**API**: `GET /api/notifications`  
**Model**: `Notification` (`schema.prisma:L356-374`)

You will receive notifications for:
- New ticket created confirmation
- Status changes on your tickets
- Agent comments on your tickets
- Resolution awaiting your confirmation

Notifications display in both Arabic (`titleAr`, `bodyAr`) and English (`titleEn`, `bodyEn`) based on your language preference.

## Language Preferences

The system supports Arabic (RTL) and English (LTR). Set your preference in:
- Profile settings (`langPref` field, defaults to `ar`)
- The frontend uses `i18next` with browser language detection (`frontend/package.json:L18-20`)

## Quick Reference

| Task                  | Where                     |
|-----------------------|--------------------------|
| Create a new ticket   | "New Ticket" page         |
| View my tickets       | "My Tickets" page         |
| Check ticket status   | "My Tickets" > click ticket |
| Confirm resolution    | Ticket Details > "Confirm" |
| Rate a resolution     | 1-5 stars + feedback text |
| Search knowledge base | "Knowledge Base" page     |
| Update profile        | Profile icon > Settings   |
| Change language       | Profile > Language pref   |
| Upload avatar         | Profile > Change Avatar   |

## Troubleshooting

- **Can't log in**: Wait 15 minutes if locked out, or contact admin
- **Can't create ticket**: Ensure you select a valid department and building/floor
- **File upload rejected**: Check file type is supported (JPEG, PNG, PDF, DOC, DOCX, XLS, XLSX, WAV, MP3, WebM)
- **Missing translation**: Your language preference may not have all strings translated; the system falls back to Arabic