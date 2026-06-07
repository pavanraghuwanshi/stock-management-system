import mongoose from "mongoose";

const materialStockSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
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

    quantity: { type: Number, default: 0 },

    sourceType: {
      type: String,
      enum: ["PurchaseOrder"],
      default: "PurchaseOrder",
    },

    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PurchaseOrder",
    },
  },
  { timestamps: true }
);

export const MaterialStock = mongoose.model(
  "MaterialStock",
  materialStockSchema
);