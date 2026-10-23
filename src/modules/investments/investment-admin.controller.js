import {
  approveClaimRequest,
  createReferralPlan,
  deleteReferralPlan,
  getTokenSettings,
  listClaimRequests,
  listReferralPlans,
  rejectClaimRequest,
  saveTokenSettings,
  setReferralPlanActive,
  updateReferralPlan,
} from "./investment.service.js";

export async function adminGetTokenRate(_req, res) {
  try {
    const settings = await getTokenSettings();
    return res.json({ settings });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to load token rate" });
  }
}

export async function adminSaveTokenRate(req, res) {
  try {
    const settings = await saveTokenSettings(req.body);
    return res.json({ settings });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to save token rate" });
  }
}

export async function adminListReferralPlans(_req, res) {
  try {
    const plans = await listReferralPlans();
    return res.json({ plans });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to load referral plans" });
  }
}

export async function adminCreateReferralPlan(req, res) {
  try {
    const plan = await createReferralPlan(req.body);
    const plans = await listReferralPlans();
    return res.status(201).json({ plan, plans });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to save referral plan" });
  }
}

export async function adminUpdateReferralPlan(req, res) {
  try {
    const plan = await updateReferralPlan(req.params.id, req.body);
    const plans = await listReferralPlans();
    return res.json({ plan, plans });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to save referral plan" });
  }
}

export async function adminDeleteReferralPlan(req, res) {
  try {
    await deleteReferralPlan(req.params.id);
    const plans = await listReferralPlans();
    return res.json({ plans });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to delete referral plan" });
  }
}

export async function adminListClaimRequests(req, res) {
  try {
    const data = await listClaimRequests(String(req.query.status || "pending"));
    return res.json(data);
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to load claim requests" });
  }
}

export async function adminApproveClaimRequest(req, res) {
  try {
    const request = await approveClaimRequest(req.params.id, req.body);
    const data = await listClaimRequests(String(req.query.status || "pending"));
    return res.json({ request, ...data });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to approve claim request" });
  }
}

export async function adminRejectClaimRequest(req, res) {
  try {
    const request = await rejectClaimRequest(req.params.id, req.body);
    const data = await listClaimRequests(String(req.query.status || "pending"));
    return res.json({ request, ...data });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to reject claim request" });
  }
}

export async function adminSetReferralPlanActive(req, res) {
  try {
    const plan = await setReferralPlanActive(req.params.id, req.body?.active);
    const plans = await listReferralPlans();
    return res.json({ plan, plans });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to update plan status" });
  }
}
