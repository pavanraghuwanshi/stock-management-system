import mongoose from "mongoose";

const materialIssueSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },

    stockId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MaterialStock",
      required: true,
    },

    indentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Indent",
      required: true,
    },

    purchaseOrderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseOrder",
      required: true,
    },

    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },

    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      required: true,
    },

    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Unit",
      required: true,
    },

    issueQuantity: {
      type: Number,
      required: true,
    },

    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    note: {
      type: String,
      default: null,
    },
  },
  { timestamps: true }
);

export const MaterialIssue = mongoose.model(
  "MaterialIssue",
  materialIssueSchema
);