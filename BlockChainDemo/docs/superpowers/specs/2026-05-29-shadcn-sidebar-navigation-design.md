# shadcn Sidebar Navigation Design

## Purpose

Replace the current top tab navigation in `BlockChainDemo` with a shadcn sidebar menu. The sidebar should be the primary navigation for the six blockchain concept pages and should make the demo feel more like an operational government tool than a tabbed sample page.

## Approved Approach

Use explicit React state for the active concept page instead of keeping Radix Tabs as the navigation controller.

This means:

- `App.tsx` owns the selected concept page.
- The sidebar receives the selected value and an `onSelect` handler.
- The selected page component is rendered directly.
- The existing top tab bar is removed.
- The existing concept page values remain unchanged.

## UI Structure

Add shadcn sidebar primitives under `frontend/src/components/ui/sidebar.tsx`, following the project's existing shadcn configuration:

- style: `new-york`
- React client components
- Tailwind v4 semantic tokens
- lucide icons
- aliases from `frontend/components.json`

Update the layout to use:

- `SidebarProvider`
- `Sidebar`
- `SidebarHeader`
- `SidebarContent`
- `SidebarMenu`
- `SidebarMenuItem`
- `SidebarMenuButton`
- `SidebarInset`
- `SidebarTrigger`

The sidebar should show:

- app name or compact product label in the header
- the six concept navigation items
- active state for the selected concept

The main area should keep the existing header badges, title, warning note, and page content. On small screens, the sidebar trigger should expose the navigation without requiring the old tab list.

## Navigation Items

Reuse the existing concept page list:

- Hash
- Block
- Blockchain
- Distributed MDAs
- Tokens / Assets
- Land Title Use Case

The list can remain in `ConceptNav.tsx` if the component is converted from tab navigation to sidebar navigation, or it can be moved to a more neutral name if that keeps the code clearer.

## Component Responsibilities

`App.tsx`:

- stores the active concept value
- renders the selected page via a small map or switch
- passes navigation state into `AppShell`

`AppShell.tsx`:

- owns the sidebar layout shell
- renders the sidebar navigation and the main content area
- keeps the visual header and page container

`ConceptNav.tsx`:

- renders shadcn sidebar menu items
- accepts `activePage` and `onPageChange`
- does not import Radix Tabs

## Testing

Update the app test to verify:

- the six navigation buttons are rendered in the sidebar
- the default page is still the Hash concept
- selecting `Land Title Use Case` renders the land-title workflow
- no test relies on tab roles for primary navigation

Run the focused frontend test and the frontend build before completion.

## Out Of Scope

- React Router or URL deep links
- backend changes
- changing concept page content
- redesigning the blockchain cards, tables, or simulations
- keeping the old top tab navigation as a secondary control
