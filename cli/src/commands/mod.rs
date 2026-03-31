pub mod chain;
pub mod contract;
pub mod pallet;

use blake2::digest::{consts::U32, Digest};
use blake2::Blake2b;
use std::fs;

type Blake2b256 = Blake2b<U32>;

const BULLETIN_RPC: &str = "https://paseo-bulletin-rpc.polkadot.io";

/// Resolve a hash from either a direct hex string or a file path.
/// Returns (hex_hash, Option<file_bytes>).
pub fn hash_input(
    hash: Option<String>,
    file: Option<&str>,
) -> Result<(String, Option<Vec<u8>>), Box<dyn std::error::Error>> {
    match (hash, file) {
        (Some(h), _) => Ok((h, None)),
        (None, Some(path)) => {
            let bytes = fs::read(path)?;
            let mut hasher = Blake2b256::new();
            hasher.update(&bytes);
            let result = hasher.finalize();
            let hex = format!("0x{}", hex::encode(result));
            println!("File: {path}");
            println!("Blake2b-256: {hex}");
            Ok((hex, Some(bytes)))
        }
        (None, None) => Err("Provide either a hash or --file <path>".into()),
    }
}

/// Upload file bytes to the Bulletin Chain via a simple JSON-RPC approach.
/// This is a simplified version — in production, use PAPI with proper signing.
pub async fn upload_to_bulletin(file_bytes: &[u8]) -> Result<(), Box<dyn std::error::Error>> {
    let max_size = 8 * 1024 * 1024;
    if file_bytes.len() > max_size {
        return Err(format!(
            "File too large ({:.1} MiB). Bulletin Chain max is 8 MiB.",
            file_bytes.len() as f64 / 1024.0 / 1024.0
        )
        .into());
    }

    println!("Uploading to Bulletin Chain ({BULLETIN_RPC})...");
    println!(
        "Note: This requires authorization on the Bulletin Chain."
    );
    println!(
        "Manage authorization at: https://paritytech.github.io/polkadot-bulletin-chain/"
    );

    // For now, print instructions — full Bulletin Chain upload requires
    // a subxt client with TransactionStorage.store() which needs the
    // Bulletin Chain metadata. This would be a separate subxt connection.
    println!();
    println!("Bulletin Chain upload from CLI is not yet fully implemented.");
    println!("Use the web frontend with the 'Upload to IPFS' toggle instead,");
    println!("or submit manually via Polkadot.js Apps:");
    println!("  1. Connect to {BULLETIN_RPC}");
    println!("  2. Developer > Extrinsics > transactionStorage > store(data)");
    println!("  3. Submit with an authorized account");

    Ok(())
}
