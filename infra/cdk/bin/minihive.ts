import { App } from "aws-cdk-lib";
import { AuthStack } from "../lib/auth-stack.ts";

const app = new App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

new AuthStack(app, "MinihiveAuth", { env });
