import mongoose, { Schema, Document } from "mongoose";

export interface IVendor extends Document {
  organizationId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;

  vendorCode: string;
  name: string;
  companyName: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  gstNumber: string;
  panNumber: string;
  contactPerson: string;
  contactNumber: string;
  alternateNumber: string;
  email: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  status: "active" | "inactive";

  itemId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const vendorSchema = new Schema<IVendor>(
  {
    organizationId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    ownerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    vendorCode: {
      type: String,
      required: [true, "Vendor Code is required"],
      trim: true,
    },

    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      index: true,
    },

    companyName: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "" },
    state: { type: String, trim: true, default: "" },
    pincode: { type: String, trim: true, default: "" },

    gstNumber: { type: String, trim: true, index: true, default: "" },
    panNumber: { type: String, trim: true, default: "" },

    contactPerson: { type: String, trim: true, index: true, default: "" },
    contactNumber: { type: String, trim: true, index: true, default: "" },
    alternateNumber: { type: String, trim: true, default: "" },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },

    bankName: { type: String, trim: true, default: "" },
    accountNumber: { type: String, trim: true, default: "" },
    ifscCode: { type: String, trim: true, uppercase: true, default: "" },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },

    itemId: {
      type: Schema.Types.ObjectId,
      ref: "Item",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

vendorSchema.index(
  { organizationId: 1, vendorCode: 1 },
  { unique: true }
);

export const Vendor = mongoose.model<IVendor>("Vendor", vendorSchema);