import mongoose, { Schema, Document } from "mongoose";

export interface IOutside extends Document {
  organizationId: mongoose.Types.ObjectId;
  ownerId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;

  outsideName: string;
  outsideNote?: string;
  projectId?: mongoose.Types.ObjectId;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

const outsideSchema = new Schema<IOutside>(
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
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      default: null,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    outsideName: {
      type: String,
      required: [true, "Outside Name is required"],
      trim: true,
      index: true,
    },

    outsideNote: {
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
  { timestamps: true }
);

outsideSchema.index(
  { organizationId: 1, towerId: 1, outsideName: 1 },
  { unique: true }
);

export const Outside = mongoose.model<IOutside>("Outside", outsideSchema);