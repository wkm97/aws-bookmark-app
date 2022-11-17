# Overview
Before you’ll be able to make this application available outside of your development team, you need to review security best practices for securing access and protecting resources and data. You have successfully completed coding your application with several features and have also taken care of observability and monitoring aspects of the bookmark application. In this lab, you look into security aspects to ensure the protection of your resources and data and to avoid application outages.

The following architecture diagram shows the components that have been and will be deployed:

![architecture](/notes/images/SVILT-Labs-Lab5.png)

This lab uses the following services:
- AWS Amplify
- AWS Serverless Application Model (AWS SAM)
- Amazon Cognito
- AWS Cloud9
- Amazon DynamoDB
- Amazon EventBridge
- Amazon Simple Notification Service (Amazon SNS)
- AWS Step Functions
- AWS Lambda
- Amazon CloudWatch
- Amazon API Gateway
- AWS WAF
- AWS Key Management Service (AWS KMS)
- AWS Systems Manager Parameter Store
- AWS Secrets Manager

## Cloud9 setup
```bash
wget https://us-west-2-tcprod.s3-us-west-2.amazonaws.com/courses/ILT-TF-200-SVDVSS/v1.0.30.prod-f2fc3c01/lab-5-Security/scripts/app-code.zip
unzip app-code.zip
cd app-code
chmod +x resize.sh
chmod +x startupscript.sh
./startupscript.sh

```

## Part 1: Understanding AWS WAF and securing the application with web ACLs

### Part 1.1: SECURING WITH AWS WAF WEB ACLS
1. Open `WAF & Shield`
2. Create web ACL
    - Name: `BookmarkACL`
    - Description: `Block actions from the API Gateway`
    - CloudWatch metric name: `BookmarkACL`
    - Resource Type: Select `Regional resources (Application Load Balancer, API Gateway, AWS AppSync)`
3. Open `Rules`
4. Add rules -> select `Add my own rules and rule groups`
5. In `Rule builder`
    - Name: `100ratebasedrule`
    - Type: select `Rate-based rule`
6. In `Request Rate Details`
    - Rate limit: `100`
    - IP address to use for rate limiting: `Source IP address`
    - Criteria to count request towards rate limit: `Consider all requests`
7. In the `Then` section, leave the default value of `Action` as `Block`.
8. `Add rule` -> keep next and review -> `Create web ACL`
9. Attach to API gateway deployed `Stage` in WAF section.
    - APIs: `Bookmark App`
    - Stage: `dev`
10. Stress test using Artillery, exceed 100 RPS.
```bash
# replace variable
cd test
echo export API_GATEWAY_ID=$(aws apigateway get-rest-apis --query 'items[?name==`Bookmark App`].id' --output text) >> ~/environment/app-code/labVariables
echo export AWS_REGION=$(curl -s 169.254.169.254/latest/dynamic/instance-identity/document | jq -r '.region') >> ~/environment/app-code/labVariables
source ~/environment/app-code/labVariables
echo export API_GATEWAY_URL=https://${API_GATEWAY_ID}.execute-api.${AWS_REGION}.amazonaws.com/dev >> ~/environment/app-code/labVariables
source ~/environment/app-code/labVariables
sed -Ei "s|<API_GATEWAY_URL>|${API_GATEWAY_URL}|g" simple-post.yaml
cd ..

# create records
cd test
npm install artillery@1.7.9 -g
npm install faker@5.5.3
artillery run simple-post.yaml

# try get dummy bookmark
source ~/environment/app-code/labVariables
echo export ID=$(aws dynamodb scan --table-name sam-bookmark-app-bookmarksTable --query Items[0].id --output text) >> ~/environment/app-code/labVariables
source ~/environment/app-code/labVariables
curl ${API_GATEWAY_URL}/bookmarks/${ID}

# trigger to quickly occupy 100 request
source ~/environment/app-code/labVariables
artillery quick -n 20 --count 100 ${API_GATEWAY_URL}/bookmarks

# trigger test to exceed 100 RPS
source ~/environment/app-code/labVariables
curl ${API_GATEWAY_URL}/bookmarks/${ID}

```

### Part 1.2: SECURING WITH AWS WAF USING AN IP ADDRESS
1. Open `WAF & Shield`
2. Create IP Set
    - IP set name: `IPToBlock`
    - Description: `Block this IP address`
    - IP addresses: any ip wanted in CIDR format, append `/32`
3. Create web ACL
    - Name: `IPsetbasedACL`
    - Description: `Blocks actions from the specified IP address`
    - CloudWatch metric name: `IPsetbasedACL`
    - Resource Type: Select `Regional resources (Application Load Balancer, API Gateway, AWS AppSync)`
4. add rules -> select `Add my own rules and rule groups`
5. open `Rules` -> In the `Rule` type section, choose `IP set`.
6. In the `Rule` section, name: `IPbasedrule`.
7. In the `IP set` section
    - IP set: `IPToBlock`
    - IP address to use as the originating address: Leave the default value as `Source IP address`
    - Action: Leave the default value as `Block`
8. `Add rule` -> keep next and review -> `Create web ACL`
9. Attach it to API gateway deployed `Stage` in WAF section.
    - APIs: `Bookmark App`
    - Stage: `dev`
10. Test access using curl.
```bash
source ~/environment/app-code/labVariables
curl ${API_GATEWAY_URL}/bookmarks/${ID}

```

## Part 2: Securing the application with API Gateway resource policies

1. Navigate to the API Gateway page.
2. In the left navigation pane, choose Resource Policy.
3. Copy and paste the following policy, replace `SOURCEIPORCIDRBLOCK` with the ip address wanted to be blocked.
```json
{
  "Version": "2012-10-17",
  "Statement": [{
      "Effect": "Allow",
      "Principal": "*",
      "Action": "execute-api:Invoke",
      "Resource": "execute-api:/*/*/*"
    },
    {
      "Effect": "Deny",
      "Principal": "*",
      "Action": "execute-api:Invoke",
      "Resource": "execute-api:/*/*/*",
      "Condition": {
        "NotIpAddress": {
          "aws:SourceIp": ["SOURCEIPORCIDRBLOCK"]
        }
      }
    }
  ]
}

```
4. call the api again with, and will be deny this time
```bash
source ~/environment/app-code/labVariables
curl ${API_GATEWAY_URL}/bookmarks/${ID}

```

---
## Part 3: Securing an AWS Lambda function 
### Setup:
1. Create a lambda function:
    - name: `sam-bookmark-app-secrets-function`
    - runtime: `Node.js 16.x`
    - permission: `"kms:Decrypt", "ssm:GetParameter", "secretsmanager:GetSecretValue"`

2. Deploy following code:
    ```javascript
    const aws = require('aws-sdk');

    const kmsSecret = process.env.KMS_SECRET;
    const ssmSecret = process.env.SSM_SECRET;
    const userId =  process.env.SM_USER_ID;

    let decodedSecret;
    let DecodedKMSSecret;

    const kms = new aws.KMS();
    const ssm = new aws.SSM();
    const sm = new aws.SecretsManager();

    exports.handler = async message => {
        console.log(message);
        let secretType = message.pathParameters.id
        console.log("Secret Type:", secretType);
        
        if(secretType == 'kms')
            decodedSecret = await decodeKMSSecret();
        else if (secretType == 'ssm')
            decodedSecret = await decodeSSMSecret();
        else if (secretType == 'sm') {
            var password = await decodeSMSecret(userId);
            decodedSecret = "Password is: " + password;
        }
        else
            decodedSecret = "Provide a valid secret type (kms, ssm, or sm (secrets manager))";
        
        console.log(decodedSecret);
        const response = {
            statusCode: 200,
            headers: {},
            body: JSON.stringify('Plain text secret(s): ' + decodedSecret)
        };
        return response;
    };

    async function decodeKMSSecret() {
        if (DecodedKMSSecret) {
            return DecodedKMSSecret;
        }
        const params = {
        CiphertextBlob: Buffer.from(kmsSecret, 'base64')
        };
        const data = await kms.decrypt(params).promise();
        DecodedKMSSecret = data.Plaintext.toString('utf-8');
        return DecodedKMSSecret;
    }

    async function decodeSSMSecret() {
        const params = {
            Name: ssmSecret,
            WithDecryption: true
        };
        const result = await ssm.getParameter(params).promise();
        return result.Parameter.Value
    }

    async function decodeSMSecret(smkey) {
        console.log("SM Key:", smkey);
        const params = {
            SecretId: smkey
        };
        const result = await sm.getSecretValue(params).promise();
        return result.SecretString;
    }
    ```

3. Configure the Amazon API Gateway and integrate with the function created
    - path: /secrets/{id}, where id is `ssm, sm, kms`
    - enable `Lambda Proxy integration`


### AWS KMS 
- create and manage cryptographic keys and control their use across a wide range of AWS services and in your applications. 
- uses hardware security modules that have been validated under FIPS 140-2, or are in the process of being validated, to protect your keys. 
- integrated with AWS CloudTrail to provide you with logs of all key use in order to help meet your regulatory and compliance needs.

1. Open `Key Management Service` -> `Customer managed keys`
2. Create Key -> Configure key -> Key type as `Symmetric` -> Next
3. Add label for easier querying, then Next
    - Alias: LambdaSecrets
    - Description: Creating a Lambda secrets key
4. `Key administrators` -> select user or role logged in -> Next
5. `This account` -> select user or role logged in -> Next -> Finish
6. In terminal, run the following and get the base64 encoded output:
    ```bash
    export KeyId=$(aws kms list-aliases --query 'Aliases[?starts_with(AliasName, `alias/LambdaSecrets`)].TargetKeyId' --output text)
    aws kms encrypt --plaintext "Key Management Service Secrets" --query CiphertextBlob --output text --key-id ${KeyId}

    ```
7. add the output as environment variable for the lambda function:
    - Key: `KMS_SECRET`
    - Value: Enter the base64 encoded output
8. call the rest api with `/secrets/kms`


### Parameter Store
- provides secure, hierarchical storage for configuration data management and secrets management. 
- store data such as passwords, database strings, Amazon Machine Image (AMI) IDs, and license codes as parameter values in plain text or encrypted data.
- reference Systems Manager parameters in your scripts, commands, Systems Manager documents, and configuration and automation workflows by using the unique name that you specified when you created the parameter.

1. run in terminal:
```bash
aws ssm put-parameter --name /db/secret --value 'Hello, Parameter Store!' --type SecureString
```
2. add the following as environment variable for the lambda function:
    - Key: `SSM_SECRET`
    - Value: `/db/secret`
3. call the rest api with `/secrets/ssm`


### Secrets Manager
- helps you protect secrets needed to access your applications, services, and IT resources. 
- enables you to easily rotate, manage, and retrieve database credentials, API keys, and other secrets throughout their lifecycle. 
- retrieve secrets with a call to Secrets Manager APIs, eliminating the need to hard code sensitive information in plain text. 
- secret rotation with built-in integration for Amazon Relational Database Service (Amazon RDS), Amazon Redshift, and Amazon DocumentDB.

1. run in terminal:
```bash
aws secretsmanager create-secret --name dbUserId --secret-string  "secretsmanagerpassword"
```
2. add the following as environment variable for the lambda function:
    - Key: `SM_USER_ID`
    - Value: `/db/secret`
3. call the rest api with `dbUserId`

