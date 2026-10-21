import type { ChatItem } from '@shared/claude-chat'
import { useAgentHistory } from '@/components/chat/useChat'

// One agent's conversation: the live stream's items when it has some, else its transcript (finished agents, terminal tiles).
export function useAgentItems(scratchId: number, agentId: string, running: boolean, live: ChatItem[], fromTranscript?: boolean): ChatItem[] {
  const history = useAgentHistory(scratchId, agentId, live.length === 0 && (!running || !!fromTranscript))
  return live.length > 0 ? live : (history ?? [])
}
