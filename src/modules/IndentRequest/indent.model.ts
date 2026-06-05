import mongoose from "mongoose";

const indentItemSchema = new mongoose.Schema(
  {
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Unit",
      required: true,
    },
  },
  { _id: false }
);

const indentSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    indentId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    priority: {
      type: String,
      enum: ["low", "medium", "high", "urgent"],
      default: "low",
      index: true,
    },

    estimateDeliveryDate: {
      type: Date,
      default: null,
    },

    indentFor: {
      type: String,
      enum: ["project", "tower", "floor", "flat"],
      required: true,
      index: true,
    },

    towerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tower",
      default: null,
    },

    floorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Floor",
      default: null,
    },

    flatId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Flat",
      default: null,
    },

    storageLocation: {
      type: String,
      default: null,
      trim: true,
    },

    items: {
      type: [indentItemSchema],
      required: true,
      default: [],
    },

    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected", "ConvertedToPO"],
      default: "Pending",
      index: true,
    },

    requestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    ownerId: {
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

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    rejectionReason: {
      type: String,
      default: null,
      trim: true,
    },

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
);

indentSchema.index({ organizationId: 1, userId: 1 });
indentSchema.index({ organizationId: 1, status: 1 });
indentSchema.index({ organizationId: 1, projectId: 1 });

export const Indent = mongoose.model("Indent", indentSchema);