import { SecretNetworkClient, } from "secretjs";
import { BaseMsg } from "./interfaces/base_msg.interface";


const GAS_LIMIT = 100_000;

export default async function MsgHelper(
    secretjs: SecretNetworkClient,
    msg: BaseMsg,
    action: 'query_existence' | 'create_code' | 'query_code' | 'query_recognition' | 'sent_pix' | 'change_market_value_code' | 'try_buy_the_code'
): Promise<unknown | string> {
    try {
        switch (action) {
            case 'query_existence':
                return await secretjs.query.compute.queryContract({
                    contract_address: msg.contract_address,
                    query: msg.query,
                    code_hash: msg.code_hash,
                });
            case 'query_code':

                return await secretjs.query.compute.queryContract({
                    contract_address: msg.contract_address,
                    query: {
                        info_code: {
                            permit: msg.permit,
                            wallet: msg.sender,
                            code: msg.code
                        }
                    },
                    code_hash: msg.code_hash
                });
            case 'sent_pix':
                if (!msg.sender) {
                    throw new Error('Sender is required');
                } else if (!msg.code) {
                    throw new Error('Code is required');
                }
                return await secretjs.tx.compute.executeContract({
                    contract_address: msg.contract_address,
                    sender: msg.sender,
                    msg: {
                        sent_pix: {
                            code: msg.code,
                            memo: msg.memo,
                        }
                    },
                    code_hash: msg.code_hash,
                    sent_funds: msg.sent_funds
                }, {
                    gasLimit: GAS_LIMIT
                })
            case 'try_buy_the_code':
                if (!msg.sender) {
                    throw new Error('Sender is required');
                } else if (!msg.code) {
                    throw new Error('Code is required');
                }

                const rr = await secretjs.tx.compute.executeContract({
                    contract_address: msg.contract_address,
                    sender: msg.sender,
                    msg: {
                        try_buy_the_code: {
                            code: msg.code,
                        }
                    },
                    code_hash: msg.code_hash,
                    sent_funds: msg.sent_funds
                }, {
                    gasLimit: GAS_LIMIT
                })
                return rr
            case 'change_market_value_code':
                if (!msg.sender) {
                    throw new Error('Sender is required');
                } else if (!msg.code) {
                    throw new Error('Code is required');
                } else if (!msg.market_value) {
                    throw new Error('Market value is required');
                }

                const response = await secretjs.tx.compute.executeContract({
                    contract_address: msg.contract_address,
                    sender: msg.sender,
                    msg: {
                        change_market_value_code: {
                            code: msg.code,
                            market_value: msg.market_value.toString(10),
                        }
                    },
                    code_hash: msg.code_hash,
                    sent_funds: msg.sent_funds
                }, {
                    gasLimit: GAS_LIMIT
                })



                if (response.code != 0) {
                    throw new Error("Error while changing market value")
                }

                return response

            case 'query_recognition':
                const recognition = await secretjs.query.compute.queryContract({
                    contract_address: msg.contract_address,
                    query: {
                        code_recognition: {
                            code: msg.code
                        }
                    },
                    code_hash: msg.code_hash
                });
                return { recognition };
            case 'create_code':
                if (!msg.sender) {
                    throw new Error('Sender is required');
                } else if (!msg.code) {
                    throw new Error('Code is required');
                } else if (!msg.recognition) {
                    throw new Error('Recognition is required');
                }
                return await secretjs.tx.compute.executeContract({
                    contract_address: msg.contract_address,
                    sender: msg.sender,
                    msg: {
                        create_code: {
                            code: {
                                owner: msg.sender,
                                code: msg.code,
                                recognition: msg.recognition,
                                whitelist: [
                                    msg.sender
                                ],
                                partners: [],
                                transactions: [],
                            }
                        }
                    },
                    sent_funds: msg.sent_funds
                }, {
                    gasLimit: GAS_LIMIT
                });
            default:
                throw new Error(`Unknown action: ${action}`);
        }
    } catch (error: any) {
        return error.message;
    }
}
