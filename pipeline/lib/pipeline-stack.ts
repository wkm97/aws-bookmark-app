import * as cdk from '@aws-cdk/core';
import s3 = require('@aws-cdk/aws-s3');
import codecommit = require('@aws-cdk/aws-codecommit');
import codepipeline = require('@aws-cdk/aws-codepipeline');
import codepipeline_actions = require('@aws-cdk/aws-codepipeline-actions');
import codebuild = require('@aws-cdk/aws-codebuild');
import iam = require('@aws-cdk/aws-iam');

export class PipelineStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    // The code that defines roles
    const lambdaDeploymentRole = new iam.Role(this, 'LambdaDeploymentRole', {
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal("lambda.amazonaws.com"),
        new iam.ServicePrincipal("events.amazonaws.com"),
        new iam.ServicePrincipal("states.amazonaws.com"),
      ),
    });
    const eventBridgeStateMachine = new iam.Role(this, 'EventBridgeStateMachine', {
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal("events.amazonaws.com"),
        new iam.ServicePrincipal("states.amazonaws.com"),
      ),
    });

    // Add a managed policy to a role you can use
    lambdaDeploymentRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'));
    lambdaDeploymentRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AWSXrayWriteOnlyAccess'));

    // Add a policy to a Role
    lambdaDeploymentRole.attachInlinePolicy(
      new iam.Policy(this, 'AWSLambdaInvocationRole', {
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            resources: ["*"],
            actions: ["lambda:InvokeFunction"]
          })
        ],
      })
    );
    lambdaDeploymentRole.attachInlinePolicy(
      new iam.Policy(this, 'BookmarkRolePolicy', {
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            resources: ['*'],
            actions: [
              "dynamodb:GetItem",
              "dynamodb:DeleteItem",
              "dynamodb:PutItem",
              "dynamodb:Scan",
              "dynamodb:Query",
              "dynamodb:UpdateItem",
              "dynamodb:BatchWriteItem",
              "dynamodb:BatchGetItem",
              "dynamodb:DescribeTable",
              "dynamodb:ConditionCheckItem",
              "dynamodb:DescribeStream",
              "dynamodb:GetRecords",
              "dynamodb:GetShardIterator",
              "dynamodb:ListStreams",
              "events:Put*",
              "events:Describe*",
              "events:List*",
              "states:StartExecution",
              "states:SendTaskSuccess",
              "sns:Publish"
            ]
          })
        ],
      })
    );
    eventBridgeStateMachine.attachInlinePolicy(
      new iam.Policy(this, 'EventBridgeStateMachinePolicy', {
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            resources: ["*"],
            actions: [
              "states:StartExecution",
              "states:SendTaskSuccess"
            ]
          })
        ],
      })
    );


    // The code that defines your stack goes here
    const artifactsBucket = new s3.Bucket(this, "ArtifactsBucket");
    // Import existing CodeCommit app-code repository 
    const codeRepo = codecommit.Repository.fromRepositoryName(
      this,
      'AppRepository', // Logical name within CloudFormation 
      'app-code' // Repository name
    );
    // Pipeline creation starts
    const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      artifactBucket: artifactsBucket
    });

    // Declare source code as an artifact 
    const sourceOutput = new codepipeline.Artifact();
    // Add source stage to pipeline 
    pipeline.addStage({
      stageName: 'Source',
      actions: [
        new codepipeline_actions.CodeCommitSourceAction({
          actionName: 'CodeCommit_Source',
          repository: codeRepo,
          output: sourceOutput,
          branch: 'main',
        })
      ],
    });
    // Declare build output as artifacts 
    const buildOutput = new codepipeline.Artifact();
    // Declare a new CodeBuild project 
    const buildProject = new codebuild.PipelineProject(this, 'Build', {
      environment: { buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_2 },
      environmentVariables: {
        'PACKAGE_BUCKET': {
          value: artifactsBucket.bucketName
        }
      }
    });
    // Add the build stage to our pipeline
    pipeline.addStage({
      stageName: 'Build', actions: [
        new codepipeline_actions.CodeBuildAction({
          actionName: 'Build',
          project: buildProject,
          input: sourceOutput,
          outputs: [buildOutput],
        }),],
    });
    // Deploy stage 
    pipeline.addStage({
      stageName: 'Dev',
      actions: [
        new codepipeline_actions.CloudFormationCreateReplaceChangeSetAction({
          actionName: 'CreateChangeSet',
          templatePath: buildOutput.atPath("packaged.yaml"),
          stackName: 'bookmark-app',
          adminPermissions: true,
          changeSetName: 'bookmark-app-dev-changeset',
          runOrder: 1
        }),
        new codepipeline_actions.CloudFormationExecuteChangeSetAction({
          actionName: 'Deploy',
          stackName: 'bookmark-app',
          changeSetName: 'bookmark-app-dev-changeset',
          runOrder: 2
        }),],
    });
  };
}
