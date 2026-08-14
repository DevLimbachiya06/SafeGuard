import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const getSecret = () => process.env.JWT_SECRET || "your_jwt_secret";

export function signToken(payload) {
  return jwt.sign(payload, getSecret(), { expiresIn: "8h" });
}

export function verifyToken(token) {
  return jwt.verify(token, getSecret());
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: "missing token" });
  }
  try {
    req.user = verifyToken(token);
    return next();
  } catch (error) {
    return res.status(401).json({ error: "invalid token" });
  }
}
