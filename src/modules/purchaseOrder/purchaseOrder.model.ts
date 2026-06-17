import mongoose from "mongoose";

const poItemSchema = new mongoose.Schema(
  {
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

    indentQuantity: { type: Number, default: 0 },
    orderQuantity: { type: Number, required: true },

    receivedQuantity: { type: Number, default: 0 },
    issuedToRequesterQuantity: { type: Number, default: 0 },
    stockQuantity: { type: Number, default: 0 },

    rate: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
  },
  { _id: false }
);

const approvalStatusSchema = new mongoose.Schema(
  {
    level: Number,
    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
    },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    approvedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },
  },
  { _id: false }
);

const purchaseOrderSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
    },

    poNo: { type: String, required: true, unique: true },

    indentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Indent",
      required: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Vendor",
      required: true,
    },

    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },

    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    vendorName: { type: String, required: true },
    vendorMobile: { type: String, default: null },
    vendorAddress: { type: String, default: null },

    items: { type: [poItemSchema], default: [] },

    totalAmount: { type: Number, default: 0 },
  images: [{ type: String }],
    status: {
      type: String,
      enum: [
        "Draft",
        "PendingApproval",
        "Approved",
        "Rejected",
        "Ordered",
        "PartiallyReceived",
        "Received",
        "Issued",
        "Cancelled",
      ],
      default: "Draft",
    },

    approvalFlowId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ApprovalFlow",
      default: null,
    },

    currentApprovalLevel: { type: Number, default: 0 },

    approvals: { type: [approvalStatusSchema], default: [] },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    approvedAt: { type: Date, default: null },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const PurchaseOrder = mongoose.model(
  "PurchaseOrder",
  purchaseOrderSchema
);