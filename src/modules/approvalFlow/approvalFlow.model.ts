import mongoose from "mongoose";

const approvalLevelSchema = new mongoose.Schema(
  {
    level: { type: Number, required: true },
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },
  },
  { _id: false }
);

const approvalFlowSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },

    flowName: { type: String, required: true, trim: true },

    moduleName: {
      type: String,
      required: true,
      enum: ["indent", "purchaseOrder"],
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },

    levels: {
      type: [approvalLevelSchema],
      default: [],
    },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const ApprovalFlow = mongoose.model("ApprovalFlow", approvalFlowSchema);