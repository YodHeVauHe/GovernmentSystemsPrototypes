import type { LandTitleEvent, MdaPeer, TransferApproval } from "./types"

export const DEMO_DIFFICULTY = 2
export const MAX_MINING_NONCE = 150_000

export const GENESIS_HASH =
  "0000000000000000000000000000000000000000000000000000000000000000"

export const TRANSFER_APPROVAL_IDS = {
  landsTitleConfirmation:
    "3d5b2df0f2a7d80d7f5da06b383e7f19d47b0a81cb17e351fe33e4a2f79b5b9a",
  uraStampDuty:
    "8f6adf682e14d3d6333aaeb52d519c30f311fdf3a1c847f2e67407f8f71a3f0d",
  niraIdentity:
    "c0f72918e91d20f4b870d9a0ecab1e0f9d2422cf91fda198938a8f756a07a442",
  localLandOffice:
    "e4f184718f84b7615bbf468dc845ac4eeb7e7d7a8c0b4b7a62a55014f8f9de2c",
} as const

export const MDA_PEER_IDS = {
  molhud:
    "4d9cb44e6866e8c5f7dcff57a3d2b888e6c3028713a3e4f271f70bcb048a95c4",
  nira: "738bb8d23355d21a69e8b75d6e18bfbd343930f9a78c35a182eaf52eb7971f14",
  ura: "9d1706784d22f7e53368e8de03fc38c81c4a80d2b8744e6f20915ec6a76ff5ea",
  localOffice:
    "f37c3d0f8e2e9cbf2f1cda64e9f3b3b6ac8c7f4057cddf565e1772a55a841f35",
} as const

export const LAND_TITLE_ASSET_ID =
  "bbd14a72f39c0a847af4d03786a3e8f0d9b49d2f62b28f865fbc9d338cb6d620"

export const sampleParcelPayload = {
  titleNumber: "TITLE-KLA-2026-000184",
  parcelId: LAND_TITLE_ASSET_ID,
  district: "Kampala",
  division: "Kampala Central Division",
  ownerReference: "OWNER-REF-AF3D91",
  issuingOffice: "Ministry of Lands, Housing and Urban Development",
  registryReference: "MOLHUD-REG-2026-05-29-01422",
}

export const initialLandTitleEvents: LandTitleEvent[] = [
  {
    eventType: "TITLE_ISSUED",
    titleNumber: "TITLE-KLA-2026-000184",
    parcelId: LAND_TITLE_ASSET_ID,
    actorMda: "Ministry of Lands, Housing and Urban Development",
    reference: "MOLHUD-APPROVAL-2026-05-29-01422",
    timestamp: "2026-05-29T08:30:00+03:00",
    details: {
      district: "Kampala",
      division: "Kampala Central Division",
      ownerReference: "OWNER-REF-AF3D91",
      titleStatus: "Active",
    },
  },
  {
    eventType: "CAVEAT_LODGED",
    titleNumber: "TITLE-KLA-2026-000184",
    parcelId: LAND_TITLE_ASSET_ID,
    actorMda: "Local Government Land Office",
    reference: "KCCA-CAVEAT-2026-05-29-00318",
    timestamp: "2026-05-29T09:10:00+03:00",
    details: {
      caveatStatus: "No active caveat",
      jurisdiction: "Kampala Capital City Authority",
      inspectionReference: "KCCA-LAND-INSPECT-2026-0217",
    },
  },
  {
    eventType: "STAMP_DUTY_ASSESSED",
    titleNumber: "TITLE-KLA-2026-000184",
    parcelId: LAND_TITLE_ASSET_ID,
    actorMda: "Uganda Revenue Authority",
    reference: "URA-STAMP-2026-05-29-00672",
    timestamp: "2026-05-29T10:20:00+03:00",
    details: {
      assessedAmount: "UGX 3,500,000",
      dutyStatus: "Assessed",
      paymentReference: "URA-PAY-REF-772941",
    },
  },
  {
    eventType: "IDENTITY_VERIFIED",
    titleNumber: "TITLE-KLA-2026-000184",
    parcelId: LAND_TITLE_ASSET_ID,
    actorMda: "National Identification and Registration Authority",
    reference: "NIRA-VERIFY-2026-05-29-00941",
    timestamp: "2026-05-29T11:15:00+03:00",
    details: {
      buyerReference: "CITIZEN-REF-19E8B2",
      sellerReference: "OWNER-REF-AF3D91",
      verificationResult: "Matched",
    },
  },
  {
    eventType: "TITLE_TRANSFERRED",
    titleNumber: "TITLE-KLA-2026-000184",
    parcelId: LAND_TITLE_ASSET_ID,
    actorMda: "Ministry of Lands, Housing and Urban Development",
    reference: "MOLHUD-TRANSFER-2026-05-29-02044",
    timestamp: "2026-05-29T13:45:00+03:00",
    details: {
      previousOwnerReference: "OWNER-REF-AF3D91",
      newOwnerReference: "OWNER-REF-6C20D4",
      transferStatus: "Complete",
    },
  },
]

export const requiredTransferApprovals: TransferApproval[] = [
  {
    id: TRANSFER_APPROVAL_IDS.landsTitleConfirmation,
    label: "Ministry of Lands title confirmation",
    mda: "Ministry of Lands, Housing and Urban Development",
    reference: "MOLHUD-APPROVAL-2026-05-29-01422",
    status: "approved",
  },
  {
    id: TRANSFER_APPROVAL_IDS.uraStampDuty,
    label: "URA stamp duty clearance",
    mda: "Uganda Revenue Authority",
    reference: "URA-STAMP-2026-05-29-00672",
    status: "approved",
  },
  {
    id: TRANSFER_APPROVAL_IDS.niraIdentity,
    label: "NIRA identity verification",
    mda: "National Identification and Registration Authority",
    reference: "NIRA-VERIFY-2026-05-29-00941",
    status: "approved",
  },
  {
    id: TRANSFER_APPROVAL_IDS.localLandOffice,
    label: "Local government land office clearance",
    mda: "Local Government Land Office",
    reference: "KCCA-CAVEAT-2026-05-29-00318",
    status: "approved",
  },
]

export const mdaPeerTemplates: Omit<MdaPeer, "chain">[] = [
  {
    id: MDA_PEER_IDS.molhud,
    name: "Ministry of Lands",
    role: "Title authority and registry steward",
  },
  {
    id: MDA_PEER_IDS.nira,
    name: "NIRA",
    role: "Identity verification peer",
  },
  {
    id: MDA_PEER_IDS.ura,
    name: "URA",
    role: "Stamp duty and tax authority peer",
  },
  {
    id: MDA_PEER_IDS.localOffice,
    name: "Local Government Land Office",
    role: "Jurisdiction and caveat verification peer",
  },
]
