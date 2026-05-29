import { sha256Hex } from "./crypto"
import {
  GENESIS_HASH,
  MAX_MINING_NONCE,
  requiredTransferApprovals,
} from "./demo-data"
import type {
  ConsensusResult,
  DemoBlock,
  LandTitleEvent,
  MdaPeer,
  TransferApproval,
  ValidationResult,
} from "./types"

type HashableBlock = Omit<DemoBlock, "hash">

export function isBlockMined(hash: string, difficulty: number): boolean {
  return hash.startsWith("0".repeat(difficulty))
}

export async function calculateBlockHash(block: DemoBlock): Promise<string> {
  const payload: HashableBlock = {
    index: block.index,
    nonce: block.nonce,
    previousHash: block.previousHash,
    data: block.data,
  }

  return sha256Hex(payload)
}

export async function mineBlock(
  block: DemoBlock,
  difficulty: number,
  maxNonce = MAX_MINING_NONCE
): Promise<DemoBlock> {
  for (let nonce = 0; nonce <= maxNonce; nonce += 1) {
    const candidate: DemoBlock = { ...block, nonce }
    const hash = await calculateBlockHash(candidate)

    if (isBlockMined(hash, difficulty)) {
      return { ...candidate, hash }
    }
  }

  throw new Error(
    `Unable to mine block ${block.index} within ${maxNonce.toLocaleString()} nonce attempts`
  )
}

export async function createDemoChain(
  events: LandTitleEvent[],
  difficulty: number,
  maxNonce = MAX_MINING_NONCE
): Promise<DemoBlock[]> {
  const chain: DemoBlock[] = []

  for (const [index, event] of events.entries()) {
    const previousHash = index === 0 ? GENESIS_HASH : chain[index - 1].hash
    const mined = await mineBlock(
      {
        index: index + 1,
        nonce: 0,
        previousHash,
        hash: "",
        data: event,
      },
      difficulty,
      maxNonce
    )
    chain.push(mined)
  }

  return chain
}

export async function validateChain(
  chain: DemoBlock[],
  difficulty: number
): Promise<ValidationResult> {
  for (const [index, block] of chain.entries()) {
    const expectedPreviousHash = index === 0 ? GENESIS_HASH : chain[index - 1].hash
    const recalculatedHash = await calculateBlockHash(block)

    if (block.previousHash !== expectedPreviousHash) {
      return {
        valid: false,
        firstInvalidIndex: index,
        reason: `Block ${block.index} points to the wrong previous hash`,
      }
    }

    if (block.hash !== recalculatedHash) {
      return {
        valid: false,
        firstInvalidIndex: index,
        reason: `Block ${block.index} data no longer matches its hash`,
      }
    }

    if (!isBlockMined(block.hash, difficulty)) {
      return {
        valid: false,
        firstInvalidIndex: index,
        reason: `Block ${block.index} has not been mined at difficulty ${difficulty}`,
      }
    }
  }

  return { valid: true, firstInvalidIndex: null, reason: null }
}

export async function repairChainFrom(
  chain: DemoBlock[],
  startIndex: number,
  difficulty: number,
  maxNonce = MAX_MINING_NONCE
): Promise<DemoBlock[]> {
  const repaired = chain.map((block) => ({
    ...block,
    data:
      typeof block.data === "string"
        ? block.data
        : { ...block.data, details: { ...block.data.details } },
  }))

  for (let index = startIndex; index < repaired.length; index += 1) {
    const previousHash = index === 0 ? GENESIS_HASH : repaired[index - 1].hash
    repaired[index] = await mineBlock(
      {
        ...repaired[index],
        nonce: 0,
        previousHash,
        hash: "",
      },
      difficulty,
      maxNonce
    )
  }

  return repaired
}

export async function findConsensus(
  peers: MdaPeer[],
  difficulty: number
): Promise<ConsensusResult> {
  const validPeerHashes: Array<{ peerId: string; hash: string }> = []
  const invalidPeerIds: string[] = []

  for (const peer of peers) {
    const validation = await validateChain(peer.chain, difficulty)
    const lastHash = peer.chain.at(-1)?.hash

    if (!validation.valid || !lastHash) {
      invalidPeerIds.push(peer.id)
    } else {
      validPeerHashes.push({ peerId: peer.id, hash: lastHash })
    }
  }

  if (validPeerHashes.length === 0) {
    return {
      majorityHash: null,
      majorityPeerIds: [],
      outOfSyncPeerIds: peers.map((peer) => peer.id),
    }
  }

  const counts = validPeerHashes.reduce<Map<string, string[]>>((map, item) => {
    map.set(item.hash, [...(map.get(item.hash) ?? []), item.peerId])
    return map
  }, new Map())

  const [majorityHash, majorityPeerIds] = [...counts.entries()].sort(
    (a, b) => b[1].length - a[1].length
  )[0]

  return {
    majorityHash,
    majorityPeerIds,
    outOfSyncPeerIds: [
      ...invalidPeerIds,
      ...validPeerHashes
        .filter((item) => item.hash !== majorityHash)
        .map((item) => item.peerId),
    ],
  }
}

export function getMissingTransferApprovals(
  approvals: TransferApproval[],
  requiredApprovals = requiredTransferApprovals
): string[] {
  const approvedIds = new Set(
    approvals
      .filter((approval) => approval.status === "approved")
      .map((approval) => approval.id)
  )

  return requiredApprovals
    .filter((approval) => !approvedIds.has(approval.id))
    .map((approval) => approval.label)
}
