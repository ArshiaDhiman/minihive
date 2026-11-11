import {
  CfnOutput,
  Duration,
  RemovalPolicy,
  Stack,
  type StackProps,
} from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import type { Construct } from "constructs";

const WEB_APP_URL = "http://localhost:5173/";

export class AuthStack extends Stack {
  // Used by other stacks to verify tokens
  readonly userPoolId: string;
  readonly webClientId: string;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const userPool = new cognito.UserPool(this, "UserPool", {
      userPoolName: "minihive-users",
      featurePlan: cognito.FeaturePlan.ESSENTIALS,
      signInAliases: { email: true },
      selfSignUpEnabled: false, // users are created by admins
      standardAttributes: {
        email: { required: true, mutable: true },
        fullname: { required: false, mutable: true },
      },
      mfa: cognito.Mfa.OFF,
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      // `cdk destroy` deletes the pool and its users.
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // Platform role
    new cognito.UserPoolGroup(this, "PlatformAdminGroup", {
      userPool,
      groupName: "platform_admin",
      description: "Can create organisations and licences",
    });

    // Hosted login page
    const domain = userPool.addDomain("Domain", {
      cognitoDomain: { domainPrefix: `minihive-${this.account}` },
    });

    // Public client for the React app
    const webClient = userPool.addClient("WebClient", {
      userPoolClientName: "minihive-web",
      generateSecret: false,
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [
          cognito.OAuthScope.OPENID,
          cognito.OAuthScope.EMAIL,
          cognito.OAuthScope.PROFILE,
        ],
        callbackUrls: [WEB_APP_URL],
        logoutUrls: [WEB_APP_URL],
      },
      supportedIdentityProviders: [
        cognito.UserPoolClientIdentityProvider.COGNITO,
      ],
      accessTokenValidity: Duration.hours(1),
      idTokenValidity: Duration.hours(1),
      refreshTokenValidity: Duration.days(1),
      preventUserExistenceErrors: true,
    });

    this.userPoolId = userPool.userPoolId;
    this.webClientId = webClient.userPoolClientId;

    new CfnOutput(this, "UserPoolId", { value: userPool.userPoolId });
    new CfnOutput(this, "UserPoolClientId", {
      value: webClient.userPoolClientId,
    });
    new CfnOutput(this, "CognitoDomain", { value: domain.baseUrl() });
    new CfnOutput(this, "Issuer", {
      value: `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`,
    });
  }
}
