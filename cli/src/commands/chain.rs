use clap::Subcommand;
use subxt::{OnlineClient, PolkadotConfig};

#[derive(Subcommand)]
pub enum ChainAction {
    /// Display chain information
    Info,
    /// Subscribe to new finalized blocks
    Blocks,
}

pub async fn run(action: ChainAction, url: &str) -> Result<(), Box<dyn std::error::Error>> {
    let api = OnlineClient::<PolkadotConfig>::from_url(url).await?;

    match action {
        ChainAction::Info => {
            let genesis = api.genesis_hash();
            let runtime_version = api.runtime_version();
            println!("Chain Information");
            println!("=================");
            println!("Genesis Hash:    {genesis}");
            println!("Spec Version:    {}", runtime_version.spec_version);
            println!("TX Version:      {}", runtime_version.transaction_version);
        }
        ChainAction::Blocks => {
            println!("Subscribing to finalized blocks (Ctrl+C to stop)...");
            let mut blocks = api.blocks().subscribe_finalized().await?;
            while let Some(block) = blocks.next().await {
                let block = block?;
                println!(
                    "Block #{} - Hash: {}",
                    block.number(),
                    block.hash()
                );
            }
        }
    }

    Ok(())
}
