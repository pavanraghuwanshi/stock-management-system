import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/db";

import { Organization } from "../modules/Organization/organization.model";
import { Role } from "../modules/roles/role.model";
import { User } from "../modules/User/user.model";

import { encryptPassword } from "../utils/crypto";

const seedSuperAdmin = async () => {
  try {
    await connectDB();

    console.log("🌱 Starting Super Admin Seeder...");

    // ---------------------------------------------------
    // CHECK EXISTING ORGANIZATION
    // ---------------------------------------------------

    let organization = await Organization.findOne({
      name: "System Super Admin",
    });

    if (!organization) {
      organization = await Organization.create({
        name: "System Super Admin",
        industryType: "system",
        isActive: true,
      });

      console.log("✅ Super organization created");
    } else {
      console.log("ℹ️ Super organization already exists");
    }

    // ---------------------------------------------------
    // CHECK SUPER ROLE
    // ---------------------------------------------------

    let superAdminRole = await Role.findOne({
      organizationId: organization._id,
      name: "Super Admin",
    });

    if (!superAdminRole) {
      superAdminRole = await Role.create({
        organizationId: organization._id,

        name: "Super Admin",

        scope: "organization",

        permissions: [
          "*",

          // user
          "user:create",
          "user:view",
          "user:update",
          "user:delete",

          // role
          "role:create",
          "role:view",
          "role:update",
          "role:delete",

          // unit
          "unit:create",
          "unit:view",
          "unit:update",
          "unit:delete",

          // organization
          "organization:create",
          "organization:view",
          "organization:update",
          "organization:delete",

          // lead
          "lead:create",
          "lead:view",
          "lead:update",
          "lead:delete",
        ],

        canCreateRoles: [],

        isSystemRole: true,
        isActive: true,
      });

      console.log("✅ Super Admin role created");
    } else {
      console.log("ℹ️ Super Admin role already exists");
    }

    // ---------------------------------------------------
    // SELF CREATE ACCESS
    // ---------------------------------------------------

    const roleAlreadyAdded = superAdminRole.canCreateRoles
      .map((id) => id.toString())
      .includes(String(superAdminRole._id));

    if (!roleAlreadyAdded) {
      superAdminRole.canCreateRoles.push(
        superAdminRole._id as mongoose.Types.ObjectId
      );

      await superAdminRole.save();
    }

    // ---------------------------------------------------
    // CHECK SUPER USER
    // ---------------------------------------------------

    const email = "superadmin@example.com";

    const existingUser = await User.findOne({
      organizationId: organization._id,
      email,
    });

    if (!existingUser) {
      const encryptedPassword = encryptPassword("SuperAdmin@123");

      const user = await User.create({
        organizationId: organization._id,

        name: "Super Admin",

        email,

        mobile: "9999999999",

        password: encryptedPassword,

        roleId: superAdminRole._id,

        unitIds: [],

        primaryUnitId: null,

        reportsTo: null,

        ancestorUserIds: [],

        isActive: true,
      });

      console.log("✅ Super Admin user created");

      console.log(`
--------------------------------------------------

🚀 SUPER ADMIN LOGIN

Email    : ${email}
Password : SuperAdmin@123

--------------------------------------------------
      `);
    } else {
      console.log("ℹ️ Super Admin user already exists");
    }

    console.log("🎉 Seeder completed");

    process.exit(0);
  } catch (error: any) {
    console.error("❌ Seeder Error:", error.message);

    process.exit(1);
  }
};

seedSuperAdmin();