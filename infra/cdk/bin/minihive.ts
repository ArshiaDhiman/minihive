import { App } from "aws-cdk-lib";
import { AuthStack } from "../lib/auth-stack.ts";
import { ProvisioningStack } from "../lib/provisioning-stack.ts";

const app = new App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const auth = new AuthStack(app, "MinihiveAuth", { env });
new ProvisioningStack(app, "MinihiveProvisioning", {
  env,
  userPoolId: auth.userPoolId,
  webClientId: auth.webClientId,
});
