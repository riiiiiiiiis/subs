# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Next.js subscription management application (MVP) that allows users to track recurring subscriptions with automatic calculation of remaining days until next payment. The app uses browser localStorage for data persistence.

## Development Commands

```bash
npm install      # Install dependencies
npm run dev      # Start development server (http://localhost:3000)
npm run build    # Build for production
npm start        # Start production server
```

## Architecture

### Data Flow
1. **useLocalSubscriptions hook** (app/useLocalSubscriptions.ts) manages subscription data in localStorage
2. **Page component** (app/page.tsx) handles UI state and CRUD operations
3. All data is stored client-side in localStorage under the key "subscriptions"

### Key Components
- **app/page.tsx**: Main subscription management interface
  - Form for adding/editing subscriptions
  - Table displaying all subscriptions with calculated days remaining
  - Auto-refresh every minute to update "days remaining"
  - Click-to-edit functionality on table rows

- **app/useLocalSubscriptions.ts**: Custom hook for localStorage persistence
  - Provides `subs` state and `setSubs` function
  - Automatically syncs changes to localStorage

### Data Model
```typescript
type Subscription = {
  id: number;
  title: string;
  amount: number;
  startDate: string;
  period: number; // in days
}
```

## Important Notes

- The application is entirely client-side with no backend
- Tailwind CSS is loaded via CDN in app/layout.tsx
- UI text is in Russian
- Designed for deployment on Vercel
- Days remaining calculation: Math.max(0, period - daysSinceStart)