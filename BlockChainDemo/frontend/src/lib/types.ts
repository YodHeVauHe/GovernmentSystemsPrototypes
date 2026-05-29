export type LandTitleEventType =
  | "TITLE_ISSUED"
  | "CAVEAT_LODGED"
  | "STAMP_DUTY_ASSESSED"
  | "IDENTITY_VERIFIED"
  | "TITLE_TRANSFERRED"

export type LandTitleEvent = {
  eventType: LandTitleEventType
  titleNumber: string
  parcelId: string
  actorMda: string
  reference: string
  timestamp: string
  details: Record<string, string>
}

export type AssetTransfer = {
  assetId: string
  fromOwnerReference: string
  toOwnerReference: string
  approvalReferences: string[]
}

export type DemoBlock = {
  index: number
  nonce: number
  previousHash: string
  hash: string
  data: string | LandTitleEvent
}

export type MdaPeer = {
  id: string
  name: string
  role: string
  chain: DemoBlock[]
}

export type ValidationResult = {
  valid: boolean
  firstInvalidIndex: number | null
  reason: string | null
}

export type ConsensusResult = {
  majorityHash: string | null
  majorityPeerIds: string[]
  outOfSyncPeerIds: string[]
}

export type TransferApproval = {
  id: string
  label: string
  mda: string
  reference: string
  status: "approved" | "pending" | "missing"
}
