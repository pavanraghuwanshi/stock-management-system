import mongoose, { Schema, Document } from "mongoose";

export interface ITower extends Document {
  organizationId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;

  towerName: string;
  towerNumber: string;
  projectId: mongoose.Types.ObjectId;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

const towerSchema = new Schema<ITower>(
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

    towerName: {
      type: String,
      required: [true, "Tower Name is required"],
      trim: true,
      index: true,
    },

    towerNumber: {
      type: String,
      required: [true, "Tower Number is required"],
      trim: true,
      index: true,
    },

    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: [true, "Project ID is required"],
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

towerSchema.index(
  { organizationId: 1, projectId: 1, towerNumber: 1 },
  { unique: true }
);

export const Tower = mongoose.model<ITower>("Tower", towerSchema);