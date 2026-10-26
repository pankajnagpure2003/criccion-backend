import mongoose from "mongoose";
import { User } from "./auth.model.js";
import { Investment } from "../investments/investment.model.js";
import { roundUsdt } from "../../utils/money.js";

function presentTeamMember(user) {
  return {
    id: String(user._id),
    name: user.name,
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    username: user.username || "",
    email: user.email || "",
    referralCode: user.referralCode || "",
    isVerified: Boolean(user.isVerified),
    isActive: user.isActive !== false,
    level: 0,
    createdAt: user.createdAt,
    selfInvestmentUsdt: 0,
    teamBusinessUsdt: 0,
    children: [],
  };
}

export async function getReferralTree(rootUserId) {
  const rootUser = await User.findOne({ _id: rootUserId, role: "user" })
    .select("name firstName lastName username email referralCode isVerified isActive createdAt")
    .lean();

  if (!rootUser) {
    return null;
  }

  const root = presentTeamMember(rootUser);
  const membersById = new Map([[root.id, root]]);
  const visited = new Set([root.id]);
  let frontier = [root.id];
  const levelCounts = [];
  let totalMembers = 0;
  let verifiedMembers = 0;

  while (frontier.length > 0) {
    const members = await User.find({
      role: "user",
      referredBy: { $in: frontier },
    })
      .select("name firstName lastName username email referralCode isVerified isActive createdAt referredBy")
      .sort({ createdAt: 1 })
      .lean();

    const nextFrontier = [];
    let levelCount = 0;

    for (const member of members) {
      const memberId = String(member._id);
      const parentId = String(member.referredBy);
      const parent = membersById.get(parentId);

      if (!parent || visited.has(memberId)) {
        continue;
      }

      const teamMember = presentTeamMember(member);
      teamMember.level = membersById.get(parentId).level + 1;
      parent.children.push(teamMember);
      membersById.set(memberId, teamMember);
      visited.add(memberId);
      nextFrontier.push(memberId);
      levelCount += 1;
      totalMembers += 1;
      if (teamMember.isVerified) {
        verifiedMembers += 1;
      }
    }

    if (levelCount > 0) {
      levelCounts.push(levelCount);
    }
    frontier = nextFrontier;
  }

  const memberIds = [...membersById.keys()];
  const investments = await Investment.aggregate([
    { $match: { user: { $in: memberIds.map((id) => new mongoose.Types.ObjectId(id)) } } },
    { $group: { _id: "$user", total: { $sum: "$amountUsdt" } } },
  ]);
  for (const investment of investments) {
    const member = membersById.get(String(investment._id));
    if (member) {
      member.selfInvestmentUsdt = roundUsdt(investment.total);
    }
  }

  function calculateTeamBusiness(member) {
    let total = 0;
    for (const child of member.children) {
      total += child.selfInvestmentUsdt + calculateTeamBusiness(child);
    }
    member.teamBusinessUsdt = roundUsdt(total);
    return total;
  }

  calculateTeamBusiness(root);

  return {
    tree: root,
    summary: {
      directMembers: root.children.length,
      totalMembers,
      verifiedMembers,
      levels: levelCounts.length,
    },
    levelCounts,
  };
}
