import mongoose, { Schema, Document } from "mongoose";

export interface IFloor extends Document {
  organizationId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;

  floorName: string;
  floorNumber: string;
  towerId: mongoose.Types.ObjectId;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

const floorSchema = new Schema<IFloor>(
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

    floorName: {
      type: String,
      required: [true, "Floor Name is required"],
      trim: true,
      index: true,
    },

    floorNumber: {
      type: String,
      required: [true, "Floor Number is required"],
      trim: true,
      index: true,
    },

    towerId: {
      type: Schema.Types.ObjectId,
      ref: "Tower",
      required: [true, "Tower ID is required"],
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

floorSchema.index(
  { organizationId: 1, towerId: 1, floorNumber: 1 },
  { unique: true }
);

export const Floor = mongoose.model<IFloor>("Floor", floorSchema);