require("dotenv").config();
const users = require("./models/users");
const casesModel = require("./models/cases");
const misc = require("./models/misc");
const pool = require("./lib/db");

async function ensureUser(spec) {
  const existing = await users.findByEmail(spec.email);
  if (existing) return existing;
  const u = await users.create(spec);
  console.log(`created user: ${spec.email} / ${spec.password}  (${spec.role})`);
  return u;
}

async function main() {
  const admin = await ensureUser({
    name: "Shampa Banik", email: "admin@aipath.edu", password: "password123",
    role: "admin", institution: "BUBT Dept. of CSE",
  });
  const drRahman = await ensureUser({
    name: "Dr. Ashiqur Rahman", email: "ashiqur.rahman@aipath.edu", password: "password123",
    role: "pathologist", institution: "General Hospital Pathology Dept",
  });
  const drMohaimin = await ensureUser({
    name: "Dr. Nabil Mohaimin", email: "nabil.mohaimin@aipath.edu", password: "password123",
    role: "pathologist", institution: "General Hospital Pathology Dept",
  });
  await ensureUser({
    name: "Nusrat Jahan Nabila", email: "nusrat.nabila@aipath.edu", password: "password123",
    role: "lab_tech", institution: "General Hospital Pathology Dept",
  });
  await ensureUser({
    name: "Mst. Sadia", email: "sadia@aipath.edu", password: "password123",
    role: "lab_tech", institution: "General Hospital Pathology Dept", status: "Invited",
  });
  await ensureUser({
    name: "Dr. Elena Volkov", email: "researcher@aipath.edu", password: "password123",
    role: "researcher", institution: "General Hospital Pathology Dept",
  });

  const sampleCases = [
    { patientName: "Fatima Islam", age: 54, gender: "Female", specimenType: "Breast Tissue (Core Biopsy)", assignedTo: drRahman.name },
    { patientName: "Md. Karim Hossain", age: 61, gender: "Male", specimenType: "Lung Resection", assignedTo: drRahman.name },
    { patientName: "Abdur Rahim", age: 47, gender: "Male", specimenType: "Prostate Needle Biopsy", assignedTo: drMohaimin.name },
    { patientName: "Nasrin Akter", age: 39, gender: "Female", specimenType: "Gastric Mucosa", assignedTo: drMohaimin.name },
    { patientName: "Shirin Sultana", age: 66, gender: "Female", specimenType: "Skin Excision", assignedTo: drRahman.name },
    { patientName: "Jashim Uddin", age: 58, gender: "Male", specimenType: "Colon Polyp (VIM-Polyp)", assignedTo: drMohaimin.name },
  ];

  const existingCases = await casesModel.listAll();
  if (existingCases.length === 0) {
    for (const c of sampleCases) {
      await casesModel.create({ ...c, createdById: admin.id });
    }
    console.log(`created ${sampleCases.length} sample patient cases`);

    await misc.logAction({ actorName: "System", action: "Deployed inference pipeline v1.0", target: "AI Service" });
    await misc.logAction({ actorName: admin.name, actorId: admin.id, action: "Seeded demo environment", target: "System" });
  } else {
    console.log("cases already exist, skipping case seed");
  }

  console.log("\nSeed complete. Demo login credentials (password: password123):");
  console.log("  admin@aipath.edu          (Admin)");
  console.log("  ashiqur.rahman@aipath.edu (Pathologist)");
  console.log("  nabil.mohaimin@aipath.edu (Pathologist)");
  console.log("  nusrat.nabila@aipath.edu  (Lab Technician)");
  console.log("  researcher@aipath.edu     (Researcher)");
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
