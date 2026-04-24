# PBP Project Retrospective

**Your name:** Benjamin Martinez Picech
**Project name:** ownMed
**Repo URL:** https://github.com/Benja272/OwnMed-dapp
**Path chosen:** Solidity contract on PVM + CLI + DotNS landing page

---

## What I built

OwnMed is a privacy-first medical record platform trying to solve the centralization and lack of ownership in the current medical record ecosystem. It gives the power back to patients, allowing them to control who can access their data — including who can buy their records. In the current state of AI and data-driven research, medical records are being sold to researchers, hopefully with the patient's consent, but with full disclosure of the data. We want to solve the problem of data ownership and privacy by allowing patients to submit their data to the blockchain and creating a marketplace where researchers can buy access to it without revealing sensitive information, while maintaining the linkage between the data and the medic signature that validates the authenticity of the record. On top of that, we added a governance layer with a multisig smart contract that allows adding and removing authorities and listing the verified medics that can sign the records. This is a temporary solution until we can integrate with People Chain and the known-good judgements, where we could even validate medic titles and credentials.

---

## Why I picked this path

I started trying to address all the possible problems regarding privacy and security of medical records, but I quickly realized that the ZK circuit was growing too much and I started getting weight limit reverts — and sometimes I didn't even know what was happening because no revert cause was logged. So I decided to drop the ZK part and focus on encryption and decryption of the records on the client side. I chose the smart contract path because I had more experience with it — not specifically with Solidity, but I thought the complexity of the problem was more related to the cryptography side than the protocol itself. Following the flow I think any dApp or system should follow. It might not be the best choice for learning more about pallets and the runtime, but I think it was worth it anyway.

---

## What worked

1. The template was very helpful to get started — it has a lot of the pieces already wired up.
2. The compilation and integration of the Solidity smart contracts was pretty clear and straightforward; the scripts to deploy and interact with them were very useful.
3. Every need I had outside of interacting with ZK primitives was either resolved or at least clear where each piece needed to be implemented.
4. The eth-rpc adapter on Asset Hub let us use viem for all contract reads and PAPI only for writes, so we got the full Ethereum tooling ecosystem without having to learn PAPI for everything.

---

## What broke

1. The connection to the Statement Store was problematic because it differs between the People Chain and the local node. It wasn't clear to me where I needed to connect from the deployed frontend to the Statement Store.
2. The wallet connection and host setup are very obscure — there is not much documentation or debugging tooling, so I had to do a lot of trial and error to get it working.
3. Reverts have no return error message. I didn't dig too deep into it, but it was hard to understand why transactions were failing.
4. There is no explanation of how the host works or how the wallet connection is established.
5. PVM has no BN254 pairing precompile, so the Groth16 verifier contract blows the block weight budget and we had to drop on-chain ZK entirely.

---

## What I'd do differently

I should have started with a more in-depth analysis of the cryptographic flow and the guarantees we want to ensure, and maybe placed all the other pieces without any on-chain validation until we actually had the complete picture of the incentives and problems we could face. I started too early with the ZK path and should have focused on integrating more pieces of the ecosystem first.

---

## Stack feedback for Parity

More documentation and debugging tools for the host and wallet connection. On the final day they mentioned a tool to debug the host environment. It would be great to have these tools available — and to hear about them — from day one or when the project is starting.

The lack of a BN254 precompile as a host function i think its a big gap in the pallet. Not specifically for the case but zk primitives in general.

---

## Links

- **Bug reports filed:** Will be filing shortly.
- **PRs submitted to stack repos:** Will be contributing shortly. Couldn't get completely free of work during the program but will try to contribute as much as possible.
- **Pitch slides / presentation:** https://github.com/Benja272/OwnMed-dapp/blob/master/docs/pitch/presentation.html
- **Live deployment:** https://own-your-medical-records42.dot.li/ (Bulletin Chain / DotNS)
