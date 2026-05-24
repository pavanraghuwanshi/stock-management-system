import mongoose, { Schema, Document } from "mongoose";

export interface IFlat extends Document {
  organizationId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;

  flatName: string;
  flatNumber: string;
  floorId: mongoose.Types.ObjectId;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

const flatSchema = new Schema<IFlat>(
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

    flatName: {
      type: String,
      required: [true, "Flat Name is required"],
      trim: true,
      index: true,
    },

    flatNumber: {
      type: String,
      required: [true, "Flat Number is required"],
      trim: true,
      index: true,
    },

    floorId: {
      type: Schema.Types.ObjectId,
      ref: "Floor",
      required: [true, "Floor ID is required"],
      index: true,
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

flatSchema.index(
  { organizationId: 1, floorId: 1, flatNumber: 1 },
  { unique: true }
);

export const Flat = mongoose.model<IFlat>("Flat", flatSchema);