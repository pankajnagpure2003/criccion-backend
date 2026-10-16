import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../auth/auth.model.js";

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

export async function listUsers(req, res) {
  try {
    const users = await User.find({ role: "user" })
      .select("name firstName lastName email mobile country isVerified referralCode referredBy createdAt")
      .populate("referredBy", "name email referralCode")
      .sort({ createdAt: -1 });

    return res.json({ users });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to load users" });
  }
}
