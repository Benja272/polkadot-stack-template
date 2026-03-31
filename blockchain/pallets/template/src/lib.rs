//! # Template Pallet - Counter
//!
//! A simple counter pallet that demonstrates core FRAME concepts:
//! - Per-account storage using `StorageMap`
//! - Dispatchable calls (`set_counter`, `increment`)
//! - Events and errors
//! - Weight annotations
//!
//! This pallet implements the same "counter" concept as the EVM and ink! contract
//! templates, allowing developers to compare the three approaches side-by-side.

#![cfg_attr(not(feature = "std"), no_std)]

pub use pallet::*;

#[frame::pallet]
pub mod pallet {
	use frame::prelude::*;

	#[pallet::pallet]
	pub struct Pallet<T>(_);

	/// Configuration trait for this pallet.
	#[pallet::config]
	pub trait Config: frame_system::Config {
		/// The overarching runtime event type.
		type RuntimeEvent: From<Event<Self>> + IsType<<Self as frame_system::Config>::RuntimeEvent>;
	}

	/// Storage for counter values, one per account.
	#[pallet::storage]
	pub type Counters<T: Config> = StorageMap<_, Blake2_128Concat, T::AccountId, u32, ValueQuery>;

	/// Events emitted by this pallet.
	#[pallet::event]
	#[pallet::generate_deposit(pub(super) fn deposit_event)]
	pub enum Event<T: Config> {
		/// A counter was set to a specific value.
		CounterSet {
			/// The account that set the counter.
			who: T::AccountId,
			/// The new counter value.
			value: u32,
		},
		/// A counter was incremented.
		CounterIncremented {
			/// The account whose counter was incremented.
			who: T::AccountId,
			/// The new counter value after incrementing.
			new_value: u32,
		},
	}

	/// Errors that can occur in this pallet.
	#[pallet::error]
	pub enum Error<T> {
		/// Counter would overflow if incremented.
		CounterOverflow,
	}

	/// Dispatchable calls.
	#[pallet::call]
	impl<T: Config> Pallet<T> {
		/// Set the counter for the calling account to a specific value.
		#[pallet::call_index(0)]
		#[pallet::weight(Weight::from_parts(10_000, 0) + T::DbWeight::get().writes(1))]
		pub fn set_counter(origin: OriginFor<T>, value: u32) -> DispatchResult {
			let who = ensure_signed(origin)?;
			Counters::<T>::insert(&who, value);
			Self::deposit_event(Event::CounterSet { who, value });
			Ok(())
		}

		/// Increment the counter for the calling account by one.
		#[pallet::call_index(1)]
		#[pallet::weight(Weight::from_parts(10_000, 0) + T::DbWeight::get().reads_writes(1, 1))]
		pub fn increment(origin: OriginFor<T>) -> DispatchResult {
			let who = ensure_signed(origin)?;
			let new_value = Counters::<T>::get(&who)
				.checked_add(1)
				.ok_or(Error::<T>::CounterOverflow)?;
			Counters::<T>::insert(&who, new_value);
			Self::deposit_event(Event::CounterIncremented { who, new_value });
			Ok(())
		}
	}
}

#[cfg(test)]
mod tests {
	use super::*;
	use frame::{runtime::prelude::*, testing_prelude::*};

	#[frame_construct_runtime]
	mod test_runtime {
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
		pub struct Test;

		#[runtime::pallet_index(0)]
		pub type System = frame_system;
		#[runtime::pallet_index(1)]
		pub type Counter = crate;
	}

	#[derive_impl(frame_system::config_preludes::TestDefaultConfig)]
	impl frame_system::Config for Test {
		type Block = MockBlock<Self>;
	}

	impl crate::pallet::Config for Test {
		type RuntimeEvent = RuntimeEvent;
	}

	#[test]
	fn set_counter_works() {
		TestState::new_empty().execute_with(|| {
			assert_eq!(Counters::<Test>::get(1), 0);
			assert_ok!(Counter::set_counter(RuntimeOrigin::signed(1), 42));
			assert_eq!(Counters::<Test>::get(1), 42);
		});
	}

	#[test]
	fn increment_works() {
		TestState::new_empty().execute_with(|| {
			assert_ok!(Counter::set_counter(RuntimeOrigin::signed(1), 10));
			assert_ok!(Counter::increment(RuntimeOrigin::signed(1)));
			assert_eq!(Counters::<Test>::get(1), 11);
		});
	}

	#[test]
	fn increment_from_zero_works() {
		TestState::new_empty().execute_with(|| {
			assert_ok!(Counter::increment(RuntimeOrigin::signed(1)));
			assert_eq!(Counters::<Test>::get(1), 1);
		});
	}

	#[test]
	fn increment_overflow_fails() {
		TestState::new_empty().execute_with(|| {
			Counters::<Test>::insert(1, u32::MAX);
			assert_err!(
				Counter::increment(RuntimeOrigin::signed(1)),
				Error::<Test>::CounterOverflow
			);
		});
	}
}
