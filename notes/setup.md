# Setup
1. Replace value in template.yaml
```bash
cd backend
export LAMBDA_ROLE_ARN=$(aws iam list-roles --query "Roles[?contains(RoleName, 'LambdaDeployment')].Arn" --output text)
sed -Ei "s|<LAMBDA_ROLE_ARN>|${LAMBDA_ROLE_ARN}|g" template.yaml
export STEP_FUNCTIONS_ROLE_ARN=$(aws iam list-roles --query "Roles[?contains(RoleName, 'StateMachine')].Arn" --output text)
sed -Ei "s|<STEP_FUNCTIONS_ROLE_ARN>|${STEP_FUNCTIONS_ROLE_ARN}|g" template.yaml 
cd ..
```