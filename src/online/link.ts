// The connection to the other player: introduced by the server over a WebSocket,
// then a direct WebRTC data channel between the two browsers. Green offers, Red
// answers. Re-pairing after a drop makes a new data channel on the same socket.

import { wsUrl, type Identity } from './api';
import type { ClientMsg, PeerMsg, ServerMsg } from './protocol';

/** Public STUN servers: enough for most home networks (no relay yet). */
const ICE_SERVERS: RTCIceServer[] = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
/** Give up on a direct connection after this long. */
export const CONNECT_TIMEOUT_MS = 15_000;

export interface LinkEvents {
  /** The server paired us with the other player (each time, on rejoins too). */
  paired: (m: Extract<ServerMsg, { t: 'paired' }>) => void;
  /** The direct channel is open. */
  open: () => void;
  message: (m: PeerMsg) => void;
  /** The direct channel (or the other player's socket) closed. */
  lost: () => void;
  /** Couldn't connect directly, or the server refused. */
  failed: (why: string) => void;
}

export class Link {
  private ws: WebSocket;
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private side: 0 | 1 = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private pendingIce: RTCIceCandidateInit[] = [];

  constructor(
    id: Identity,
    private gameId: string,
    private on: LinkEvents,
  ) {
    this.ws = new WebSocket(wsUrl(`/ws?playerId=${encodeURIComponent(id.playerId)}&key=${encodeURIComponent(id.key)}`));
    this.ws.onopen = () => this.toServer({ t: 'join', gameId });
    this.ws.onmessage = (e) => this.fromServer(JSON.parse(String(e.data)));
    this.ws.onclose = () => {
      if (!this.closed) this.on.failed('Lost the connection to the server');
    };
    this.ws.onerror = () => {
      if (!this.closed) this.on.failed('Could not reach the server');
    };
  }

  get open(): boolean {
    return this.dc?.readyState === 'open';
  }

  send(m: PeerMsg) {
    if (this.dc?.readyState === 'open') this.dc.send(JSON.stringify(m));
  }

  /** Ask the server to pair us again (it does once both players are there): rebuilds the direct channel. */
  repair() {
    this.toServer({ t: 'join', gameId: this.gameId });
  }

  close() {
    this.closed = true;
    this.dropPeer();
    this.ws.close();
  }

  private toServer(m: ClientMsg) {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
  }

  private async fromServer(m: ServerMsg) {
    if (m.t === 'error') return this.on.failed(m.message);
    if (m.t === 'opponent-left') return this.on.lost();
    if (m.t === 'paired') {
      this.side = m.side;
      this.on.paired(m);
      this.startPeer();
      return;
    }
    if (m.t === 'signal') await this.signal(m.data as { sdp?: RTCSessionDescriptionInit; ice?: RTCIceCandidateInit });
  }

  private dropPeer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.dc?.close();
    this.pc?.close();
    this.dc = null;
    this.pc = null;
    this.pendingIce = [];
  }

  private startPeer() {
    this.dropPeer();
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    this.pc = pc;
    pc.onicecandidate = (e) => e.candidate && this.toServer({ t: 'signal', data: { ice: e.candidate.toJSON() } });
    pc.onconnectionstatechange = () => {
      if (pc !== this.pc) return;
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected' || pc.connectionState === 'closed') this.on.lost();
    };
    const wire = (dc: RTCDataChannel) => {
      this.dc = dc;
      dc.onopen = () => {
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
        this.on.open();
      };
      dc.onmessage = (e) => this.on.message(JSON.parse(String(e.data)));
      dc.onclose = () => dc === this.dc && this.on.lost();
    };
    if (this.side === 0) {
      wire(pc.createDataChannel('magica', { ordered: true }));
      void pc
        .createOffer()
        .then((o) => pc.setLocalDescription(o))
        .then(() => this.toServer({ t: 'signal', data: { sdp: pc.localDescription!.toJSON() } }));
    } else pc.ondatachannel = (e) => wire(e.channel);
    this.timer = setTimeout(() => {
      if (pc === this.pc && !this.open) this.on.failed("Couldn't connect directly to the other player");
    }, CONNECT_TIMEOUT_MS);
  }

  private async signal(data: { sdp?: RTCSessionDescriptionInit; ice?: RTCIceCandidateInit }) {
    const pc = this.pc;
    if (!pc) return;
    if (data.sdp) {
      await pc.setRemoteDescription(data.sdp);
      for (const c of this.pendingIce.splice(0)) await pc.addIceCandidate(c).catch(() => {});
      if (data.sdp.type === 'offer') {
        await pc.setLocalDescription(await pc.createAnswer());
        this.toServer({ t: 'signal', data: { sdp: pc.localDescription!.toJSON() } });
      }
    } else if (data.ice) {
      if (pc.remoteDescription) await pc.addIceCandidate(data.ice).catch(() => {});
      else this.pendingIce.push(data.ice);
    }
  }
}
