import { Partner } from "./partner.interface";
import { Transaction } from "./transaction.interface";

export interface Code {
    code: string;
    market_value: null | number
    owner: string
    partners: Partner[]
    recognition: string
    transactions: Transaction[]
    whitelist: string[]
}