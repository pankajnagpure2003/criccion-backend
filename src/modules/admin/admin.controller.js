import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User } from "../auth/auth.model.js";
import { Investment } from "../investments/investment.model.js";
import { roundUsdt } from "../../utils/money.js";

const USER_FIELDS =
  "name firstName lastName email mobile country isVerified isActive referralCode referredBy createdAt manualTotalInvestmentUsdt";

function signAdminToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export async function seedAdmin() {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "admin";

  const existing = await User.findOne({ username, role: "admin" });
  if (existing) {
    return;
  }

  const hashed = await bcrypt.hash(password, 10);
  await User.create({
    name: "Admin",
    username,
    email: `${username}@local`,
    password: hashed,
    role: "admin",
    isVerified: true,
  });
  console.log(`Admin seeded: username=${username}`);
}

export async function adminLogin(req, res) {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    const admin = await User.findOne({ username, role: "admin" });
    if (!admin) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, admin.password);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = signAdminToken(admin);
    return res.json({
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        username: admin.username,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Admin login failed" });
  }
}

function signUserToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role, email: user.email, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function sessionUser(user) {
  return {
    id: user._id,
    name: user.name,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    mobile: user.mobile,
    country: user.country,
    role: user.role,
    isVerified: user.isVerified,
    referralCode: user.referralCode,
    referredBy: user.referredBy,
    createdAt: user.createdAt,
  };
}

function splitName(user) {
  if (user.firstName || user.lastName) {
    return {
      firstName: user.firstName || "",
      lastName: user.lastName || "",
    };
  }
  const parts = String(user.name || "").trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
}

function presentAdminUser(user, computedTotal) {
  const manual = user.manualTotalInvestmentUsdt;
  const edited = manual !== null && manual !== undefined;
  const nameParts = splitName(user);
  return {
    _id: user._id,
    name: user.name,
    firstName: nameParts.firstName,
    lastName: nameParts.lastName,
    email: user.email,
    mobile: user.mobile || "",
    country: user.country || "",
    isVerified: Boolean(user.isVerified),
    isActive: user.isActive !== false,
    referralCode: user.referralCode,
    sponsorCode: user.referredBy?.referralCode || "",
    referredBy: user.referredBy,
    createdAt: user.createdAt,
    totalInvestmentUsdt: edited ? roundUsdt(manual) : roundUsdt(computedTotal || 0),
    totalInvestmentEdited: edited,
  };
}

async function investmentTotals() {
  const rows = await Investment.aggregate([
    { $group: { _id: "$user", total: { $sum: "$amountUsdt" } } },
  ]);
  return new Map(rows.map((row) => [String(row._id), row.total]));
}

function readUserId(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) {
    res.status(400).json({ message: "User not found" });
    return null;
  }
  return req.params.id;
}

export async function listUsers(req, res) {
  try {
    const [users, totals] = await Promise.all([
      User.find({ role: "user" })
        .select(USER_FIELDS)
        .populate("referredBy", "name email referralCode")
        .sort({ createdAt: -1 }),
      investmentTotals(),
    ]);

    return res.json({
      users: users.map((user) => presentAdminUser(user, totals.get(String(user._id)) || 0)),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to load users" });
  }
}

export async function quickLoginUser(req, res) {
  try {
    const id = readUserId(req, res);
    if (!id) {
      return;
    }

    const user = await User.findOne({ _id: id, role: "user" });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isActive === false) {
      return res.status(400).json({ message: "Activate this user before quick login" });
    }

    return res.json({
      userToken: signUserToken(user),
      user: sessionUser(user),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Quick login failed" });
  }
}

function reject(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

async function computedTotalFor(userId) {
  const rows = await Investment.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId) } },
    { $group: { _id: null, total: { $sum: "$amountUsdt" } } },
  ]);
  return rows[0]?.total || 0;
}

async function applyUserUpdates(user, body) {
  const updates = {};
  const has = (key) => Object.prototype.hasOwnProperty.call(body, key);

  if (has("firstName") || has("lastName")) {
    const firstName = String(body.firstName ?? user.firstName ?? "").trim();
    const lastName = String(body.lastName ?? user.lastName ?? "").trim();
    if (!firstName || !lastName) {
      throw reject("First name and last name are required");
    }
    updates.firstName = firstName;
    updates.lastName = lastName;
    updates.name = `${firstName} ${lastName}`;
  }

  if (has("email")) {
    const email = String(body.email || "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      throw reject("A valid email is required");
    }
    const taken = await User.exists({ email, _id: { $ne: user._id } });
    if (taken) {
      throw reject("Email already registered");
    }
    updates.email = email;
  }

  if (has("mobile")) {
    const mobile = String(body.mobile || "").trim();
    if (!mobile) {
      throw reject("Mobile is required");
    }
    updates.mobile = mobile;
  }

  if (has("country")) {
    const country = String(body.country || "").trim();
    if (!country) {
      throw reject("Country is required");
    }
    updates.country = country;
  }

  if (has("password") && String(body.password || "").length > 0) {
    const password = String(body.password);
    if (password.length < 6) {
      throw reject("Password must be at least 6 characters");
    }
    updates.password = await bcrypt.hash(password, 10);
  }

  if (has("isVerified")) {
    updates.isVerified = body.isVerified === true;
  }

  if (has("isActive")) {
    updates.isActive = body.isActive === true;
  }

  if (has("referralCode")) {
    const referralCode = String(body.referralCode || "").trim().toUpperCase();
    if (!/^[A-Z0-9]{4,20}$/.test(referralCode)) {
      throw reject("Referral code must be 4 to 20 letters or numbers");
    }
    const taken = await User.exists({ referralCode, _id: { $ne: user._id } });
    if (taken) {
      throw reject("Referral code already used");
    }
    updates.referralCode = referralCode;
  }

  if (has("sponsorId")) {
    const sponsorId = String(body.sponsorId || "").trim().toUpperCase();
    if (!sponsorId) {
      throw reject("Sponsor ID is required");
    }
    const nextCode = updates.referralCode || user.referralCode;
    if (sponsorId === nextCode) {
      throw reject("User cannot sponsor themselves");
    }
    const sponsor = await User.findOne({ referralCode: sponsorId, role: "user" });
    if (!sponsor) {
      throw reject("Invalid sponsor ID");
    }
    if (String(sponsor._id) === String(user._id)) {
      throw reject("User cannot sponsor themselves");
    }
    updates.referredBy = sponsor._id;
  }

  if (has("totalInvestmentUsdt")) {
    const amount = Number(body.totalInvestmentUsdt);
    if (!Number.isFinite(amount) || amount < 0) {
      throw reject("Total investment must be 0 or more");
    }
    updates.manualTotalInvestmentUsdt = roundUsdt(amount);
  }

  if (Object.keys(updates).length === 0) {
    throw reject("Nothing to update");
  }

  Object.assign(user, updates);
  await user.save();
  await user.populate("referredBy", "name email referralCode");
  return user;
}

export async function updateUser(req, res) {
  try {
    const id = readUserId(req, res);
    if (!id) {
      return;
    }

    const user = await User.findOne({ _id: id, role: "user" });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    await applyUserUpdates(user, req.body || {});
    const total = await computedTotalFor(user._id);
    return res.json({ user: presentAdminUser(user, total) });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0];
      const message = field === "email" ? "Email already registered" : "Referral code already used";
      return res.status(409).json({ message });
    }
    console.error(error);
    return res.status(500).json({ message: "Failed to update user" });
  }
}
