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

describe("BlockChainDemo app", () => {
  it("renders sidebar navigation and switches to the land-title use case", async () => {
    const { container } = render(<App />)

    const conceptNav = screen.getByRole("navigation", { name: "Concepts" })
    const navigationButtons = within(conceptNav).getAllByRole("button")
    const navigationLabels = navigationButtons.map((button) => button.textContent)
    const [hashButton] = navigationButtons
    const landTitleButton = navigationButtons.at(-1)

    expect(navigationLabels).toEqual([
      "Hash",
      "Block",
      "Blockchain",
      "Distributed MDAs",
      "Tokens / Assets",
      "Land Title Use Case",
    ])
    expect(hashButton).toHaveAttribute("aria-current", "page")
    expect(container.querySelector('[role="tab"]')).not.toBeInTheDocument()
    expect(screen.getByText("Hash a land-title record")).toBeInTheDocument()

    expect(landTitleButton).toBeDefined()
    fireEvent.click(landTitleButton!)

    expect(
      await screen.findByText("Land title verification and transfer")
    ).toBeInTheDocument()
    expect(screen.getByText("Smart-contract check failed")).toBeInTheDocument()
    expect(landTitleButton).toHaveAttribute("aria-current", "page")
  })
})
