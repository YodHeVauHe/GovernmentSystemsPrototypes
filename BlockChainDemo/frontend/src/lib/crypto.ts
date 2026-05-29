type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

const encoder = new TextEncoder()

export function canonicalize(value: unknown): string {
  return JSON.stringify(sortValue(value as JsonValue))
}

function sortValue(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item))
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, JsonValue>>((sorted, key) => {
        sorted[key] = sortValue(value[key])
        return sorted
      }, {})
  }

  return value
}

export async function sha256Hex(value: unknown): Promise<string> {
  const text = typeof value === "string" ? value : canonicalize(value)

  if (!globalThis.crypto?.subtle) {
    throw new Error("SHA-256 is unavailable in this runtime")
  }

  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    encoder.encode(text)
  )

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}
