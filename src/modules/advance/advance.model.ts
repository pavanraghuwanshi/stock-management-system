// advance.model.ts

import mongoose from "mongoose";

const advanceSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    nodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessNode",
      default: null,
      index: true,
    },

    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    reason: {
      type: String,
      required: true,
      trim: true,
    },

    advanceDate: {
      type: Date,
      default: Date.now,
    },

    status: {
      type: String,
      enum: ["Active", "Settled", "Cancelled"],
      default: "Active",
      index: true,
    },

    note: {
      type: String,
      default: null,
      trim: true,
    },

    givenBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    settledAt: {
      type: Date,
      default: null,
    },

    settledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

advanceSchema.index({ organizationId: 1, userId: 1 });
advanceSchema.index({ organizationId: 1, nodeId: 1 });
advanceSchema.index({ organizationId: 1, status: 1 });

export const Advance = mongoose.model("Advance", advanceSchema);