import mongoose from "mongoose";

const levelSchema = new mongoose.Schema(
  {
    level: { type: Number, required: true },
    percent: { type: Number, required: true },
  },
  { _id: false }
);

const referralPlanSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    durationDays: { type: Number, default: 0 },
    amountUsdt: { type: Number, default: 0 },
    totalPercent: { type: Number, required: true },
    levels: { type: [levelSchema], default: [] },
    active: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

export const ReferralPlan = mongoose.model("ReferralPlan", referralPlanSchema);

export async function ensureReferralPlans() {
  let indexes = [];
  try {
    indexes = await ReferralPlan.collection.indexes();
  } catch (error) {
    if (error.codeName === "NamespaceNotFound" || error.code === 26) {
      return;
    }
    throw error;
  }

  if (indexes.some((index) => index.name === "key_1")) {
    await ReferralPlan.collection.dropIndex("key_1");
  }

  const legacy = await ReferralPlan.collection.find({ key: "default" }).toArray();
  for (const doc of legacy) {
    await ReferralPlan.collection.updateOne(
      { _id: doc._id },
      {
        $set: {
          name: doc.name || "Plan 1",
          active: Boolean(doc.configured || doc.active),
        },
        $unset: { key: "", configured: "" },
      }
    );
  }
}
