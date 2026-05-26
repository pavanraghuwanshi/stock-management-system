import mongoose from "mongoose";

const encryptedPasswordSchema = new mongoose.Schema(
  {
    iv: { type: String, required: true },
    content: { type: String, required: true },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    name: { type: String, required: true, trim: true },

    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },

    mobile: {
      type: String,
      trim: true,
      default: null,
      unique:true
    },

    password: {
      type: encryptedPasswordSchema,
      required: true,
      select: false,
    },

    roleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Role",
      required: true,
    },

    nodeIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "BusinessNode",
      },
    ],

    primaryNodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessNode",
      default: null,
    },

    reportsTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    ancestorUserIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    geofenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Geofence",
      default: null,
    },

    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },

    profileImage: {
      type: String,
      default: null,
    },

    attendancePolicyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AttendancePolicy",
      default: null,
    },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.index({ organizationId: 1, email: 1 }, { unique: true });
userSchema.index({ organizationId: 1, reportsTo: 1 });
userSchema.index({ organizationId: 1, ancestorUserIds: 1 });

export const User = mongoose.model("User", userSchema);