import { approveDeposit, getDepositConfig, listAdminDeposits, rejectDeposit, updateDepositSettings } from "./deposit.service.js";

export async function adminListDeposits(req, res) {
  try {
    const [deposits, settings] = await Promise.all([
      listAdminDeposits(req.query.status),
      getDepositConfig(),
    ]);
    return res.json({
      deposits,
      rate: { inrPerUsdt: settings.inrPerUsdt },
    });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to load deposits" });
  }
}

export async function adminApproveDeposit(req, res) {
  try {
    const deposit = await approveDeposit(req.params.id, req.user.id, req.body);
    return res.json({ deposit });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to approve deposit" });
  }
}

export async function adminRejectDeposit(req, res) {
  try {
    const deposit = await rejectDeposit(req.params.id, req.user.id, req.body);
    return res.json({ deposit });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to reject deposit" });
  }
}

export async function adminGetDepositSettings(_req, res) {
  try {
    const settings = await getDepositConfig();
    return res.json({ settings });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to load payment setup" });
  }
}

export async function adminUpdateDepositSettings(req, res) {
  try {
    const settings = await updateDepositSettings(req.body);
    return res.json({ settings });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to save payment setup" });
  }
}
