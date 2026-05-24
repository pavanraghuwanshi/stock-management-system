import mongoose, { Schema, Document } from "mongoose";

export interface IProject extends Document {
  organizationId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;

  projectName: string;
  address: string;
  startDate: Date;
  notes?: string;
  status: "active" | "inactive";

  createdAt: Date;
  updatedAt: Date;
}

const projectSchema = new Schema<IProject>(
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

    projectName: {
      type: String,
      required: [true, "Project Name is required"],
      trim: true,
      index: true,
    },

    // lowercase rakho consistency ke liye
    address: {
      type: String,
      required: [true, "Address is required"],
      trim: true,
    },

    startDate: {
      type: Date,
      required: [true, "Start Date is required"],
    },

    notes: {
      type: String,
      trim: true,
      default: "",
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

// same organization me duplicate project name avoid
projectSchema.index(
  { organizationId: 1, projectName: 1 },
  { unique: true }
);

export const Project = mongoose.model<IProject>(
  "Project",
  projectSchema
);