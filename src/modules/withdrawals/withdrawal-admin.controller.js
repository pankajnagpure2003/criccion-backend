import { approveWithdrawal, listAdminWithdrawals, rejectWithdrawal } from "./withdrawal.service.js";
import { removeProof } from "./proof.storage.js";

export async function adminListWithdrawals(req, res) {
  try {
    const withdrawals = await listAdminWithdrawals(req.query.status);
    return res.json({ withdrawals });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to load withdrawals" });
  }
}

export async function adminApproveWithdrawal(req, res) {
  try {
    const withdrawal = await approveWithdrawal(req.params.id, req.user.id, {
      proofFile: req.file?.filename || "",
      reference: req.body.reference,
    });
    return res.json({ withdrawal });
  } catch (error) {
    if (req.file?.filename) {
      removeProof(req.file.filename);
    }
    console.error(error);
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to approve withdrawal" });
  }
}

export async function adminRejectWithdrawal(req, res) {
  try {
    const withdrawal = await rejectWithdrawal(req.params.id, req.user.id, req.body);
    return res.json({ withdrawal });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to reject withdrawal" });
  }
}
