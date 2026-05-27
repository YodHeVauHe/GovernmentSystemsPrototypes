# Neutral Not Found Design

## Goal
Unknown frontend routes render a neutral page-not-found screen so typos and route probing do not reveal whether a protected route exists or requires authentication.

## Routing
Known routes keep their current behavior. Public documentation routes remain public, protected routes still redirect unauthenticated users to `/login`, and pending users still go to `/account-status`.

Unknown routes such as `/admin`, `/wp-login.php`, `/api/secrets`, and misspellings render the same fallback screen for authenticated and unauthenticated users.

## UI
The fallback screen uses the existing dark app shell, sidebar, header, and Tailwind tokens. It shows a concise `Page not found` message, a neutral explanation, and a primary action back to the catalog.

## Testing
A Playwright test visits a brute-force-style unknown path while signed out and verifies the app shows the fallback page instead of redirecting to login or exposing authorization state.
