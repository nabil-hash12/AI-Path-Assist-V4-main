const jwt = require("jsonwebtoken");
const users = require("../models/users");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: "12h" });
}

async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing authentication token." });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await users.findById(payload.sub);
    if (!user) return res.status(401).json({ error: "User no longer exists." });
    if (user.status === "Deactivated") return res.status(403).json({ error: "Account deactivated." });
    if (user.status === "Pending") return res.status(403).json({ error: "Account is pending administrator approval." });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token." });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Not authenticated." });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Requires one of roles: ${roles.join(", ")}` });
    }
    next();
  };
}

module.exports = { signToken, requireAuth, requireRole, JWT_SECRET };
