export type PawnStatus = 'active' | 'redeemed'
export type TransferDirection = 'me_to_mom' | 'mom_to_me'

export interface Pawn {
  id: string
  ticket_no: string
  pawn_date: string
  amount: number
  pawn_slip_url?: string
  status: PawnStatus
  notes?: string
  created_at: string
}

export interface InterestPayment {
  id: string
  pawn_id: string
  payment_date: string
  amount: number
  slip_url?: string
  note?: string
  created_at: string
}

export interface TransferSlip {
  id: string
  pawn_id: string
  direction: TransferDirection
  slip_url?: string
  amount?: number
  confirmed_at?: string
  created_at: string
}

export interface Redemption {
  id: string
  pawn_id: string
  redeem_date: string
  interest_last: number
  interest_total: number
  total_return: number
  pawn_slip_url?: string
  transfer_slip_url?: string
  created_at: string
}

export interface Notification {
  id: string
  type: string
  message: string
  is_read: boolean
  pawn_id?: string
  created_at: string
}

export interface Settings {
  id: string
  invest_budget: number
  updated_at: string
}