import { useEffect, useState } from "react"
import { Network } from "lucide-react"
import { PeerChain } from "@/components/blockchain/PeerChain"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { findConsensus, createDemoChain, validateChain } from "@/lib/blockchain"
import {
  DEMO_DIFFICULTY,
  MDA_PEER_IDS,
  initialLandTitleEvents,
  mdaPeerTemplates,
} from "@/lib/demo-data"
import type {
  ConsensusResult,
  DemoBlock,
  LandTitleEvent,
  MdaPeer,
  ValidationResult,
} from "@/lib/types"

function cloneChain(chain: DemoBlock[]) {
  return chain.map((block) => ({
    ...block,
    data:
      typeof block.data === "string"
        ? block.data
        : { ...block.data, details: { ...block.data.details } },
  }))
}

export function DistributedPage() {
  const [peers, setPeers] = useState<MdaPeer[]>([])
  const [consensus, setConsensus] = useState<ConsensusResult | null>(null)
  const [validations, setValidations] = useState<Record<string, ValidationResult>>(
    {}
  )

  useEffect(() => {
    createDemoChain(initialLandTitleEvents, DEMO_DIFFICULTY).then((chain) => {
      setPeers(
        mdaPeerTemplates.map((peer) => ({
          ...peer,
          chain: cloneChain(chain),
        }))
      )
    })
  }, [])

  useEffect(() => {
    if (peers.length === 0) return

    Promise.all(peers.map((peer) => validateChain(peer.chain, DEMO_DIFFICULTY))).then(
      (results) => {
        setValidations(
          peers.reduce<Record<string, ValidationResult>>((map, peer, index) => {
            map[peer.id] = results[index]
            return map
          }, {})
        )
      }
    )
    findConsensus(peers, DEMO_DIFFICULTY).then(setConsensus)
  }, [peers])

  const tamperUra = () => {
    setPeers((currentPeers) =>
      currentPeers.map((peer) => {
        if (peer.id !== MDA_PEER_IDS.ura) return peer
        const chain = cloneChain(peer.chain)
        const target = chain[4]
        chain[4] = {
          ...target,
          data: {
            ...(target.data as LandTitleEvent),
            details: {
              ...(target.data as LandTitleEvent).details,
              newOwnerReference: "OWNER-REF-UNAUTHORIZED",
            },
          },
        }
        return { ...peer, chain }
      })
    )
  }

  const [resyncingPeerId, setResyncingPeerId] = useState<string | null>(null)

  const resyncPeer = async (peerId: string) => {
    setResyncingPeerId(peerId)
    await new Promise((resolve) => setTimeout(resolve, 1200))
    setPeers((currentPeers) => {
      const source =
        currentPeers.find((peer) => consensus?.majorityPeerIds.includes(peer.id)) ??
        currentPeers[0]
      return currentPeers.map((peer) =>
        peer.id === peerId ? { ...peer, chain: cloneChain(source.chain) } : peer
      )
    })
    setResyncingPeerId(null)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-border bg-card px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <div className="mb-1 flex items-center gap-2 text-sm font-medium text-foreground">
          <Network className="size-4 text-primary" />
          <span>P2P Network & Byzantium Consensus</span>
        </div>
        <p>
          In a distributed government network, Ministry nodes maintain exact matching copies of the blockchain state. <strong>Try tampering with URA node records</strong> below: the network instantly isolates URA due to state mismatch. Click <strong>"Resync Node"</strong> to pull consensus records from Ministry majority and restore symmetry.
        </p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {peers.map((peer) => (
          <PeerChain
            key={peer.id}
            peer={peer}
            validation={validations[peer.id] ?? null}
            outOfSync={consensus?.outOfSyncPeerIds.includes(peer.id) ?? false}
            isResyncing={resyncingPeerId === peer.id}
            onTamper={peer.id === MDA_PEER_IDS.ura ? tamperUra : undefined}
            onResync={
              consensus?.outOfSyncPeerIds.includes(peer.id)
                ? () => resyncPeer(peer.id)
                : undefined
            }
          />
        ))}
      </div>
    </div>
  )
}
