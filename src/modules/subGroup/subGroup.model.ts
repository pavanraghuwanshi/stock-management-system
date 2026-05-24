import mongoose, { Schema, Document } from "mongoose";

export interface ISubGroup extends Document {
  organizationId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;

  groupId: mongoose.Types.ObjectId;
  name: string;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

const subGroupSchema = new Schema<ISubGroup>(
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

    groupId: {
      type: Schema.Types.ObjectId,
      ref: "Group",
      required: [true, "Group ID is required"],
      index: true,
    },

    name: {
      type: String,
      required: [true, "Name is required"],
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
  { timestamps: true }
);

subGroupSchema.index(
  { organizationId: 1, groupId: 1, name: 1 },
  { unique: true }
);

export const SubGroup = mongoose.model<ISubGroup>(
  "SubGroup",
  subGroupSchema
);