import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "./auth.model.js";
import { generateReferralCode } from "../../utils/generateReferralCode.js";
import { generateOtp } from "../../utils/generateOtp.js";
import { sendOtpEmail } from "../../utils/mailer.js";

const OTP_MINUTES = 10;

function signToken(user) {
  return jwt.sign(
    { id: user._id, role: user.role, email: user.email, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function publicUser(user) {
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

async function resolveReferrer(sponsorId) {
  const code = String(sponsorId || "").trim();
  if (!code) {
    const err = new Error("Sponsor ID is required");
    err.status = 400;
    throw err;
  }

  const referrer = await User.findOne({
    referralCode: code.toUpperCase(),
    role: "user",
    isVerified: true,
  });

  if (!referrer) {
    const err = new Error("Invalid sponsor ID");
    err.status = 400;
    throw err;
  }

  return referrer._id;
}

function otpResponse(user, mail, fallback) {
  return {
    email: user.email,
    otpSent: mail.sent,
    message: mail.sent ? "OTP sent to your email" : fallback,
  };
}

async function issueOtp(user, purpose = "verify") {
  const otp = generateOtp();
  user.otp = otp;
  user.otpExpiresAt = new Date(Date.now() + OTP_MINUTES * 60 * 1000);
  user.otpPurpose = purpose;
  await user.save();
  return sendOtpEmail(user.email, otp, purpose);
}

export async function signup(req, res) {
  try {
    const {
      firstName,
      lastName,
      email,
      mobile,
      country,
      password,
      confirmPassword,
      sponsorId,
    } = req.body;

    if (!firstName || !lastName || !email || !mobile || !country || !password || !String(sponsorId || "").trim()) {
      return res.status(400).json({ message: "All fields are required, including sponsor ID" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const emailNorm = email.toLowerCase().trim();
    const name = `${firstName.trim()} ${lastName.trim()}`;
    const referredBy = await resolveReferrer(sponsorId);

    let user = await User.findOne({ email: emailNorm, role: "user" });

    if (user?.isVerified) {
      return res.status(409).json({ message: "Email already registered" });
    }

    const hashed = await bcrypt.hash(password, 10);

    if (user) {
      user.name = name;
      user.firstName = firstName.trim();
      user.lastName = lastName.trim();
      user.mobile = mobile.trim();
      user.country = country.trim();
      user.password = hashed;
      user.referredBy = referredBy;
    } else {
      let code = generateReferralCode();
      while (await User.exists({ referralCode: code })) {
        code = generateReferralCode();
      }

      user = new User({
        name,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: emailNorm,
        mobile: mobile.trim(),
        country: country.trim(),
        password: hashed,
        role: "user",
        isVerified: false,
        referralCode: code,
        referredBy,
      });
    }

    const mail = await issueOtp(user, "verify");

    return res.status(201).json({
      needsVerification: true,
      ...otpResponse(user, mail, "OTP generated. SMTP is not configured, check server logs."),
    });
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ message: error.message });
    }
    console.error(error);
    return res.status(500).json({ message: "Signup failed" });
  }
}

export async function verifyOtp(req, res) {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase(), role: "user" });
    if (!user || !user.otp || !user.otpExpiresAt) {
      return res.status(400).json({ message: "No OTP found. Please signup again." });
    }

    if (user.otpPurpose === "reset") {
      return res.status(400).json({ message: "This OTP is for password reset." });
    }

    if (user.otpExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: "OTP expired. Please resend." });
    }

    if (String(otp).trim() !== user.otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    user.isVerified = true;
    user.otp = null;
    user.otpExpiresAt = null;
    user.otpPurpose = null;
    await user.save();

    const token = signToken(user);
    return res.json({ token, user: publicUser(user) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "OTP verification failed" });
  }
}

export async function resendOtp(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email: email.toLowerCase(), role: "user" });
    if (!user) {
      return res.status(404).json({ message: "Account not found" });
    }
    if (user.isVerified) {
      return res.status(400).json({ message: "Account already verified" });
    }

    const mail = await issueOtp(user, "verify");
    return res.json(otpResponse(user, mail, "OTP generated. SMTP is not configured, check server logs."));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to resend OTP" });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase(), role: "user" });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.isActive === false) {
      return res.status(403).json({ message: "This account is deactivated" });
    }

    if (!user.isVerified) {
      const mail = await issueOtp(user, "verify");
      return res.status(403).json({
        needsVerification: true,
        ...otpResponse(
          user,
          mail,
          "Account is not verified. OTP generated. SMTP is not configured, check server logs."
        ),
        message: mail.sent
          ? "Account is not verified. Verification code sent to your email."
          : "Account is not verified. OTP generated. SMTP is not configured, check server logs.",
      });
    }

    const token = signToken(user);
    return res.json({ token, user: publicUser(user) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Login failed" });
  }
}

export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim(), role: "user" });
    if (!user) {
      return res.status(404).json({ message: "Account not found" });
    }
    if (!user.isVerified) {
      const mail = await issueOtp(user, "verify");
      return res.status(403).json({
        needsVerification: true,
        ...otpResponse(
          user,
          mail,
          "Account is not verified. OTP generated. SMTP is not configured, check server logs."
        ),
        message: mail.sent
          ? "Account is not verified. Verification code sent to your email."
          : "Account is not verified. OTP generated. SMTP is not configured, check server logs.",
      });
    }

    const mail = await issueOtp(user, "reset");
    return res.json(otpResponse(user, mail, "OTP generated. SMTP is not configured, check server logs."));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to send reset OTP" });
  }
}

export async function resetPassword(req, res) {
  try {
    const { email, otp, password, confirmPassword } = req.body;

    if (!email || !otp || !password) {
      return res.status(400).json({ message: "Email, OTP, and password are required" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Passwords do not match" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim(), role: "user" });
    if (!user || user.otpPurpose !== "reset" || !user.otp || !user.otpExpiresAt) {
      return res.status(400).json({ message: "No reset request found. Please request a new OTP." });
    }

    if (user.otpExpiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: "OTP expired. Please resend." });
    }

    if (String(otp).trim() !== user.otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    user.password = await bcrypt.hash(password, 10);
    user.otp = null;
    user.otpExpiresAt = null;
    user.otpPurpose = null;
    await user.save();

    return res.json({ message: "Password updated. You can sign in now." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Password reset failed" });
  }
}

export async function me(req, res) {
  try {
    const user = await User.findById(req.user.id).select("-password -otp");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const referralCount = await User.countDocuments({ referredBy: user._id, isVerified: true });
    return res.json({ user: publicUser(user), referralCount });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Failed to load profile" });
  }
}
