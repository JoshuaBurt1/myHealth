import { getAuth } from "firebase/auth";
import { app, db } from "@my-health/shared";

export const auth = getAuth(app);

export { db };

export default app;