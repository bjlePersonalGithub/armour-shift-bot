import { execSync } from 'node:child_process';
import 'dotenv/config';

const { AWS_REGION, ECR_REPO, LAMBDA_FUNCTION } = process.env;

for (const [name, value] of Object.entries({ AWS_REGION, ECR_REPO, LAMBDA_FUNCTION })) {
  if (!value) throw new Error(`missing env var: ${name}`);
}

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
const capture = (cmd) => execSync(cmd, { stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim();

const accountId = capture(`aws sts get-caller-identity --query Account --output text`);
const registry = `${accountId}.dkr.ecr.${AWS_REGION}.amazonaws.com`;
const repoUri = `${registry}/${ECR_REPO}`;
const tag = new Date().toISOString().replace(/[:.]/g, '-');

console.log(`\n→ logging into ECR ${registry}`);
run(`aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${registry}`);

console.log(`\n→ building image ${repoUri}:${tag}`);
run(`docker build --platform linux/amd64 -t ${repoUri}:${tag} -t ${repoUri}:latest .`);

console.log(`\n→ pushing ${repoUri}:${tag}`);
run(`docker push ${repoUri}:${tag}`);
run(`docker push ${repoUri}:latest`);

console.log(`\n→ updating lambda ${LAMBDA_FUNCTION}`);
run(`aws lambda update-function-code --function-name ${LAMBDA_FUNCTION} --image-uri ${repoUri}:${tag} --publish --region ${AWS_REGION}`);

console.log(`\n→ waiting for lambda update to finish`);
run(`aws lambda wait function-updated --function-name ${LAMBDA_FUNCTION} --region ${AWS_REGION}`);

console.log(`\n✓ deployed ${repoUri}:${tag}`);
