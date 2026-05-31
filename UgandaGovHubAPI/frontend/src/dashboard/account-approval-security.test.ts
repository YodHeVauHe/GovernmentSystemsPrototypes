import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const dashboardHelpers = fs.readFileSync(
  path.join(currentDir, 'page-components', 'dashboard-page-helpers.tsx'),
  'utf8',
);

assert.equal(
  dashboardHelpers.includes("normalizedAccountType === 'government_employee'"),
  true,
  'Government employee reviewer approvals require an assigned MDA.',
);

assert.equal(
  dashboardHelpers.includes(
    'const approvalAccountCategory = account.account?.profile?.account_category || account.account_type;',
  ),
  true,
  'Approval defaults should use the verified account category when profile and signup category differ.',
);

assert.equal(
  dashboardHelpers.includes('const needsMda = approvalRequiresMda(approvalAccountCategory, selectedRole);'),
  true,
  'Approval defaults should pass the verified account category into MDA requirement checks.',
);
