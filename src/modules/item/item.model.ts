import mongoose, { Schema, Document } from "mongoose";

export interface IItem extends Document {
  organizationId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;

  itemCode: string;
  HSNcode: string;
  itemName: string;
  blockItem: boolean;
  specification: string;
  openingLedger: string;
  openingPhysical: string;
  size: string;
  info: string;
  unitId: mongoose.Types.ObjectId;
  groupId: mongoose.Types.ObjectId;
  subGroupId: mongoose.Types.ObjectId;
  newItemCode: string;
  price: string;
  minLevel: string;
  maxLevel: string;
  gstPercentage: string;
  createdAt: Date;
  updatedAt: Date;
}

const itemSchema = new Schema<IItem>(
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

    itemCode: {
      type: String,
      required: [true, "Item Code is required"],
      trim: true,
    },
    HSNcode: {
      type: String,
      trim: true,
      index: true,
      default: "",
    },
    itemName: {
      type: String,
      required: [true, "Item Name is required"],
      trim: true,
      index: true,
    },
    blockItem: {
      type: Boolean,
      default: false,
      index: true,
    },
    specification: { type: String, trim: true, default: "" },
    openingLedger: { type: String, trim: true, default: "" },
    openingPhysical: { type: String, trim: true, default: "" },
    size: { type: String, trim: true, default: "" },
    info: { type: String, trim: true, default: "" },

    unitId: {
      type: Schema.Types.ObjectId,
      ref: "Unit",
      index: true,
    },
    groupId: {
      type: Schema.Types.ObjectId,
      ref: "Group",
      index: true,
    },
    subGroupId: {
      type: Schema.Types.ObjectId,
      ref: "SubGroup",
      index: true,
    },

    newItemCode: {
      type: String,
      trim: true,
      default: "",
    },
    price: { type: String, trim: true, default: "" },
    minLevel: { type: String, trim: true, default: "" },
    maxLevel: { type: String, trim: true, default: "" },
    gstPercentage: { type: String, trim: true, default: "" },
  },
  { timestamps: true }
);

itemSchema.index(
  { organizationId: 1, itemCode: 1 },
  { unique: true }
);

itemSchema.index(
  { organizationId: 1, newItemCode: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { newItemCode: { $type: "string", $ne: "" } },
  }
);

export const Item = mongoose.model<IItem>("Item", itemSchema);