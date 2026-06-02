import type { Context } from "hono";
import mongoose from "mongoose";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

import { Project } from "../project/project.model";
import { ProjectDocument } from "./projectDocument.model";
import { buildScopeFilter } from "../../utils/buildScopeFilter";
import { User } from "../User/user.model";

const isValidObjectId = (id: any) =>
  mongoose.Types.ObjectId.isValid(id);

const checkProjectAccess = async (user: any, projectId: string) => {
  const scopeFilter: any = await buildScopeFilter(user);

  return Project.findOne({
    _id: projectId,
    ...scopeFilter,
    status: "active",
  });
};

const saveProjectFile = async (file: File) => {
  const uploadDir = path.join(process.cwd(), "uploads", "project-documents");

  await mkdir(uploadDir, { recursive: true });

  const fileName = `${Date.now()}-${file.name}`;
  const filePath = path.join(uploadDir, fileName);

  const buffer = Buffer.from(await file.arrayBuffer());

  await writeFile(filePath, buffer);

  return {
    filePath: `/uploads/project-documents/${fileName}`,
    fileName: file.name,
  };
};

export const createProjectDocument = async (c: Context) => {
  try {
    const user = c.get("user");
    const projectId = c.req.param("projectId");
    // const body = await c.req.parseBody();
    const body = await c.req.parseBody({ all: true });

    const title = body.title ? String(body.title) : "";
    const note = body.note ? String(body.note) : null;

    if (!projectId || !isValidObjectId(projectId)) {
      return c.json(
        { success: false, message: "Invalid projectId" },
        400
      );
    }

    if (!title) {
      return c.json(
        {
          success: false,
          message: "title is required",
        },
        400
      );
    }

    const uploadedFiles = body.files;

    if (!uploadedFiles) {
      return c.json(
        {
          success: false,
          message: "files are required",
        },
        400
      );
    }

    const filesArray = Array.isArray(uploadedFiles)
      ? uploadedFiles
      : [uploadedFiles];

    const files: any[] = [];

    for (const file of filesArray) {
      if (typeof file === "string") continue;

      const savedFile = await saveProjectFile(file as File);
      files.push(savedFile);
    }

    if (!files.length) {
      return c.json(
        {
          success: false,
          message: "Valid files are required",
        },
        400
      );
    }

    const project = await checkProjectAccess(user, projectId);

    if (!project) {
      return c.json(
        { success: false, message: "Project not found" },
        404
      );
    }

    const projectOwner = await User.findOne({
      _id: project.ownerId,
      organizationId: user.organizationId,
      status: "active",
    }).select("nodeIds");

    const document = await ProjectDocument.create({
      organizationId: user.organizationId,
      projectId,
      nodeId: projectOwner?.nodeIds?.[0] || null,
      title,
      files,
      note,
      uploadedBy: user._id,
    });

    return c.json(
      {
        success: true,
        message: "Project document uploaded successfully",
        data: document,
      },
      201
    );
  } catch (error: any) {
    return c.json(
      { success: false, message: error.message },
      400
    );
  }
};

export const getProjectDocuments = async (c: Context) => {
  try {
    const user = c.get("user");
    const projectId = c.req.param("projectId");

    const page = Number(c.req.query("page")) || 1;
    const limit = Number(c.req.query("limit")) || 10;
    const search = c.req.query("search");

    const skip = (page - 1) * limit;

    if (!projectId || !isValidObjectId(projectId)) {
      return c.json(
        { success: false, message: "Invalid projectId" },
        400
      );
    }

    const project = await checkProjectAccess(user, projectId);

    if (!project) {
      return c.json(
        { success: false, message: "Project not found" },
        404
      );
    }

    const filter: any = {
      organizationId: user.organizationId,
      projectId,
      status: "active",
    };

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { "files.fileName": { $regex: search, $options: "i" } },
        { note: { $regex: search, $options: "i" } },
      ];
    }

    const [documents, total] = await Promise.all([
      ProjectDocument.find(filter)
        .populate("uploadedBy", "name email mobile")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      ProjectDocument.countDocuments(filter),
    ]);

    return c.json({
      success: true,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      data: documents,
    });
  } catch (error: any) {
    return c.json(
      { success: false, message: error.message },
      400
    );
  }
};

export const updateProjectDocument = async (c: Context) => {
  try {
    const user = c.get("user");
    const id = c.req.param("id");
    // const body = await c.req.parseBody();
    const body = await c.req.parseBody({ all: true });

    if (!isValidObjectId(id)) {
      return c.json(
        { success: false, message: "Invalid document id" },
        400
      );
    }

    const document = await ProjectDocument.findOne({
      _id: id,
      organizationId: user.organizationId,
      status: "active",
    });

    if (!document) {
      return c.json(
        { success: false, message: "Document not found" },
        404
      );
    }

    const project = await checkProjectAccess(
      user,
      String(document.projectId)
    );

    if (!project) {
      return c.json(
        { success: false, message: "Project not found in your scope" },
        404
      );
    }

    if (body.title !== undefined) document.title = String(body.title);
    if (body.note !== undefined) document.note = String(body.note);

    const uploadedFiles = body.files;

    if (uploadedFiles) {
      const filesArray = Array.isArray(uploadedFiles)
        ? uploadedFiles
        : [uploadedFiles];

      const files: any[] = [];

      for (const file of filesArray) {
        if (typeof file === "string") continue;

        const savedFile = await saveProjectFile(file as File);
        files.push(savedFile);
      }

      if (files.length) {
        document.files = files as any;
      }
    }

    await document.save();

    return c.json({
      success: true,
      message: "Project document updated successfully",
      data: document,
    });
  } catch (error: any) {
    return c.json(
      { success: false, message: error.message },
      400
    );
  }
};

export const deleteProjectDocument = async (c: Context) => {
  try {
    const user = c.get("user");
    const id = c.req.param("id");

    if (!isValidObjectId(id)) {
      return c.json(
        { success: false, message: "Invalid document id" },
        400
      );
    }

    const document = await ProjectDocument.findOne({
      _id: id,
      organizationId: user.organizationId,
      status: "active",
    });

    if (!document) {
      return c.json(
        { success: false, message: "Document not found" },
        404
      );
    }

    const project = await checkProjectAccess(
      user,
      String(document.projectId)
    );

    if (!project) {
      return c.json(
        { success: false, message: "Project not found in your scope" },
        404
      );
    }

    document.status = "inactive";
    await document.save();

    return c.json({
      success: true,
      message: "Project document deleted successfully",
    });
  } catch (error: any) {
    return c.json(
      { success: false, message: error.message },
      400
    );
  }
};