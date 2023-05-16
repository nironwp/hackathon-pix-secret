use cosmwasm_std::StdError;
use thiserror::Error;

#[derive(Error, Debug, PartialEq)]
pub enum ContractError {
    #[error("{0}")]
    // let thiserror implement From<StdError> for you
    Std(#[from] StdError),

    #[error("Unauthorized")]
    // issued when message sender != owner
    Unauthorized {},

    #[error("you need to pay the registration fee to proceed which is currently {value:?} scrts")]
    Unpayed { value: u128 },

    #[error("Invalid partner share {value:?} must be between 1 and 100")]
    InvalidPartnerShare {
        // issued when partner share is invalid
        value: u16,
    },

    #[error("You have not provided the amount required to make this purchase.")]
    InsufficientFunds {},
    #[error("Code not found")]
    // issued when code not found
    CodeNotFound {},

    #[error("Invalid funs send in the request, only accept {values:?}")]
    InvalidFunds { values: Vec<String> },

    #[error("Code already exists")]
    // issued when code already exists
    CodeAlreadyExists {},

    #[error("Custom Error val: {val:?}")]
    CustomError { val: String },
    // Add any other custom errors you like here.
    // Look at https://docs.rs/thiserror/1.0.21/thiserror/ for details.
}
