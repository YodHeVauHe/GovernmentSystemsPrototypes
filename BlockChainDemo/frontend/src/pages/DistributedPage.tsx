import { useEffect, useState } from "react"
import { PeerChain } from "@/components/blockchain/PeerChain"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { findConsensus, createDemoChain, validateChain } from "@/lib/blockchain"
import {
  DEMO_DIFFICULTY,
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
        if (peer.id !== "ura") return peer
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

  const resyncPeer = (peerId: string) => {
    setPeers((currentPeers) => {
      const source =
        currentPeers.find((peer) => consensus?.majorityPeerIds.includes(peer.id)) ??
        currentPeers[0]
      return currentPeers.map((peer) =>
        peer.id === peerId ? { ...peer, chain: cloneChain(source.chain) } : peer
      )
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Alert>
        <AlertTitle>MDA peers hold matching chain copies</AlertTitle>
        <AlertDescription>
          Tamper with the URA peer to show how one altered copy falls out of
          consensus while the other MDA nodes retain the valid chain.
        </AlertDescription>
      </Alert>
      <div className="grid gap-4 xl:grid-cols-2">
        {peers.map((peer) => (
          <PeerChain
            key={peer.id}
            peer={peer}
            validation={validations[peer.id] ?? null}
            outOfSync={consensus?.outOfSyncPeerIds.includes(peer.id) ?? false}
            onTamper={peer.id === "ura" ? tamperUra : undefined}
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
