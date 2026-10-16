import nodemailer from "nodemailer";

function createTransport() {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT || 587);

  if (!host || !user || !pass) {
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });
}

export async function sendOtpEmail(to, otp, purpose = "verify") {
  const transporter = createTransport();
  const from = process.env.SMTP_FROM || process.env.SMTP_USER;
  const isReset = purpose === "reset";
  const subject = isReset ? "Reset your password" : "Your verification OTP";
  const heading = isReset ? "Reset your password" : "Verify your account";
  const body = isReset
    ? "Use this OTP to set a new password. It expires in 10 minutes."
    : "Use this OTP to complete signup. It expires in 10 minutes.";

  if (!transporter) {
    console.log(`[OTP] SMTP not configured. ${purpose} OTP for ${to}: ${otp}`);
    return { sent: false };
  }

  await transporter.sendMail({
    from,
    to,
    subject,
    text: `Your OTP is ${otp}. It expires in 10 minutes.`,
    html: `
      <div style="background:#0d0d0d;color:#f5f5f5;padding:32px;font-family:Arial,sans-serif">
        <h2 style="color:#e4c066;margin:0 0 12px">${heading}</h2>
        <p>${body}</p>
        <p style="font-size:28px;letter-spacing:6px;font-weight:bold;color:#e4c066">${otp}</p>
      </div>
    `,
  });

  return { sent: true };
}
