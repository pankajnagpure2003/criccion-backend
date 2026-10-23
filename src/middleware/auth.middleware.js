import jwt from "jsonwebtoken";
import { User } from "../modules/auth/auth.model.js";

function readBearerToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

async function authenticateFromToken(req) {
  const token = readBearerToken(req);

  if (!token) {
    const error = new Error("Login required");
    error.status = 401;
    throw error;
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    const error = new Error("Invalid or expired token");
    error.status = 401;
    throw error;
  }

  const user = await User.findById(payload.id).select("-password -otp");
  if (!user) {
    const error = new Error("User not found");
    error.status = 401;
    throw error;
  }

  if (user.role === "user" && user.isActive === false) {
    const error = new Error("This account is deactivated");
    error.status = 401;
    throw error;
  }

  return user;
}

export async function requireAuth(req, res, next) {
  try {
    const user = await authenticateFromToken(req);

    if (user.role !== "user") {
      return res.status(403).json({ message: "User access only" });
    }

    req.user = {
      id: user._id,
      role: user.role,
      email: user.email,
    };
    req.authUser = user;
    next();
  } catch (error) {
    return res.status(error.status || 401).json({ message: error.message });
  }
}

export async function requireAdmin(req, res, next) {
  try {
    const admin = await authenticateFromToken(req);

    if (admin.role !== "admin") {
      return res.status(403).json({ message: "Admin access only" });
    }

    req.user = {
      id: admin._id,
      role: admin.role,
      username: admin.username,
    };
    req.admin = admin;
    next();
  } catch (error) {
    return res.status(error.status || 401).json({ message: error.message });
  }
}
