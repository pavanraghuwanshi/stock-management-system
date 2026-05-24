import { BusinessNode } from "../modules/businessNode/businessNode.model";
import { User } from "../modules/User/user.model";

export const buildScopeFilter = async (user: any) => {
  const role = user.roleId;

  const base = {
    organizationId: user.organizationId,
  };

  if (!role) {
    return {
      ...base,
      ownerId: user._id,
    };
  }

  if (role.scope === "organization") {
    return base;
  }

  if (role.scope === "unit") {
    return {
      ...base,
      nodeId: { $in: user.nodeIds || [] },
    };
  }

  if (role.scope === "child_units") {
    const childNodes = await BusinessNode.find({
      organizationId: user.organizationId,
      ancestorNodeIds: { $in: user.nodeIds || [] },
      isActive: true,
    }).select("_id");

    const nodeIds = [
      ...(user.nodeIds || []),
      ...childNodes.map((node) => node._id),
    ];

    return {
      ...base,
      nodeId: { $in: nodeIds },
    };
  }

  if (role.scope === "team") {
    const teamUsers = await User.find({
      organizationId: user.organizationId,
      ancestorUserIds: user._id,
      isActive: true,
    }).select("_id");

    const userIds = [user._id, ...teamUsers.map((u) => u._id)];

    return {
      ...base,
      ownerId: { $in: userIds },
    };
  }

  if (role.scope === "self") {
    return {
      ...base,
      ownerId: user._id,
    };
  }

  return {
    ...base,
    ownerId: user._id,
  };
};