// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IVerifier {
	function verifyProof(
		uint256[2] calldata a,
		uint256[2][2] calldata b,
		uint256[2] calldata c,
		uint256[9] calldata pubSignals
	) external view returns (bool);
}

/// @title MedicalMarket — Phase 5.1
/// @notice Atomic ZKCP marketplace. The patient's Groth16 proof attests that
///         a ciphertext (uploaded separately to the Statement Store)
///         decrypts — under the buyer's BabyJubJub secret key, via ECDH —
///         to the exact record the medic signed at listing time. The proof
///         is verified and payment released in a single transaction.
///
///         pubSignals layout (enforced in fulfill):
///           [0] recordCommit    — must match listing.recordCommit
///           [1] medicPkX        — informational (identity off-chain)
///           [2] medicPkY        — informational
///           [3] pkBuyerX        — must match order.pkBuyerX
///           [4] pkBuyerY        — must match order.pkBuyerY
///           [5] ephPkX          — stored for buyer to reconstruct shared secret
///           [6] ephPkY
///           [7] ciphertextHash  — Statement Store lookup key (Poseidon of ciphertext[32])
///           [8] nonce           — must equal orderId
contract MedicalMarket {
	address public verifier;

	constructor(address _verifier) {
		verifier = _verifier;
	}

	struct Listing {
		uint256 recordCommit; // Poseidon(plaintext[32]) of the medic-signed record
		string title; // human-readable label shown before buying
		uint256 price; // minimum price in wei (native PAS)
		address patient;
		bool active;
	}

	struct Order {
		uint256 listingId;
		address researcher;
		uint256 amount;
		bool confirmed;
		bool cancelled;
		uint256 pkBuyerX; // researcher's BabyJubJub pubkey for ECDH
		uint256 pkBuyerY;
	}

	struct Fulfillment {
		uint256 ephPkX; // patient's ephemeral pubkey; buyer reconstructs shared secret
		uint256 ephPkY;
		uint256 ciphertextHash; // Statement Store lookup + binding commitment
	}

	mapping(uint256 => Listing) private listings;
	uint256 private listingCount;

	mapping(uint256 => Order) private orders;
	uint256 private orderCount;

	mapping(uint256 => Fulfillment) private fulfillments;

	// listingId → 1-based orderId (0 = no pending order)
	mapping(uint256 => uint256) private listingPendingOrder;

	event ListingCreated(
		address indexed patient,
		uint256 indexed listingId,
		uint256 recordCommit,
		string title,
		uint256 price
	);
	event OrderPlaced(
		uint256 indexed listingId,
		uint256 indexed orderId,
		address indexed researcher,
		uint256 amount,
		uint256 pkBuyerX,
		uint256 pkBuyerY
	);
	event SaleFulfilled(
		uint256 indexed orderId,
		uint256 indexed listingId,
		address patient,
		address researcher,
		uint256 ephPkX,
		uint256 ephPkY,
		uint256 ciphertextHash
	);
	event ListingCancelled(uint256 indexed listingId, address indexed patient);
	event OrderCancelled(
		uint256 indexed orderId,
		uint256 indexed listingId,
		address indexed researcher,
		uint256 amount
	);

	/// @notice Create a listing. `recordCommit` is Poseidon(plaintext[32]) — the medic signed it.
	function createListing(uint256 recordCommit, string calldata title, uint256 price) external {
		require(price > 0, "Price must be greater than zero");
		require(bytes(title).length > 0, "Title cannot be empty");
		require(recordCommit != 0, "recordCommit must be non-zero");
		uint256 listingId = listingCount;
		listings[listingId] = Listing({
			recordCommit: recordCommit,
			title: title,
			price: price,
			patient: msg.sender,
			active: true
		});
		listingCount++;
		emit ListingCreated(msg.sender, listingId, recordCommit, title, price);
	}

	/// @notice Lock native PAS and register the buyer's BabyJubJub pubkey.
	function placeBuyOrder(uint256 listingId, uint256 pkBuyerX, uint256 pkBuyerY) external payable {
		require(listingId < listingCount, "Listing does not exist");
		Listing storage listing = listings[listingId];
		require(listing.active, "Listing is not active");
		require(listingPendingOrder[listingId] == 0, "Listing already has a pending order");
		require(msg.value >= listing.price, "Insufficient payment");
		require(pkBuyerX != 0 || pkBuyerY != 0, "pkBuyer must be non-zero");

		uint256 orderId = orderCount;
		orders[orderId] = Order({
			listingId: listingId,
			researcher: msg.sender,
			amount: msg.value,
			confirmed: false,
			cancelled: false,
			pkBuyerX: pkBuyerX,
			pkBuyerY: pkBuyerY
		});
		orderCount++;
		listingPendingOrder[listingId] = orderId + 1;
		emit OrderPlaced(listingId, orderId, msg.sender, msg.value, pkBuyerX, pkBuyerY);
	}

	/// @notice Atomically verify the ZK proof, persist the commitment, release payment.
	function fulfill(
		uint256 orderId,
		uint256[2] calldata a,
		uint256[2][2] calldata b,
		uint256[2] calldata c,
		uint256[9] calldata pubSignals
	) external {
		require(orderId < orderCount, "Order does not exist");
		Order storage order = orders[orderId];
		require(!order.confirmed, "Order already fulfilled");
		require(!order.cancelled, "Order is cancelled");

		Listing storage listing = listings[order.listingId];
		require(msg.sender == listing.patient, "Only the patient can fulfill the order");

		require(pubSignals[0] == listing.recordCommit, "recordCommit mismatch");
		require(pubSignals[3] == order.pkBuyerX, "pkBuyerX mismatch");
		require(pubSignals[4] == order.pkBuyerY, "pkBuyerY mismatch");
		require(pubSignals[8] == orderId, "nonce must equal orderId");
		require(IVerifier(verifier).verifyProof(a, b, c, pubSignals), "ZK proof invalid");

		order.confirmed = true;
		listing.active = false;

		fulfillments[orderId] = Fulfillment({
			ephPkX: pubSignals[5],
			ephPkY: pubSignals[6],
			ciphertextHash: pubSignals[7]
		});

		(bool successPatient, ) = listing.patient.call{value: listing.price}("");
		require(successPatient, "Transfer to patient failed");

		uint256 excess = order.amount - listing.price;
		if (excess > 0) {
			(bool successResearcher, ) = order.researcher.call{value: excess}("");
			require(successResearcher, "Refund to researcher failed");
		}

		emit SaleFulfilled(
			orderId,
			order.listingId,
			listing.patient,
			order.researcher,
			pubSignals[5],
			pubSignals[6],
			pubSignals[7]
		);
	}

	function cancelListing(uint256 listingId) external {
		require(listingId < listingCount, "Listing does not exist");
		Listing storage listing = listings[listingId];
		require(listing.active, "Listing is not active");
		require(msg.sender == listing.patient, "Only the patient can cancel the listing");
		require(listingPendingOrder[listingId] == 0, "Cannot cancel listing with a pending order");

		listing.active = false;
		emit ListingCancelled(listingId, msg.sender);
	}

	function cancelOrder(uint256 orderId) external {
		require(orderId < orderCount, "Order does not exist");
		Order storage order = orders[orderId];
		require(msg.sender == order.researcher, "Only the researcher can cancel the order");
		require(!order.confirmed, "Order already fulfilled");
		require(!order.cancelled, "Order already cancelled");

		order.cancelled = true;
		listingPendingOrder[order.listingId] = 0;

		(bool success, ) = order.researcher.call{value: order.amount}("");
		require(success, "Refund to researcher failed");

		emit OrderCancelled(orderId, order.listingId, order.researcher, order.amount);
	}

	function getListing(
		uint256 id
	)
		external
		view
		returns (
			uint256 recordCommit,
			string memory title,
			uint256 price,
			address patient,
			bool active
		)
	{
		Listing storage l = listings[id];
		return (l.recordCommit, l.title, l.price, l.patient, l.active);
	}

	function getListingCount() external view returns (uint256) {
		return listingCount;
	}

	function getOrder(
		uint256 id
	)
		external
		view
		returns (
			uint256 listingId,
			address researcher,
			uint256 amount,
			bool confirmed,
			bool cancelled,
			uint256 pkBuyerX,
			uint256 pkBuyerY
		)
	{
		Order storage o = orders[id];
		return (
			o.listingId,
			o.researcher,
			o.amount,
			o.confirmed,
			o.cancelled,
			o.pkBuyerX,
			o.pkBuyerY
		);
	}

	/// @notice ephemeral pk + Statement Store lookup/binding hash for a fulfilled order.
	function getFulfillment(
		uint256 orderId
	) external view returns (uint256 ephPkX, uint256 ephPkY, uint256 ciphertextHash) {
		Fulfillment storage f = fulfillments[orderId];
		return (f.ephPkX, f.ephPkY, f.ciphertextHash);
	}

	function getOrderCount() external view returns (uint256) {
		return orderCount;
	}

	function getPendingOrderId(uint256 listingId) external view returns (uint256) {
		return listingPendingOrder[listingId];
	}
}
