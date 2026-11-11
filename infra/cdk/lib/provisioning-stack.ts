import { join } from "node:path";
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import * as sns from "aws-cdk-lib/aws-sns";
import { SqsSubscription } from "aws-cdk-lib/aws-sns-subscriptions";
import * as sqs from "aws-cdk-lib/aws-sqs";
import type { Construct } from "constructs";

// outbox → (worker) → SNS → SQS → Lambda → DynamoDB
export class ProvisioningStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // RepairInfo's own store: USER#<sub> / PRODUCT#<code> = has access,
    // EVENT#<id> / EVENT = already processed
    const accessTable = new dynamodb.TableV2(this, "AccessTable", {
      tableName: "repairinfo-access",
      partitionKey: { name: "PK", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "SK", type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // One topic for all provisioning events; each product subscribes its own queue
    const topic = new sns.Topic(this, "ProvisioningEvents", {
      topicName: "provisioning-events",
    });

    const deadLetterQueue = new sqs.Queue(this, "RepairInfoDeadLetterQueue", {
      queueName: "repairinfo-provisioning-dlq",
      retentionPeriod: Duration.days(14),
    });

    const queue = new sqs.Queue(this, "RepairInfoQueue", {
      queueName: "repairinfo-provisioning",
      visibilityTimeout: Duration.seconds(60), // must be longer than the Lambda timeout
      deadLetterQueue: { queue: deadLetterQueue, maxReceiveCount: 3 },
    });

    // Raw delivery: the SQS body is our event JSON, not wrapped in an SNS envelope
    topic.addSubscription(new SqsSubscription(queue, { rawMessageDelivery: true }));

    const consumer = new NodejsFunction(this, "ProvisioningConsumer", {
      functionName: "minihive-provisioning-consumer",
      entry: join(import.meta.dirname, "../lambdas/provisioning-consumer/index.ts"),
      runtime: lambda.Runtime.NODEJS_22_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: Duration.seconds(10),
      environment: { TABLE_NAME: accessTable.tableName },
      logGroup: new logs.LogGroup(this, "ProvisioningConsumerLogs", {
        logGroupName: "/aws/lambda/minihive-provisioning-consumer",
        retention: logs.RetentionDays.ONE_WEEK,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    });

    accessTable.grantReadWriteData(consumer);
    consumer.addEventSource(
      new SqsEventSource(queue, { batchSize: 10, reportBatchItemFailures: true }),
    );

    new CfnOutput(this, "TopicArn", { value: topic.topicArn });
    new CfnOutput(this, "AccessTableName", { value: accessTable.tableName });
    new CfnOutput(this, "DeadLetterQueueUrl", { value: deadLetterQueue.queueUrl });
  }
}
