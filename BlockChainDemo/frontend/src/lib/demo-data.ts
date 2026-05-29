import type { LandTitleEvent, MdaPeer, TransferApproval } from "./types"

export const DEMO_DIFFICULTY = 2
export const MAX_MINING_NONCE = 150_000

export const GENESIS_HASH =
  "0000000000000000000000000000000000000000000000000000000000000000"

export const sampleParcelPayload = {
  titleNumber: "TITLE-KLA-2026-000184",
  parcelId: "PARCEL-KCCA-CEN-12-0441",
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
    parcelId: "PARCEL-KCCA-CEN-12-0441",
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
    parcelId: "PARCEL-KCCA-CEN-12-0441",
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
    parcelId: "PARCEL-KCCA-CEN-12-0441",
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
    parcelId: "PARCEL-KCCA-CEN-12-0441",
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
    parcelId: "PARCEL-KCCA-CEN-12-0441",
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
    id: "lands-title-confirmation",
    label: "Ministry of Lands title confirmation",
    mda: "Ministry of Lands, Housing and Urban Development",
    reference: "MOLHUD-APPROVAL-2026-05-29-01422",
    status: "approved",
  },
  {
    id: "ura-stamp-duty",
    label: "URA stamp duty clearance",
    mda: "Uganda Revenue Authority",
    reference: "URA-STAMP-2026-05-29-00672",
    status: "approved",
  },
  {
    id: "nira-identity",
    label: "NIRA identity verification",
    mda: "National Identification and Registration Authority",
    reference: "NIRA-VERIFY-2026-05-29-00941",
    status: "approved",
  },
  {
    id: "local-land-office",
    label: "Local government land office clearance",
    mda: "Local Government Land Office",
    reference: "KCCA-CAVEAT-2026-05-29-00318",
    status: "approved",
  },
]

export const mdaPeerTemplates: Omit<MdaPeer, "chain">[] = [
  {
    id: "molhud",
    name: "Ministry of Lands",
    role: "Title authority and registry steward",
  },
  {
    id: "nira",
    name: "NIRA",
    role: "Identity verification peer",
  },
  {
    id: "ura",
    name: "URA",
    role: "Stamp duty and tax authority peer",
  },
  {
    id: "local-office",
    name: "Local Government Land Office",
    role: "Jurisdiction and caveat verification peer",
  },
]
