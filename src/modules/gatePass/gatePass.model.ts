import mongoose, { Schema, Document } from "mongoose";

export interface IGatePass extends Document {
  organizationId: mongoose.Types.ObjectId;
  purchaseOrderId: mongoose.Types.ObjectId;
  indentId: mongoose.Types.ObjectId;
  projectId: mongoose.Types.ObjectId;
  requesterId: mongoose.Types.ObjectId;
  vendorId: mongoose.Types.ObjectId;
  vendorName?: string;
  vehicleNumber?: string;
  driverName?: string;
  gatePassNo: string;
  images: string[];
  items: any[];
  status: "PendingApproval" | "Approved" | "Rejected";
  isStockPosted: boolean;
  isVerifiedAtLocation: boolean;
  verificationNote?: string;
  verifiedBy?: mongoose.Types.ObjectId;
  verifiedAt?: Date;
  approvedBy?: mongoose.Types.ObjectId;
  approvedAt?: Date;
  rejectedReason?: string;
  createdBy: mongoose.Types.ObjectId;
  isActive: boolean;
}

const GatePassSchema = new Schema(
  {
    organizationId: { type: Schema.Types.ObjectId, required: true, index: true },
    purchaseOrderId: { type: Schema.Types.ObjectId, ref: "PurchaseOrder", required: true },
    indentId: { type: Schema.Types.ObjectId, ref: "Indent", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
    requesterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    vendorId: { type: Schema.Types.ObjectId, required: true },
    vendorName: String,
    vehicleNumber: String,
    driverName: String,
    gatePassNo: { type: String, required: true },
    images: [{ type: String }],
    items: [
      {
        itemId: { type: Schema.Types.ObjectId, ref: "Item", required: true },
        unitId: { type: Schema.Types.ObjectId, ref: "Unit", required: true },
        receivedQuantity: { type: Number, required: true },
        approvedQuantity: { type: Number, default: 0 },

        assetName: String,
        assetType: String,
        serialNumbers: [String],
        maintenanceDueDate: Date,
        extraNote: String,
      },
    ],
    status: {
      type: String,
      enum: ["PendingApproval", "Approved", "Rejected"],
      default: "PendingApproval",
    },
    isStockPosted: { type: Boolean, default: false },
    isVerifiedAtLocation: { type: Boolean, default: false },
    verificationNote: String,
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User" },
    verifiedAt: Date,
    approvedBy: { type: Schema.Types.ObjectId, ref: "User" },
    approvedAt: Date,
    rejectedReason: String,
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const GatePass = mongoose.model<IGatePass>("GatePass", GatePassSchema);