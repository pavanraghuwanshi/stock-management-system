import mongoose, { Schema, Document } from "mongoose";

export interface IUnit extends Document {
  organizationId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;

  label: string;
  value: string;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

const unitSchema = new Schema<IUnit>(
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

    label: {
      type: String,
      required: [true, "Label is required"],
      trim: true,
      index: true,
    },

    value: {
      type: String,
      required: [true, "Value is required"],
      trim: true,
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

unitSchema.index(
  { organizationId: 1, value: 1 },
  { unique: true }
);

export const Unit = mongoose.model<IUnit>("Unit", unitSchema);