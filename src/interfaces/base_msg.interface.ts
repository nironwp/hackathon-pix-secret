import { Permit } from "secretjs";
import { Funds } from "./funds.interface";

export interface BaseMsg {
    sent_funds: Funds[],
    query?: any,
    code_hash: string,
    contract_address: string,
    sender?: string
    code?: string
    market_value?: number
    memo?: string
    recognition?: string,
    permit?: Permit
}