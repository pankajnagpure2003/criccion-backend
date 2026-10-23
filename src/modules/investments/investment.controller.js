import { claimInvestment, createInvestment, listInvestments } from "./investment.service.js";

export async function getMyInvestments(req, res) {
  try {
    const data = await listInvestments(req.user.id);
    return res.json(data);
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to load investments" });
  }
}

export async function postInvestment(req, res) {
  try {
    const investment = await createInvestment(req.user.id, req.body);
    const data = await listInvestments(req.user.id);
    return res.status(201).json({ investment, ...data });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to purchase" });
  }
}

export async function postClaim(req, res) {
  try {
    const investment = await claimInvestment(req.user.id, req.params.id);
    const data = await listInvestments(req.user.id);
    return res.json({ investment, ...data });
  } catch (error) {
    console.error(error);
    return res.status(error.status || 500).json({ message: error.status ? error.message : "Failed to claim tokens" });
  }
}
