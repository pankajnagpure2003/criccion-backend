export const payoutMethods = [
  {
    id: "bank_transfer",
    label: "Bank Transfer",
    fields: [
      { key: "accountName", label: "Account name", required: true, min: 2 },
      { key: "accountNumber", label: "Account number", required: true, min: 6 },
      { key: "ifsc", label: "IFSC", required: true, min: 8, placeholder: "HDFC0001234" },
      { key: "bankName", label: "Bank name", required: true, min: 2 },
    ],
  },
  {
    id: "upi",
    label: "UPI",
    fields: [
      { key: "payeeName", label: "Name", required: true, min: 2 },
      {
        key: "upiId",
        label: "UPI ID",
        required: true,
        min: 5,
        placeholder: "name@bank",
        message: "Enter a valid UPI ID",
        check: (value) => value.includes("@"),
      },
    ],
  },
  {
    id: "wallet_address",
    label: "Wallet address",
    fields: [
      { key: "network", label: "Network", required: true, min: 2, placeholder: "TRC20" },
      { key: "address", label: "Wallet address", required: true, min: 16, placeholder: "USDT address" },
    ],
  },
];

export function listPayoutMethods() {
  return payoutMethods;
}

export function findPayoutMethod(id) {
  return payoutMethods.find((method) => method.id === id) || null;
}

export function publicPayoutMethod(method) {
  return {
    id: method.id,
    label: method.label,
    fields: method.fields.map(({ key, label, required, placeholder }) => ({
      key,
      label,
      required: Boolean(required),
      placeholder: placeholder || "",
    })),
  };
}
