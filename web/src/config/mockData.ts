export const mockListings = [
	{
		id: "0x3f2a...c891",
		condition: "Type 2 Diabetes",
		disclosedFields: ["age-range", "hba1c-threshold", "diagnosis-category"],
		price: 24,
		attested: "2025-03-15",
		status: "Active",
	},
	{
		id: "0x9b1d...f032",
		condition: "Hypertension",
		disclosedFields: ["age-range", "systolic-range", "medication-class"],
		price: 18,
		attested: "2025-02-28",
		status: "Active",
	},
];

export const mockOrders = [
	{
		id: "0x1e31...4138",
		condition: "Type 2 Diabetes",
		price: 24,
		status: "Fulfilled",
		date: "2025-04-10",
		pkBuyer: "0x4cc2...ff41",
	},
];
