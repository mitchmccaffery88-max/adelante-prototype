// Telehealth vendor adapter. Adelante owns the EHR; this adapter is the only
// seam that talks to the integrated video vendor. Swap the mock implementation
// for a real vendor SDK without touching UI code.

export interface TelehealthRoom {
  vendor: string;
  roomId: string;
  joinUrl: string;
  expiresAt: string;
}

export interface TelehealthAdapter {
  readonly vendorName: string;
  createRoom(appointmentId: string): Promise<TelehealthRoom>;
  getJoinUrl(appointmentId: string, role: "patient" | "clinician"): string;
  endRoom(roomId: string): Promise<void>;
  ping(): Promise<{ ok: boolean; at: string }>;
}

/** MVP mock. Deterministic per appointment so join links stay stable. */
export const MockTelehealthAdapter: TelehealthAdapter = {
  vendorName: "adelante-mock-telehealth",
  async createRoom(appointmentId) {
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    return {
      vendor: this.vendorName,
      roomId: `rm_${appointmentId}`,
      joinUrl: `https://video.adelante.mock/room/${appointmentId}`,
      expiresAt: expires,
    };
  },
  getJoinUrl(appointmentId, role) {
    return `https://video.adelante.mock/room/${appointmentId}?as=${role}`;
  },
  async endRoom() {
    /* no-op in mock */
  },
  async ping() {
    return { ok: true, at: new Date().toISOString() };
  },
};