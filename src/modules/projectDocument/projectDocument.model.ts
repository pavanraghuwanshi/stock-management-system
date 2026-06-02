import mongoose from "mongoose";

const projectDocumentSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },

    nodeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "BusinessNode",
      default: null,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    files: [
      {
        filePath: {
          type: String,
          required: true,
        },
        fileName: {
          type: String,
          required: true,
        },
      },
    ],

    note: {
      type: String,
      default: null,
    },

    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
  },
  { timestamps: true }
);

projectDocumentSchema.index({
  organizationId: 1,
  projectId: 1,
});

export const ProjectDocument = mongoose.model(
  "ProjectDocument",
  projectDocumentSchema
);