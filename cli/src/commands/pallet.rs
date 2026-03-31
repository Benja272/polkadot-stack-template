use clap::Subcommand;
use subxt::{OnlineClient, PolkadotConfig};
use subxt_signer::sr25519::dev;

#[derive(Subcommand)]
pub enum PalletAction {
    /// Get the counter value for an account (default: Alice)
    Get {
        /// Account to query (alice, bob, charlie)
        #[arg(default_value = "alice")]
        account: String,
    },
    /// Set the counter to a value (signed by Alice)
    Set {
        /// Value to set
        value: u32,
    },
    /// Increment the counter (signed by Alice)
    Increment,
}

pub async fn run(action: PalletAction, url: &str) -> Result<(), Box<dyn std::error::Error>> {
    let api = OnlineClient::<PolkadotConfig>::from_url(url).await?;

    match action {
        PalletAction::Get { account } => {
            let account_id = match account.to_lowercase().as_str() {
                "alice" => dev::alice().public_key(),
                "bob" => dev::bob().public_key(),
                "charlie" => dev::charlie().public_key(),
                _ => {
                    println!("Unknown account: {account}. Use alice, bob, or charlie.");
                    return Ok(());
                }
            };

            let storage_query = subxt::dynamic::storage(
                "TemplatePallet",
                "Counters",
                vec![subxt::dynamic::Value::from_bytes(account_id)],
            );

            let result = api
                .storage()
                .at_latest()
                .await?
                .fetch(&storage_query)
                .await?;

            match result {
                Some(value) => {
                    println!("Counter for {account}: {}", value.to_value()?);
                }
                None => {
                    println!("Counter for {account}: 0 (not set)");
                }
            }
        }
        PalletAction::Set { value } => {
            let signer = dev::alice();
            let tx = subxt::dynamic::tx(
                "TemplatePallet",
                "set_counter",
                vec![("value", subxt::dynamic::Value::u128(value as u128))],
            );

            let result = api
                .tx()
                .sign_and_submit_then_watch_default(&tx, &signer)
                .await?
                .wait_for_finalized_success()
                .await?;

            println!("set_counter({value}) finalized in block: {}", result.extrinsic_hash());
        }
        PalletAction::Increment => {
            let signer = dev::alice();
            let tx = subxt::dynamic::tx(
                "TemplatePallet",
                "increment",
                Vec::<(&str, subxt::dynamic::Value)>::new(),
            );

            let result = api
                .tx()
                .sign_and_submit_then_watch_default(&tx, &signer)
                .await?
                .wait_for_finalized_success()
                .await?;

            println!("increment() finalized in block: {}", result.extrinsic_hash());
        }
    }

    Ok(())
}
