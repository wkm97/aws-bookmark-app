# Setup
1. create CodeCommit Repo using cli
```bash
aws codecommit create-repository --repository-name app-code
```

2. Cloud9 environment with `BookmarkAppDevEnv` name and download this git repo
```bash
git clone ${this repo}
```

3. Go to `pipline` folder and setup `pipeline`
```
npm uninstall -g aws-cdk
npm install -g aws-cdk@latest --force
cd pipeline
npm build
cdk deploy
```

4. Replace Parameters Value in template.yaml for `LambdaDeploymentRole` and `StepFunctionsDeploymentRole`
```bash
cd ~/environment/aws-bookmark-app/app-code/backend
export LAMBDA_ROLE_ARN=$(aws iam list-roles --query "Roles[?contains(RoleName, 'LambdaDeployment')].Arn" --output text)
sed -Ei "s|<LAMBDA_ROLE_ARN>|${LAMBDA_ROLE_ARN}|g" template.yaml
export STEP_FUNCTIONS_ROLE_ARN=$(aws iam list-roles --query "Roles[?contains(RoleName, 'StateMachine')].Arn" --output text)
sed -Ei "s|<STEP_FUNCTIONS_ROLE_ARN>|${STEP_FUNCTIONS_ROLE_ARN}|g" template.yaml 
cd ..
```

5. Push only `app-code` folder to codecommit to trigger pipeline
```bash
# In cloud9 push app-code folder only to codecommit repo (not whole folder)
# init git and commit
cd ~/environment/aws-bookmark-app/app-code
git init
git checkout -b main
git add .
git commit -m "Initial commit"
# use of the Git credential helper with the AWS credential profile and enable the Git credential helper to send the path to repositories
git config --global credential.helper '!aws codecommit credential-helper $@'
git config --global credential.UseHttpPath true
# add codecommit url to git
sudo yum -y install jq
echo export AWS_REGION=$(curl -s 169.254.169.254/latest/dynamic/instance-identity/document | jq -r '.region') >> ~/environment/aws-bookmark-app/app-code/labVariables
source ~/environment/aws-bookmark-app/app-code/labVariables
git remote add origin https://git-codecommit.${AWS_REGION}.amazonaws.com/v1/repos/app-code
```

# Testing
1. Get information required for `simple-post.yaml` file
```bash
cd ~/environment/aws-bookmark-app/app-code/test
echo export API_GATEWAY_ID=$(aws apigateway get-rest-apis --query 'items[?name==`Bookmark App`].id' --output text) >> ~/environment/aws-bookmark-app/app-code/labVariables
source ~/environment/aws-bookmark-app/app-code/labVariables
echo export API_GATEWAY_URL=https://${API_GATEWAY_ID}.execute-api.${AWS_REGION}.amazonaws.com/dev >> ~/environment/aws-bookmark-app/app-code/labVariables
source ~/environment/aws-bookmark-app/app-code/labVariables
sed -Ei "s|<API_GATEWAY_URL>|${API_GATEWAY_URL}|g" simple-post.yaml
cd ..
```

2. Run artillery
```bash
cd ~/environment/aws-bookmark-app/app-code/test
npm install artillery -g
npm install faker@5.5.3
artillery run simple-post.yaml
```