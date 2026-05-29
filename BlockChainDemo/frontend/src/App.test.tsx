import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import App from "./App"

describe("BlockChainDemo app", () => {
  it("renders sidebar navigation and switches to the land-title use case", async () => {
    render(<App />)

    expect(screen.getByRole("button", { name: "Hash" })).toHaveAttribute(
      "aria-current",
      "page"
    )
    expect(screen.getByRole("button", { name: "Block" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Blockchain" })).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Distributed MDAs" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Tokens / Assets" })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Land Title Use Case" })
    ).toBeInTheDocument()
    expect(screen.queryByRole("tab")).not.toBeInTheDocument()
    expect(screen.getByText("Hash a land-title record")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("button", { name: "Land Title Use Case" }))

    expect(
      await screen.findByText("Land title verification and transfer")
    ).toBeInTheDocument()
    expect(screen.getByText("Smart-contract check failed")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Land Title Use Case" })
    ).toHaveAttribute("aria-current", "page")
  })
})
