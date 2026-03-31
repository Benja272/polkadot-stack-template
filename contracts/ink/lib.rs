#![cfg_attr(not(feature = "std"), no_std, no_main)]

/// A simple counter contract demonstrating the same concept as the
/// pallet-template and Solidity counter - get, set, and increment a value.
///
/// Unlike the pallet and Solidity versions which use per-account storage,
/// this ink! contract stores a single counter value per contract instance.
/// Each user would deploy their own contract instance or the contract could
/// be extended with a mapping.
#[ink::contract]
mod counter {
    use ink::storage::Mapping;

    #[ink(storage)]
    pub struct Counter {
        counters: Mapping<AccountId, u32>,
    }

    #[ink(event)]
    pub struct CounterSet {
        #[ink(topic)]
        who: AccountId,
        value: u32,
    }

    #[ink(event)]
    pub struct CounterIncremented {
        #[ink(topic)]
        who: AccountId,
        new_value: u32,
    }

    #[derive(Debug, PartialEq, Eq)]
    #[ink::scale_derive(Encode, Decode, TypeInfo)]
    pub enum Error {
        CounterOverflow,
    }

    impl Counter {
        /// Creates a new counter contract.
        #[ink(constructor)]
        pub fn new() -> Self {
            Self {
                counters: Mapping::default(),
            }
        }

        /// Sets the counter for the caller to a specific value.
        #[ink(message)]
        pub fn set_counter(&mut self, value: u32) {
            let caller = self.env().caller();
            self.counters.insert(caller, &value);
            self.env().emit_event(CounterSet { who: caller, value });
        }

        /// Increments the counter for the caller by one.
        #[ink(message)]
        pub fn increment(&mut self) -> Result<(), Error> {
            let caller = self.env().caller();
            let current = self.counters.get(caller).unwrap_or(0);
            let new_value = current.checked_add(1).ok_or(Error::CounterOverflow)?;
            self.counters.insert(caller, &new_value);
            self.env().emit_event(CounterIncremented {
                who: caller,
                new_value,
            });
            Ok(())
        }

        /// Gets the counter value for a given account.
        #[ink(message)]
        pub fn get_counter(&self, account: AccountId) -> u32 {
            self.counters.get(account).unwrap_or(0)
        }
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[ink::test]
        fn default_works() {
            let counter = Counter::new();
            let default_account = ink::env::test::default_accounts::<ink::env::DefaultEnvironment>();
            assert_eq!(counter.get_counter(default_account.alice), 0);
        }

        #[ink::test]
        fn set_counter_works() {
            let mut counter = Counter::new();
            counter.set_counter(42);
            let default_account = ink::env::test::default_accounts::<ink::env::DefaultEnvironment>();
            assert_eq!(counter.get_counter(default_account.alice), 42);
        }

        #[ink::test]
        fn increment_works() {
            let mut counter = Counter::new();
            counter.set_counter(10);
            assert_eq!(counter.increment(), Ok(()));
            let default_account = ink::env::test::default_accounts::<ink::env::DefaultEnvironment>();
            assert_eq!(counter.get_counter(default_account.alice), 11);
        }
    }
}
