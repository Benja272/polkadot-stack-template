use crate::commands::hash_input;
use clap::Subcommand;
use subxt::{OnlineClient, PolkadotConfig};
use subxt_signer::sr25519::dev;

#[derive(Subcommand)]
pub enum PalletAction {
    /// Create a proof-of-existence claim for a file or hash
    CreateClaim {
        /// The 0x-prefixed blake2b-256 hash to claim
        #[arg(group = "input")]
        hash: Option<String>,
        /// Path to a file (will be hashed with blake2b-256)
        #[arg(long, group = "input")]
        file: Option<String>,
        /// Also upload the file to the Bulletin Chain (IPFS)
        #[arg(long, requires = "file")]
        upload: bool,
    },
    /// Revoke a proof-of-existence claim
    RevokeClaim {
        /// The 0x-prefixed hash to revoke
        hash: String,
    },
    /// Get the claim details for a hash
    GetClaim {
        /// The 0x-prefixed hash to look up
        hash: String,
    },
    /// List all claims stored in the pallet
    ListClaims,
}

fn parse_hash(hex: &str) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    let hex = hex.strip_prefix("0x").unwrap_or(hex);
    if hex.len() != 64 {
        return Err("Hash must be 32 bytes (64 hex characters)".into());
    }
    Ok((0..64)
        .step_by(2)
        .map(|i| u8::from_str_radix(&hex[i..i + 2], 16))
        .collect::<Result<Vec<_>, _>>()?)
}

pub async fn run(action: PalletAction, url: &str) -> Result<(), Box<dyn std::error::Error>> {
    let api = OnlineClient::<PolkadotConfig>::from_url(url).await?;

    match action {
        PalletAction::CreateClaim { hash, file, upload } => {
            let (hash_hex, file_bytes) = hash_input(hash, file.as_deref())?;
            let hash_bytes = parse_hash(&hash_hex)?;

            if upload {
                let bytes = file_bytes.ok_or("--upload requires --file")?;
                crate::commands::upload_to_bulletin(&bytes).await?;
            }

            let signer = dev::alice();
            let tx = subxt::dynamic::tx(
                "TemplatePallet",
                "create_claim",
                vec![("hash", subxt::dynamic::Value::from_bytes(hash_bytes))],
            );
            let result = api
                .tx()
                .sign_and_submit_then_watch_default(&tx, &signer)
                .await?
                .wait_for_finalized_success()
                .await?;
            println!(
                "create_claim finalized in block: {}",
                result.extrinsic_hash()
            );
        }
        PalletAction::RevokeClaim { hash } => {
            let hash_bytes = parse_hash(&hash)?;
            let signer = dev::alice();
            let tx = subxt::dynamic::tx(
                "TemplatePallet",
                "revoke_claim",
                vec![("hash", subxt::dynamic::Value::from_bytes(hash_bytes))],
            );
            let result = api
                .tx()
                .sign_and_submit_then_watch_default(&tx, &signer)
                .await?
                .wait_for_finalized_success()
                .await?;
            println!(
                "revoke_claim finalized in block: {}",
                result.extrinsic_hash()
            );
        }
        PalletAction::GetClaim { hash } => {
            let hash_bytes = parse_hash(&hash)?;
            let storage_query = subxt::dynamic::storage(
                "TemplatePallet",
                "Claims",
                vec![subxt::dynamic::Value::from_bytes(hash_bytes)],
            );
            let result = api
                .storage()
                .at_latest()
                .await?
                .fetch(&storage_query)
                .await?;
            match result {
                Some(value) => println!("Claim: {}", value.to_value()?),
                None => println!("No claim found for this hash"),
            }
        }
        PalletAction::ListClaims => {
            let storage_query = subxt::dynamic::storage(
                "TemplatePallet",
                "Claims",
                Vec::<subxt::dynamic::Value>::new(),
            );
            let mut results = api
                .storage()
                .at_latest()
                .await?
                .iter(storage_query)
                .await?;
            let mut count = 0u32;
            while let Some(Ok(kv)) = results.next().await {
                let key_len = kv.key_bytes.len();
                println!("Hash: 0x{}", hex::encode(&kv.key_bytes[key_len - 32..]));
                println!("  Claim: {}", kv.value.to_value()?);
                count += 1;
            }
            if count == 0 {
                println!("No claims found");
            } else {
                println!("\n{count} claim(s) total");
            }
        }
    }

    Ok(())
}
