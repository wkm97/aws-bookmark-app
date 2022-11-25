# Setup
1. create CodeCommit Repo
```bash
aws codecommit create-repository --repository-name app-code
```

2. Replace Parameters value in template.yaml for `LambdaDeploymentRole` and `StepFunctionsDeploymentRole`
```bash
cd backend
export LAMBDA_ROLE_ARN=$(aws iam list-roles --query "Roles[?contains(RoleName, 'LambdaDeployment')].Arn" --output text)
sed -Ei "s|<LAMBDA_ROLE_ARN>|${LAMBDA_ROLE_ARN}|g" template.yaml
export STEP_FUNCTIONS_ROLE_ARN=$(aws iam list-roles --query "Roles[?contains(RoleName, 'StateMachine')].Arn" --output text)
sed -Ei "s|<STEP_FUNCTIONS_ROLE_ARN>|${STEP_FUNCTIONS_ROLE_ARN}|g" template.yaml 
cd ..
```