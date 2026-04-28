import { execSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import 'dotenv/config';

const { AWS_REGION, ECR_REPO, BRANCH_NAME } = process.env;

for (const [name, value] of Object.entries({ AWS_REGION, ECR_REPO, BRANCH_NAME })) {
  if (!value) throw new Error(`missing env var: ${name}`);
}

const run = (cmd) => execSync(cmd, { stdio: 'inherit' });
const capture = (cmd) => execSync(cmd, { stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim();

// Docker tags allow [a-zA-Z0-9_.-], can't start with '.' or '-', max 128 chars.
const sanitize = (name) =>
  name.replace(/[^a-zA-Z0-9_.-]/g, '-').replace(/^[.-]+/, '').slice(0, 100);

const branchTag = sanitize(BRANCH_NAME);    
if (!branchTag) throw new Error(`branch name "${BRANCH_NAME}" sanitized to empty string`);

const accountId = capture(`aws sts get-caller-identity --query Account --output text`);
const registry = `${accountId}.dkr.ecr.${AWS_REGION}.amazonaws.com`;
const repoUri = `${registry}/${ECR_REPO}`;

console.log(`\n→ finding next build number for branch "${branchTag}"`);
const tagsJson = capture(
  `aws ecr list-images --repository-name ${ECR_REPO} --region ${AWS_REGION} --filter tagStatus=TAGGED --query "imageIds[*].imageTag" --output json`,
);
const existingTags = JSON.parse(tagsJson || '[]');
const pattern = new RegExp(`^${branchTag.replace(/[.+?^${}()|[\]\\]/g, '\\$&')}-(\\d+)$`);
const nextBuild =
  existingTags.reduce((max, tag) => {
    const m = pattern.exec(tag ?? '');
    if (!m) return max;
    const n = parseInt(m[1], 10);
    return n > max ? n : max;
  }, 0) + 1;

const buildTag = `${branchTag}-${nextBuild}`;
const branchLatestTag = `${branchTag}-latest`;

console.log(`→ build #${nextBuild} → ${buildTag}`);

console.log(`\n→ logging into ECR ${registry}`);
run(`aws ecr get-login-password --region ${AWS_REGION} | docker login --username AWS --password-stdin ${registry}`);

console.log(`\n→ building image ${repoUri}:${buildTag}`);
run(`docker build --platform linux/amd64 -t ${repoUri}:${buildTag} -t ${repoUri}:${branchLatestTag} .`);

console.log(`\n→ pushing ${repoUri}:${buildTag}`);
run(`docker push ${repoUri}:${buildTag}`);
console.log(`\n→ pushing ${repoUri}:${branchLatestTag}`);
run(`docker push ${repoUri}:${branchLatestTag}`);

console.log(`\n✓ pushed ${repoUri}:${buildTag}`);

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(process.env.GITHUB_OUTPUT, `image-uri=${repoUri}:${buildTag}\n`);
  appendFileSync(process.env.GITHUB_OUTPUT, `image-tag=${buildTag}\n`);
}
