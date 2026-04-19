// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// Groth16 BN254 verifier — pure Solidity (no assembly, resolc/PVM compatible).
// VK constants generated from circuits/build/verification_key.json after running circuits/build.sh.
// Phase 5.1: pubSignals length = 9; IC array has 10 G1 points.
contract Verifier {
	uint256 constant FIELD_MODULUS =
		21888242871839275222246405745257275088696311157297823662689037894645226208583;

	// --- curve-wide VK constants (same for every trusted setup over BN254) ---
	uint256 constant ALPHA_X =
		20491192805390485299153009773594534940189261866228447918068658471970481763042;
	uint256 constant ALPHA_Y =
		9383485363053290200918347156157836566562967994039712273449902621266178545958;
	uint256 constant BETA_X1 =
		4252822878758300859123897981450591353533073413197771768651442665752259397132;
	uint256 constant BETA_X2 =
		6375614351688725206403948262868962793625744043794305715222011528459656738731;
	uint256 constant BETA_Y1 =
		21847035105528745403288232691147584728191162732299865338377159692350059136679;
	uint256 constant BETA_Y2 =
		10505242626370262277552901082094356697409835680220590971873171140371331206856;
	uint256 constant GAMMA_X1 =
		11559732032986387107991004021392285783925812861821192530917403151452391805634;
	uint256 constant GAMMA_X2 =
		10857046999023057135944570762232829481370756359578518086990519993285655852781;
	uint256 constant GAMMA_Y1 =
		4082367875863433681332203403145435568316851327593401208105741076214120093531;
	uint256 constant GAMMA_Y2 =
		8495653923123431417604973247489272438418190587263600148770280649306958101930;

	// --- circuit-specific VK constants (change on every zkey ceremony) ---
	uint256 constant DELTA_X1 =
		16584086399747447558818799694760390447932459874799763883813917287268018184181;
	uint256 constant DELTA_X2 =
		21745536254681343376894383227657795297558226234171457895553495956486558933950;
	uint256 constant DELTA_Y1 =
		16733727782521714156822750924413442816667502524722252527606493438563176248678;
	uint256 constant DELTA_Y2 =
		5344043037424224100787228735562893102824228654021513557399042921604015369086;

	uint256 constant IC0_X =
		16197231773978319640797115297880360828928615838231844561289830534340791541246;
	uint256 constant IC0_Y =
		11314113575698180625589377851666887455750340574115239744864287379213122731094;
	uint256 constant IC1_X =
		7288511937661518957723173249817952963947037047076990177835778192285983029489;
	uint256 constant IC1_Y =
		507404606377272659845127709890716079522345624816969011508702380425346651633;
	uint256 constant IC2_X =
		457370278316992489072040025727483685737316333784360447896005526915844241497;
	uint256 constant IC2_Y =
		18741914554184150049549932466133831255602445988653975298427014223483720563993;
	uint256 constant IC3_X =
		12562266396484398116998221813150747769076109395797444459421616550458058216639;
	uint256 constant IC3_Y =
		21598693062073851938961790008157442883143117770492636429858275254405300897389;
	uint256 constant IC4_X =
		14324963269598052357655038214622421933882027358042685126479946995618211117720;
	uint256 constant IC4_Y =
		5774726889410658615277585732392029002650681867117435734318660226283979570942;
	uint256 constant IC5_X =
		20145632101873260194827242016219717976919856681955911843441399534654399628507;
	uint256 constant IC5_Y =
		2574499561075245154408457792788042986618604321684149301118609158698838343954;
	uint256 constant IC6_X =
		1232177845295509234864678850238819350850452967948112303552151295947541042233;
	uint256 constant IC6_Y =
		16839138537527507687135615040808309754578111282645810507477455891111499097662;
	uint256 constant IC7_X =
		17862968255614936394815475805311534406348212800830306242934987217173461869403;
	uint256 constant IC7_Y =
		6242570906642362832635431444339899260406001825717867060792109912296584262630;
	uint256 constant IC8_X =
		6985435866829976538219662770372747180675027721564520318929611574542576767232;
	uint256 constant IC8_Y =
		835787377969756142445630246448310218019104799662007082385371819509932668860;
	uint256 constant IC9_X =
		7120753097298879914247995406643328069141234122096935594497067746814230027508;
	uint256 constant IC9_Y =
		11879108524605893405250807424720088413903345859847448062910199647136353995151;

	function _negate(uint256 x, uint256 y) internal pure returns (uint256, uint256) {
		if (x == 0 && y == 0) return (0, 0);
		return (x, FIELD_MODULUS - (y % FIELD_MODULUS));
	}

	function _ecAdd(
		uint256 ax,
		uint256 ay,
		uint256 bx,
		uint256 by
	) internal view returns (uint256 rx, uint256 ry) {
		(bool ok, bytes memory out) = address(0x06).staticcall(abi.encodePacked(ax, ay, bx, by));
		require(ok && out.length == 64, "ecAdd failed");
		(rx, ry) = abi.decode(out, (uint256, uint256));
	}

	function _ecMul(
		uint256 px,
		uint256 py,
		uint256 s
	) internal view returns (uint256 rx, uint256 ry) {
		(bool ok, bytes memory out) = address(0x07).staticcall(abi.encodePacked(px, py, s));
		require(ok && out.length == 64, "ecMul failed");
		(rx, ry) = abi.decode(out, (uint256, uint256));
	}

	function _ecPairing(bytes memory input) internal view returns (bool) {
		(bool ok, bytes memory out) = address(0x08).staticcall(input);
		require(ok && out.length == 32, "ecPairing failed");
		return abi.decode(out, (uint256)) == 1;
	}

	/// @dev vk_x += IC[i] * s. Extracted to keep stack frames shallow under PVM.
	function _addTerm(
		uint256 vx,
		uint256 vy,
		uint256 icX,
		uint256 icY,
		uint256 s
	) internal view returns (uint256, uint256) {
		(uint256 termX, uint256 termY) = _ecMul(icX, icY, s);
		return _ecAdd(vx, vy, termX, termY);
	}

	/// @dev vk_x = IC[0] + Σ pubSignals[i] * IC[i+1].
	function _computeVkX(uint256[9] calldata p) internal view returns (uint256 vx, uint256 vy) {
		(vx, vy) = (IC0_X, IC0_Y);
		(vx, vy) = _addTerm(vx, vy, IC1_X, IC1_Y, p[0]);
		(vx, vy) = _addTerm(vx, vy, IC2_X, IC2_Y, p[1]);
		(vx, vy) = _addTerm(vx, vy, IC3_X, IC3_Y, p[2]);
		(vx, vy) = _addTerm(vx, vy, IC4_X, IC4_Y, p[3]);
		(vx, vy) = _addTerm(vx, vy, IC5_X, IC5_Y, p[4]);
		(vx, vy) = _addTerm(vx, vy, IC6_X, IC6_Y, p[5]);
		(vx, vy) = _addTerm(vx, vy, IC7_X, IC7_Y, p[6]);
		(vx, vy) = _addTerm(vx, vy, IC8_X, IC8_Y, p[7]);
		(vx, vy) = _addTerm(vx, vy, IC9_X, IC9_Y, p[8]);
	}

	function _runPairing(
		uint256 negAx,
		uint256 negAy,
		uint256[2][2] calldata b,
		uint256 vx,
		uint256 vy,
		uint256[2] calldata c
	) internal view returns (bool) {
		return
			_ecPairing(
				abi.encodePacked(
					negAx,
					negAy,
					b[0][0],
					b[0][1],
					b[1][0],
					b[1][1],
					ALPHA_X,
					ALPHA_Y,
					BETA_X1,
					BETA_X2,
					BETA_Y1,
					BETA_Y2,
					vx,
					vy,
					GAMMA_X1,
					GAMMA_X2,
					GAMMA_Y1,
					GAMMA_Y2,
					c[0],
					c[1],
					DELTA_X1,
					DELTA_X2,
					DELTA_Y1,
					DELTA_Y2
				)
			);
	}

	function verifyProof(
		uint256[2] calldata a,
		uint256[2][2] calldata b,
		uint256[2] calldata c,
		uint256[9] calldata pubSignals
	) external view returns (bool) {
		(uint256 vx, uint256 vy) = _computeVkX(pubSignals);
		(uint256 negAx, uint256 negAy) = _negate(a[0], a[1]);
		return _runPairing(negAx, negAy, b, vx, vy, c);
	}
}
