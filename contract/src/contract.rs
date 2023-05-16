use crate::error::ContractError;
use crate::msg::{CodeExistenceResponse, ExecuteMsg, InfoCodeResponse, InstantiateMsg, QueryMsg};
use crate::state::{
    config, config_read, Code, State, Transaction, CODE_KEY, PREFIX_REVOKED_PERMITS,
};
use cosmwasm_std::{
    entry_point, to_binary, Addr, BankMsg, Binary, Coin, CosmosMsg, Deps, DepsMut, Env,
    MessageInfo, Response, StdError, StdResult, Uint128,
};
use secret_toolkit::permit::{validate, Permit};

#[entry_point]
pub fn instantiate(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: InstantiateMsg,
) -> Result<Response, StdError> {
    let state = State {
        count: msg.count,
        owner: info.sender.clone(),
        acceptable_tokens: msg.acceptable_tokens,
    };

    config(deps.storage).save(&state)?;

    deps.api
        .debug(&format!("Contract was initialized by {}", info.sender));

    Ok(Response::default())
}

#[entry_point]
pub fn execute(
    deps: DepsMut,
    _env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    match msg {
        ExecuteMsg::CreateCode { code } => try_create_code(deps, info, code),
        ExecuteMsg::SentPix { code, memo } => try_sent_pix(deps, info, memo, code),
        ExecuteMsg::ChangeMarketValueCode { code, market_value } => {
            try_change_value_code(deps, info, market_value, code)
        }
        ExecuteMsg::TryBuyTheCode { code } => try_buy_the_code(deps, info, code),
    }
}

pub fn try_create_code(
    deps: DepsMut,
    info: MessageInfo,
    code: Code,
) -> Result<Response, ContractError> {
    let mut payed: bool = false;
    let state = config_read(deps.storage).load().unwrap();

    let code_exists = CODE_KEY.get(deps.storage, &code.code);

    match code_exists {
        Some(_) => {
            return Err(ContractError::Unauthorized {});
        }
        None => {}
    }

    let messages: Vec<CosmosMsg> = info
        .funds
        .iter()
        .map(|coin| {
            let message = BankMsg::Send {
                to_address: state.owner.to_string(),
                amount: vec![coin.clone()],
            };

            if coin.denom == "uscrt" && coin.amount >= Uint128::from(5000000 as u64) {
                payed = true;
            }

            CosmosMsg::Bank(message)
        })
        .collect();

    if !payed {
        return Err(ContractError::Unpayed {
            value: Uint128::from(5000000 as u64 / 1000000 as u64).into(),
        });
    }

    for partner in code.partners.iter() {
        if partner.percent_share > 100 || partner.percent_share < 1 {
            return Err(ContractError::InvalidPartnerShare {
                value: partner.percent_share,
            });
        }
    }

    let total_shared = code
        .partners
        .iter()
        .map(|partner| partner.percent_share)
        .sum::<u16>();

    if total_shared > 100 {
        return Err(ContractError::InvalidPartnerShare {
            value: total_shared,
        });
    }

    let response = Response::new().add_messages(messages).add_attribute(
        "message".to_string(),
        "Code created successfully".to_string(),
    );

    CODE_KEY.insert(deps.storage, &code.code, &code)?;
    Ok(response)
}

pub fn try_sent_pix(
    deps: DepsMut,
    info: MessageInfo,
    memo: Option<String>,
    code: String,
) -> Result<Response, ContractError> {
    if let Some(mut code) = CODE_KEY.get(deps.storage, &code) {
        let message_owner: Vec<CosmosMsg> = info
            .funds
            .iter()
            .map(|coin| {
                let percentage_left_for_owner = 100
                    - code
                        .partners
                        .iter()
                        .map(|partner| partner.percent_share)
                        .sum::<u16>();

                let owner_coin = Coin {
                    denom: coin.denom.clone(),
                    amount: (u128::from(coin.amount) * percentage_left_for_owner as u128 / 100)
                        .into(),
                };

                let message = BankMsg::Send {
                    to_address: code.owner.to_string(),
                    amount: vec![owner_coin.clone()],
                };

                let transaction = Transaction {
                    amount: coin.amount.into(),
                    memo: memo.clone(),
                };
                code.transactions.push(transaction);
                CosmosMsg::Bank(message)
            })
            .collect();

        let mut messages_partner: Vec<CosmosMsg> = Vec::new();

        for fund in info.funds.iter() {
            for partner in code.partners.iter() {
                let partner_coin = Coin {
                    denom: fund.denom.clone(),
                    amount: (u128::from(fund.amount) * partner.percent_share as u128 / 100).into(),
                };

                let message = BankMsg::Send {
                    to_address: partner.addr.to_string(),
                    amount: vec![partner_coin.clone()],
                };

                let transaction = Transaction {
                    amount: fund.amount.into(),
                    memo: memo.clone(),
                };
                code.transactions.push(transaction);
                messages_partner.push(CosmosMsg::Bank(message));
            }
        }

        CODE_KEY
            .insert(deps.storage, &code.code, &code)
            .map_err(|e| {
                ContractError::Std(StdError::generic_err(format!(
                    "failed to update code details: {}",
                    e
                )))
            })?;
        let response = Response::new()
            .add_messages(message_owner)
            .add_messages(messages_partner)
            .add_attribute("action", "pix")
            .add_attribute("sender", info.sender.to_string())
            .add_attribute("code", code.code);
        Ok(response)
    } else {
        Err(ContractError::CodeNotFound {})
    }
}

pub fn try_change_value_code(
    deps: DepsMut,
    info: MessageInfo,
    market_value: u128,
    code: String,
) -> Result<Response, ContractError> {
    let code_exists = CODE_KEY.get(deps.storage, &code);
    match code_exists {
        Some(code) => {
            if code.owner != info.sender {
                return Err(ContractError::Unauthorized {});
            }

            let mut code = code;
            code.market_value = Some(market_value);

            CODE_KEY
                .insert(deps.storage, &code.code, &code)
                .map_err(|e| {
                    ContractError::Std(StdError::generic_err(format!(
                        "failed to update code details: {}",
                        e
                    )))
                })?;

            Ok(Response::default())
        }
        None => Err(ContractError::CodeNotFound {}),
    }
}

pub fn try_buy_the_code(
    deps: DepsMut,
    info: MessageInfo,
    code: String,
) -> Result<Response, ContractError> {
    if let Some(mut code) = CODE_KEY.get(deps.storage, &code) {
        if code.owner == info.sender {
            return Err(ContractError::Unauthorized {});
        }

        let mut messages: Vec<CosmosMsg> = Vec::new();

        let mut total_amount = Uint128::zero();

        for coin in info.funds.iter() {
            if coin.denom == "uscrt" {
                total_amount += coin.amount;
            }
        }

        if total_amount < code.market_value.unwrap().into() {
            return Err(ContractError::InsufficientFunds {});
        }

        let mut owner_coin = Coin {
            denom: "uscrt".to_string(),
            amount: Uint128::zero(),
        };

        for coin in info.funds.iter() {
            if coin.denom == "uscrt" {
                owner_coin.amount += coin.amount;
            } else {
                let message = BankMsg::Send {
                    to_address: code.owner.to_string(),
                    amount: vec![coin.clone()],
                };

                messages.push(CosmosMsg::Bank(message));
            }
        }

        let message = BankMsg::Send {
            to_address: code.owner.to_string(),
            amount: vec![owner_coin.clone()],
        };

        messages.push(CosmosMsg::Bank(message));

        let transaction = Transaction {
            amount: owner_coin.amount.into(),
            memo: None,
        };
        code.transactions.push(transaction);

        let response = Response::new()
            .add_messages(messages)
            .add_attribute("action", "buy")
            .add_attribute("sender", info.sender.to_string())
            .add_attribute("code", code.code.clone());

        code.owner = info.sender;
        code.whitelist = Vec::new();
        code.market_value= None;
        code.transactions = Vec::new();

        CODE_KEY
            .insert(deps.storage, &code.code, &code)
            .map_err(|e| {
                ContractError::Std(StdError::generic_err(format!(
                    "failed to update code details: {}",
                    e
                )))
            })?;

        Ok(response)
    } else {
        Err(ContractError::CodeNotFound {})
    }
}

#[entry_point]
pub fn query(deps: Deps, env: Env, msg: QueryMsg) -> StdResult<Binary> {
    match msg {
        QueryMsg::InfoCode {
            permit,
            wallet,
            code,
        } => to_binary(&query_code(deps, env, wallet, permit, code)?),
        QueryMsg::CodeExists { code } => to_binary(&query_code_exists(deps, code)?),
        QueryMsg::CodeRecognition { code } => to_binary(&query_code_recognition(deps, code)?),
    }
}

pub fn query_code_recognition(deps: Deps, code: String) -> StdResult<String> {
    let code_exists = CODE_KEY.get(deps.storage, &code);
    match code_exists {
        Some(code) => return Ok(code.recognition),
        None => return Err(StdError::generic_err("Code not found")),
    }
}

pub fn query_code_exists(deps: Deps, code: String) -> StdResult<CodeExistenceResponse> {
    let code_exists = CODE_KEY.get(deps.storage, &code);
    match code_exists {
        Some(code) => {
            return Ok(CodeExistenceResponse {
                exists: true,
                market_value: code.market_value,
            })
        }
        None => {
            return Ok(CodeExistenceResponse {
                exists: false,
                market_value: None,
            })
        }
    }
}

pub fn query_code(
    deps: Deps,
    env: Env,
    wallet: Addr,
    permit: Permit,
    code: String,
) -> StdResult<InfoCodeResponse> {
    let contract_address = env.contract.address;
    let viewer = validate(
        deps,
        PREFIX_REVOKED_PERMITS,
        &permit,
        contract_address.to_string(),
        None,
    )?;
    let code_exists = CODE_KEY.get(deps.storage, &code);
    match code_exists {
        Some(code) => {
            if code.whitelist.contains(&viewer) || &code.owner == &wallet {
                Ok(InfoCodeResponse { code: code })
            } else {
                Err(StdError::generic_err("Not authorized"))
            }
        }
        None => Err(StdError::generic_err("Need query permit!")),
    }
}
