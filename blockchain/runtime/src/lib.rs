#![cfg_attr(not(feature = "std"), no_std)]
#![recursion_limit = "256"]

#[cfg(feature = "std")]
include!(concat!(env!("OUT_DIR"), "/wasm_binary.rs"));

pub mod apis;
#[cfg(feature = "runtime-benchmarks")]
mod benchmarks;
pub mod configs;
mod genesis_config_presets;
mod weights;

extern crate alloc;
use alloc::vec::Vec;
use smallvec::smallvec;

use polkadot_sdk::{staging_parachain_info as parachain_info, *};

use sp_runtime::{
	generic, impl_opaque_keys,
	traits::{BlakeTwo256, IdentifyAccount, Verify},
	MultiSignature,
};

#[cfg(feature = "std")]
use sp_version::NativeVersion;
use sp_version::RuntimeVersion;

use frame_support::weights::{
	constants::WEIGHT_REF_TIME_PER_SECOND, Weight, WeightToFeeCoefficient, WeightToFeeCoefficients,
	WeightToFeePolynomial,
};
pub use genesis_config_presets::PARACHAIN_ID;
pub use sp_consensus_aura::sr25519::AuthorityId as AuraId;
pub use sp_runtime::{MultiAddress, Perbill, Permill};

use weights::ExtrinsicBaseWeight;

/// Alias to 512-bit hash when used in the context of a transaction signature on the chain.
pub type Signature = MultiSignature;

/// Some way of identifying an account on the chain.
pub type AccountId = <<Signature as Verify>::Signer as IdentifyAccount>::AccountId;

/// Balance of an account.
pub type Balance = u128;

/// Index of a transaction in the chain.
pub type Nonce = u32;

/// A hash of some data used by the chain.
pub type Hash = sp_core::H256;

/// An index to a block.
pub type BlockNumber = u32;

/// The address format for describing accounts.
pub type Address = MultiAddress<AccountId, ()>;

/// Block header type as expected by this runtime.
pub type Header = generic::Header<BlockNumber, BlakeTwo256>;

/// Block type as expected by this runtime.
pub type Block = generic::Block<Header, UncheckedExtrinsic>;

/// A Block signed with a Justification
pub type SignedBlock = generic::SignedBlock<Block>;

/// BlockId type as expected by this runtime.
pub type BlockId = generic::BlockId<Block>;

/// The extension to the basic transaction logic.
pub type TxExtension = cumulus_pallet_weight_reclaim::StorageWeightReclaim<
	Runtime,
	(
		frame_system::CheckNonZeroSender<Runtime>,
		frame_system::CheckSpecVersion<Runtime>,
		frame_system::CheckTxVersion<Runtime>,
		frame_system::CheckGenesis<Runtime>,
		frame_system::CheckEra<Runtime>,
		frame_system::CheckNonce<Runtime>,
		frame_system::CheckWeight<Runtime>,
		pallet_transaction_payment::ChargeTransactionPayment<Runtime>,
		frame_metadata_hash_extension::CheckMetadataHash<Runtime>,
	),
>;

/// Unchecked extrinsic type as expected by this runtime.
pub type UncheckedExtrinsic =
	generic::UncheckedExtrinsic<Address, RuntimeCall, Signature, TxExtension>;

/// All migrations of the runtime, aside from the ones declared in the pallets.
#[allow(unused_parens)]
type Migrations = ();

/// Executive: handles dispatch to the various modules.
pub type Executive = frame_executive::Executive<
	Runtime,
	Block,
	frame_system::ChainContext<Runtime>,
	Runtime,
	AllPalletsWithSystem,
	Migrations,
>;

/// Handles converting a weight scalar to a fee value, based on the scale and granularity of the
/// node's balance type.
pub struct WeightToFee;
impl WeightToFeePolynomial for WeightToFee {
	type Balance = Balance;
	fn polynomial() -> WeightToFeeCoefficients<Self::Balance> {
		let p = MILLI_UNIT / 10;
		let q = 100 * Balance::from(ExtrinsicBaseWeight::get().ref_time());
		smallvec![WeightToFeeCoefficient {
			degree: 1,
			negative: false,
			coeff_frac: Perbill::from_rational(p % q, q),
			coeff_integer: p / q,
		}]
	}
}

/// Opaque types for CLI compatibility.
pub mod opaque {
	use super::*;
	pub use polkadot_sdk::sp_runtime::OpaqueExtrinsic as UncheckedExtrinsic;
	use polkadot_sdk::sp_runtime::{
		generic,
		traits::{BlakeTwo256, Hash as HashT},
	};

	pub type Header = generic::Header<BlockNumber, BlakeTwo256>;
	pub type Block = generic::Block<Header, UncheckedExtrinsic>;
	pub type BlockId = generic::BlockId<Block>;
	pub type Hash = <BlakeTwo256 as HashT>::Output;
}

impl_opaque_keys! {
	pub struct SessionKeys {
		pub aura: Aura,
	}
}

#[sp_version::runtime_version]
pub const VERSION: RuntimeVersion = RuntimeVersion {
	spec_name: alloc::borrow::Cow::Borrowed("stack-template-runtime"),
	impl_name: alloc::borrow::Cow::Borrowed("stack-template-runtime"),
	authoring_version: 1,
	spec_version: 1,
	impl_version: 0,
	apis: apis::RUNTIME_API_VERSIONS,
	transaction_version: 1,
	system_version: 1,
};

mod block_times {
	pub const MILLI_SECS_PER_BLOCK: u64 = 6000;
	pub const SLOT_DURATION: u64 = MILLI_SECS_PER_BLOCK;
}
pub use block_times::*;

pub const MINUTES: BlockNumber = 60_000 / (MILLI_SECS_PER_BLOCK as BlockNumber);
pub const HOURS: BlockNumber = MINUTES * 60;
pub const DAYS: BlockNumber = HOURS * 24;

pub const UNIT: Balance = 1_000_000_000_000;
pub const MILLI_UNIT: Balance = 1_000_000_000;
pub const MICRO_UNIT: Balance = 1_000_000;

/// The existential deposit. Set to 1/10 of the Connected Relay Chain.
pub const EXISTENTIAL_DEPOSIT: Balance = MILLI_UNIT;

const AVERAGE_ON_INITIALIZE_RATIO: Perbill = Perbill::from_percent(5);
const NORMAL_DISPATCH_RATIO: Perbill = Perbill::from_percent(75);

/// We allow for 2 seconds of compute with a 6 second average block time.
const MAXIMUM_BLOCK_WEIGHT: Weight = Weight::from_parts(
	WEIGHT_REF_TIME_PER_SECOND.saturating_mul(2),
	cumulus_primitives_core::relay_chain::MAX_POV_SIZE as u64,
);

mod async_backing_params {
	pub(crate) const UNINCLUDED_SEGMENT_CAPACITY: u32 = 3;
	pub(crate) const BLOCK_PROCESSING_VELOCITY: u32 = 1;
	pub(crate) const RELAY_CHAIN_SLOT_DURATION_MILLIS: u32 = 6000;
}
pub(crate) use async_backing_params::*;

/// Aura consensus hook
type ConsensusHook = cumulus_pallet_aura_ext::FixedVelocityConsensusHook<
	Runtime,
	RELAY_CHAIN_SLOT_DURATION_MILLIS,
	BLOCK_PROCESSING_VELOCITY,
	UNINCLUDED_SEGMENT_CAPACITY,
>;

/// The version information used to identify this runtime when compiled natively.
#[cfg(feature = "std")]
pub fn native_version() -> NativeVersion {
	NativeVersion {
		runtime_version: VERSION,
		can_author_with: Default::default(),
	}
}

// Create the runtime by composing the FRAME pallets that were previously configured.
#[frame_support::runtime]
mod runtime {
	#[runtime::runtime]
	#[runtime::derive(
		RuntimeCall,
		RuntimeEvent,
		RuntimeError,
		RuntimeOrigin,
		RuntimeFreezeReason,
		RuntimeHoldReason,
		RuntimeSlashReason,
		RuntimeLockId,
		RuntimeTask,
		RuntimeViewFunction
	)]
	pub struct Runtime;

	#[runtime::pallet_index(0)]
	pub type System = frame_system;
	#[runtime::pallet_index(1)]
	pub type ParachainSystem = cumulus_pallet_parachain_system;
	#[runtime::pallet_index(2)]
	pub type Timestamp = pallet_timestamp;
	#[runtime::pallet_index(3)]
	pub type ParachainInfo = parachain_info;
	#[runtime::pallet_index(4)]
	pub type WeightReclaim = cumulus_pallet_weight_reclaim;

	// Monetary stuff.
	#[runtime::pallet_index(10)]
	pub type Balances = pallet_balances;
	#[runtime::pallet_index(11)]
	pub type TransactionPayment = pallet_transaction_payment;

	// Governance
	#[runtime::pallet_index(15)]
	pub type Sudo = pallet_sudo;

	// Collator support. The order of these 4 are important and shall not change.
	#[runtime::pallet_index(20)]
	pub type Authorship = pallet_authorship;
	#[runtime::pallet_index(21)]
	pub type CollatorSelection = pallet_collator_selection;
	#[runtime::pallet_index(22)]
	pub type Session = pallet_session;
	#[runtime::pallet_index(23)]
	pub type Aura = pallet_aura;
	#[runtime::pallet_index(24)]
	pub type AuraExt = cumulus_pallet_aura_ext;

	// XCM helpers.
	#[runtime::pallet_index(30)]
	pub type XcmpQueue = cumulus_pallet_xcmp_queue;
	#[runtime::pallet_index(31)]
	pub type PolkadotXcm = pallet_xcm;
	#[runtime::pallet_index(32)]
	pub type CumulusXcm = cumulus_pallet_xcm;
	#[runtime::pallet_index(33)]
	pub type MessageQueue = pallet_message_queue;

	// Template pallet
	#[runtime::pallet_index(50)]
	pub type TemplatePallet = pallet_template;
}

cumulus_pallet_parachain_system::register_validate_block! {
	Runtime = Runtime,
	BlockExecutor = cumulus_pallet_aura_ext::BlockExecutor::<Runtime, Executive>,
}
