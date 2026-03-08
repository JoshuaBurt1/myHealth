import { getAuth } from "firebase/auth";
import { app, db, syncHealthMetric } from "@my-health/shared";

export const auth = getAuth(app);

export { db, syncHealthMetric };

export default app;