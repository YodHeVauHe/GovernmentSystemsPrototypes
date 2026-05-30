import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import App from "./App"

vi.mock("@/pages/HashPage", () => ({
  HashPage: () => <div>Hash a land-title record</div>,
}))

vi.mock("@/pages/BlockPage", () => ({
  BlockPage: () => <div>Block concept</div>,
}))

vi.mock("@/pages/BlockchainPage", () => ({
  BlockchainPage: () => <div>Blockchain concept</div>,
}))

vi.mock("@/pages/DistributedPage", () => ({
  DistributedPage: () => <div>Distributed MDA concept</div>,
}))

vi.mock("@/pages/TokensPage", () => ({
  TokensPage: () => <div>Tokens and assets concept</div>,
}))

vi.mock("@/pages/LandTitleUseCasePage", () => ({
  LandTitleUseCasePage: () => (
    <div>
      <h2>Land title verification and transfer</h2>
      <p>Smart-contract check failed</p>
    </div>
  ),
}))

vi.mock("@/pages/CashflowPage", () => ({
  CashflowPage: () => <div>MDA cashflow audit trail</div>,
}))

describe("BlockChainDemo app", () => {
  it("renders sidebar navigation and switches to concept pages", async () => {
    const { container } = render(<App />)

    const conceptNav = screen.getByRole("navigation", { name: "Concepts" })
    const navigationButtons = within(conceptNav).getAllByRole("button")
    const navigationLabels = navigationButtons.map((button) => button.textContent)
    const [hashButton] = navigationButtons
    const landTitleButton = within(conceptNav).getByRole("button", {
      name: "Land Title Use Case",
    })

    expect(navigationLabels).toEqual([
      "Hash",
      "Block",
      "Blockchain",
      "Distributed MDAs",
      "Tokens / Assets",
      "Land Title Use Case",
      "MDA Cashflow",
    ])
    expect(hashButton).toHaveAttribute("aria-current", "page")
    expect(container.querySelector('[role="tab"]')).not.toBeInTheDocument()
    expect(screen.getByText("Hash a land-title record")).toBeInTheDocument()

    fireEvent.click(landTitleButton)

    expect(
      await screen.findByText("Land title verification and transfer")
    ).toBeInTheDocument()
    expect(screen.getByText("Smart-contract check failed")).toBeInTheDocument()
    expect(landTitleButton).toHaveAttribute("aria-current", "page")

    const cashflowButton = within(conceptNav).getByRole("button", {
      name: "MDA Cashflow",
    })
    fireEvent.click(cashflowButton)

    expect(await screen.findByText("MDA cashflow audit trail")).toBeInTheDocument()
    expect(cashflowButton).toHaveAttribute("aria-current", "page")
  }, 10_000)
})
