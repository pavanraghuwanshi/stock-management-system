import mongoose from "mongoose";

const businessNodeSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    type: {
      type: String,
      required: true,
      trim: true,
      // site, branch, department, team, class, store, warehouse
    },

    parentNodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessNode",
      default: null,
    },

    ancestorNodeIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BusinessNode",
      },
    ],

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

businessNodeSchema.index({ organizationId: 1, parentNodeId: 1 });
businessNodeSchema.index({ organizationId: 1, ancestorNodeIds: 1 });

export const BusinessNode = mongoose.model(
  "BusinessNode",
  businessNodeSchema
);