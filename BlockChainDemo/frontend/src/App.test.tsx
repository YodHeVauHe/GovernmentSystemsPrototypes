import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import App from "./App"

describe("BlockChainDemo app", () => {
  it("renders the six concept tabs and switches to the land-title use case", async () => {
    render(<App />)

    expect(screen.getByRole("tab", { name: "Hash" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Block" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Blockchain" })).toBeInTheDocument()
    expect(
      screen.getByRole("tab", { name: "Distributed MDAs" })
    ).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Tokens / Assets" })).toBeInTheDocument()
    expect(
      screen.getByRole("tab", { name: "Land Title Use Case" })
    ).toBeInTheDocument()

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Land Title Use Case" }), {
      button: 0,
      ctrlKey: false,
    })

    expect(
      await screen.findByText("Land title verification and transfer")
    ).toBeInTheDocument()
    expect(screen.getByText("Smart-contract check failed")).toBeInTheDocument()
  })
})
