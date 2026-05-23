import mongoose from "mongoose";

export type ScopeType =
  | "organization"
  | "unit"
  | "child_units"
  | "team"
  | "self"
  | "custom";

const roleSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: null,
      trim: true,
    },

    permissions: [
      {
        type: String,
        trim: true,
      },
    ],

    scope: {
      type: String,
      enum: [
        "organization",
        "unit",
        "child_units",
        "team",
        "self",
        "custom",
      ],
      default: "self",
    },

    canCreateRoles: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Role",
      },
    ],

    isSystemRole: {
      type: Boolean,
      default: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

roleSchema.index(
  {
    organizationId: 1,
    name: 1,
  },
  {
    unique: true,
  }
);

roleSchema.index({
  organizationId: 1,
  isActive: 1,
});

export const Role = mongoose.model("Role", roleSchema);