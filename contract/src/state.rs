use cosmwasm_std::{Addr, Storage};
use cosmwasm_storage::{singleton, singleton_read, ReadonlySingleton, Singleton};
use schemars::JsonSchema;
use secret_toolkit::storage::Keymap;
use serde::{Deserialize, Serialize};

pub static CONFIG_KEY: &[u8] = b"config";

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
pub struct State {
    pub count: i32,
    pub owner: Addr,
    pub acceptable_tokens: Vec<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
pub struct Transaction {
    pub amount: u128,
    pub memo: Option<String>,
}


#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
pub struct Partner {
    pub addr: Addr,
    pub percent_share: u16
}

#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq, JsonSchema)]
pub struct Code {
    pub owner: Addr,
    pub code: String,
    pub partners: Vec<Partner>,
    pub market_value: Option<u128>,
    pub recognition: String,
    pub whitelist: Vec<String>,
    pub transactions: Vec<Transaction>,
}

pub static CODE_KEY: Keymap<String, Code> = Keymap::new(b"code");

pub const PREFIX_REVOKED_PERMITS: &str = "revoked_permits";

pub fn config(storage: &mut dyn Storage) -> Singleton<State> {
    singleton(storage, CONFIG_KEY)
}

pub fn config_read(storage: &dyn Storage) -> ReadonlySingleton<State> {
    singleton_read(storage, CONFIG_KEY)
}
