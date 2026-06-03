import type { Context } from "hono";
import mongoose from "mongoose";
import { Project } from "./project.model";
import { buildScopeFilter } from "../../utils/buildScopeFilter";

import { Floor } from "../tower-floor/floor.model";
import { Flat } from "../flat/flat.model";
import { Outside } from "../tower-outside/outside.model";
import { Tower } from "../tower/tower.model";

const isMongoId = (id: string): boolean => mongoose.Types.ObjectId.isValid(id);

export const createProject = async (c: Context) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();

    if (!body.projectName || !body.address || !body.startDate) {
      return c.json(
        {
          success: false,
          message: "projectName, address and startDate are required",
        },
        400
      );
    }

    const exists = await Project.findOne({
      organizationId: user.organizationId,
      projectName: body.projectName,
    });

    if (exists) {
      return c.json(
        { success: false, message: "Project already exists" },
        409
      );
    }

    const project = await Project.create({
      ...body,
      organizationId: user.organizationId,
      ownerId: user._id,
      createdBy: user._id,
    });

    return c.json(
      {
        success: true,
        message: "Project created successfully",
        data: project,
      },
      201
    );
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const getProjects = async (c: Context) => {
  try {
    const user = c.get("user");
    const scopeFilter = await buildScopeFilter(user);

    const page = Number(c.req.query("page")) || 1;
    const limit = Number(c.req.query("limit")) || 10;
    const search = c.req.query("search");
    const status = c.req.query("status");

    const skip = (page - 1) * limit;

    const query: any = {
      ...scopeFilter,
    };

    if (search) {
      query.$or = [
        { projectName: { $regex: search, $options: "i" } },
        { address: { $regex: search, $options: "i" } },
        { Address: { $regex: search, $options: "i" } },
      ];
    }

    if (status) {
      query.status = status;
    }

    const total = await Project.countDocuments(query);

    const projects = await Project.find(query)
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });

    return c.json({
      success: true,
      data: projects,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 500);
  }
};

export const getProjectById = async (c: Context) => {
  try {
    const user = c.get("user");
    const scopeFilter = await buildScopeFilter(user);
    const id = c.req.param("id");

    if (!id) {
      return c.json({ success: false, message: "Project id is required" }, 400);
    }

    if (!isMongoId(id)) {
      return c.json({ success: false, message: "Invalid project id" }, 400);
    }

    const project = await Project.findOne({
      _id: id,
      ...scopeFilter,
    });

    if (!project) {
      return c.json({ success: false, message: "Project not found" }, 404);
    }

    return c.json({
      success: true,
      data: project,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const updateProject = async (c: Context) => {
  try {
    const user = c.get("user");
    const scopeFilter = await buildScopeFilter(user);
    const id = c.req.param("id");
    const body = await c.req.json();

    if (!id) {
      return c.json({ success: false, message: "Project id is required" }, 400);
    }

    if (!isMongoId(id)) {
      return c.json({ success: false, message: "Invalid project id" }, 400);
    }

    if (body.projectName) {
      const exists = await Project.findOne({
        _id: { $ne: id },
        organizationId: user.organizationId,
        projectName: body.projectName,
      });

      if (exists) {
        return c.json(
          { success: false, message: "Project already exists" },
          409
        );
      }
    }

    delete body.organizationId;
    delete body.ownerId;
    delete body.createdBy;

    const project = await Project.findOneAndUpdate(
      {
        _id: id,
        ...scopeFilter,
      },
      body,
      {
        new: true,
        runValidators: true,
      }
    );

    if (!project) {
      return c.json({ success: false, message: "Project not found" }, 404);
    }

    return c.json({
      success: true,
      message: "Project updated successfully",
      data: project,
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};

export const deleteProject = async (c: Context) => {
  try {
    const user = c.get("user");
    const scopeFilter = await buildScopeFilter(user);
    const id = c.req.param("id");

    if (!id) {
      return c.json({ success: false, message: "Project id is required" }, 400);
    }

    if (!isMongoId(id)) {
      return c.json({ success: false, message: "Invalid project id" }, 400);
    }

    const project = await Project.findOneAndDelete({
      _id: id,
      ...scopeFilter,
    });

    if (!project) {
      return c.json({ success: false, message: "Project not found" }, 404);
    }

    return c.json({
      success: true,
      message: "Project deleted successfully",
    });
  } catch (error: any) {
    return c.json({ success: false, message: error.message }, 400);
  }
};




//  get project structure with towers, floors, flats and outside areas

export const getProjectStructure = async (c: Context) => {
  try {
    const user = c.get("user");
    const projectId = c.req.param("projectId");

    if (!projectId || !isMongoId(projectId)) {
      return c.json(
        { success: false, message: "Invalid projectId" },
        400
      );
    }

    const creatorRoleName =
      user?.roleId?.name || user?.roleName || user?.role;

    const queryOrganizationId = c.req.query("organizationId");

    const projectQuery: any = {
      _id: projectId,
      status: "active",
    };

    if (creatorRoleName === "superAdmin") {
      if (queryOrganizationId) {
        if (!isMongoId(queryOrganizationId)) {
          return c.json(
            { success: false, message: "Invalid organizationId" },
            400
          );
        }

        projectQuery.organizationId = queryOrganizationId;
      }
    } else {
      const scopeFilter: any = await buildScopeFilter(user);
      Object.assign(projectQuery, scopeFilter);
    }

    const project = await Project.findOne(projectQuery);

    if (!project) {
      return c.json(
        { success: false, message: "Project not found" },
        404
      );
    }

    const organizationId = project.organizationId;

    const [towers, outsideAreas] = await Promise.all([
      Tower.find({
        organizationId,
        projectId,
        status: "active",
      }).sort({ createdAt: 1 }),

      Outside.find({
        organizationId,
        projectId,
        status: "active",
      }).sort({ createdAt: 1 }),
    ]);

    const towerIds = towers.map((tower) => tower._id);

    const floors = await Floor.find({
      organizationId,
      towerId: { $in: towerIds },
      status: "active",
    }).sort({ createdAt: 1 });

    const floorIds = floors.map((floor) => floor._id);

    const flats = await Flat.find({
      organizationId,
      floorId: { $in: floorIds },
      status: "active",
    }).sort({ createdAt: 1 });

    const structure = {
      project: {
        _id: project._id,
        name: project.projectName,
        address: project.address,
        type: "project",
      },

      nonTowerArea: {
        type: "nonTowerArea",
        name: "Non Tower Area",
        areas: outsideAreas.map((area: any) => ({
          _id: area._id,
          name: area.outsideName,
          type: "outside",
        })),
      },

      towers: towers.map((tower: any) => {
        const towerFloors = floors.filter(
          (floor: any) => String(floor.towerId) === String(tower._id)
        );

        return {
          _id: tower._id,
          name: tower.towerName,
          towerNumber: tower.towerNumber,
          type: "tower",
          totalFloors: towerFloors.length,
          floors: towerFloors.map((floor: any) => {
            const floorFlats = flats.filter(
              (flat: any) => String(flat.floorId) === String(floor._id)
            );

            return {
              _id: floor._id,
              name: floor.floorName,
              floorNumber: floor.floorNumber,
              type: "floor",
              totalFlats: floorFlats.length,
              flats: floorFlats.map((flat: any) => ({
                _id: flat._id,
                name: flat.flatName,
                flatNumber: flat.flatNumber,
                type: "flat",
              })),
            };
          }),
        };
      }),
    };

    return c.json({
      success: true,
      data: structure,
    });
  } catch (error: any) {
    return c.json(
      { success: false, message: error.message },
      400
    );
  }
};